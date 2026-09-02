import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicles, adminVehicleAssignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN', 'ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    if (actor!.role === 'SUPER_ADMIN') {
      // Super Admin sees all vehicles
      const allVehicles = await db.select().from(vehicles);
      return NextResponse.json({ success: true, vehicles: allVehicles });
    } else {
      // Admin only sees assigned vehicles
      const assignedVehicles = await db
        .select({
          id: vehicles.id,
          vehicleNumber: vehicles.vehicleNumber,
          status: vehicles.status,
          createdAt: vehicles.createdAt,
          updatedAt: vehicles.updatedAt,
        })
        .from(vehicles)
        .innerJoin(adminVehicleAssignments, eq(vehicles.id, adminVehicleAssignments.vehicleId))
        .where(eq(adminVehicleAssignments.adminId, actor!.userId));

      return NextResponse.json({ success: true, vehicles: assignedVehicles });
    }
  } catch (error) {
    console.error('[VEHICLES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve vehicles.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicleNumber, status } = body;

    if (!vehicleNumber) {
      return NextResponse.json({ error: 'Vehicle number is required.' }, { status: 400 });
    }

    // Check duplicate
    const [existing] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.vehicleNumber, vehicleNumber))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A vehicle with this registration number already exists.' },
        { status: 400 }
      );
    }

    const [newVehicle] = await db
      .insert(vehicles)
      .values({
        vehicleNumber,
        status: status || 'ACTIVE',
      })
      .returning();

    // Log vehicle creation event
    await logAudit({
      actorUserId: actor!.userId,
      action: 'VEHICLE_CREATED',
      entityType: 'vehicles',
      entityId: newVehicle.id,
      metadata: { vehicleNumber: newVehicle.vehicleNumber, status: newVehicle.status },
    });

    return NextResponse.json({ success: true, vehicle: newVehicle }, { status: 201 });
  } catch (error) {
    console.error('[VEHICLES_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create vehicle.' }, { status: 500 });
  }
}
