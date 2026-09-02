import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { adminVehicleAssignments, vehicles, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(req.url);
    const adminId = url.searchParams.get('adminId');
    const vehicleId = url.searchParams.get('vehicleId');

    let query = db.select({
      id: adminVehicleAssignments.id,
      adminId: adminVehicleAssignments.adminId,
      vehicleId: adminVehicleAssignments.vehicleId,
      createdAt: adminVehicleAssignments.createdAt,
      adminName: users.name,
      adminUsername: users.usernameOrEmail,
      vehicleNumber: vehicles.vehicleNumber,
    })
    .from(adminVehicleAssignments)
    .innerJoin(users, eq(adminVehicleAssignments.adminId, users.id))
    .innerJoin(vehicles, eq(adminVehicleAssignments.vehicleId, vehicles.id));

    const assignments = await query;
    let filtered = assignments;
    if (adminId) {
      filtered = filtered.filter((a) => a.adminId === adminId);
    }
    if (vehicleId) {
      filtered = filtered.filter((a) => a.vehicleId === vehicleId);
    }

    return NextResponse.json({ success: true, assignments: filtered });
  } catch (error) {
    console.error('[ADMIN_ASSIGNMENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve admin-vehicle assignments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { adminId, vehicleId } = body;

    if (!adminId || !vehicleId) {
      return NextResponse.json(
        { error: 'Admin ID and Vehicle ID are required.' },
        { status: 400 }
      );
    }

    // Verify admin user exists and is actually an ADMIN
    const [admin] = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });
    }
    if (admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'User is not an Admin.' }, { status: 400 });
    }

    // Verify vehicle exists
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    // Insert (with ignore or ON CONFLICT to prevent error if already assigned)
    const [assignment] = await db
      .insert(adminVehicleAssignments)
      .values({ adminId, vehicleId })
      .onConflictDoNothing()
      .returning();

    // Log admin vehicle mapping created
    await logAudit({
      actorUserId: actor!.userId,
      action: 'ADMIN_VEHICLE_ASSIGNED',
      entityType: 'users',
      entityId: adminId,
      metadata: { vehicleId, vehicleNumber: vehicle.vehicleNumber },
    });

    return NextResponse.json({
      success: true,
      assignment: assignment || null,
      message: 'Vehicle successfully assigned to Admin.',
    });
  } catch (error) {
    console.error('[ADMIN_ASSIGNMENT_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to assign vehicle to Admin.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { adminId, vehicleId } = body;

    if (!adminId || !vehicleId) {
      return NextResponse.json(
        { error: 'Admin ID and Vehicle ID are required.' },
        { status: 400 }
      );
    }

    // Delete mapping
    const result = await db
      .delete(adminVehicleAssignments)
      .where(
        and(
          eq(adminVehicleAssignments.adminId, adminId),
          eq(adminVehicleAssignments.vehicleId, vehicleId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Assignment mapping not found.' },
        { status: 404 }
      );
    }

    // Log admin vehicle mapping removed
    await logAudit({
      actorUserId: actor!.userId,
      action: 'ADMIN_VEHICLE_REMOVED',
      entityType: 'users',
      entityId: adminId,
      metadata: { vehicleId },
    });

    return NextResponse.json({
      success: true,
      message: 'Vehicle assignment removed from Admin.',
    });
  } catch (error) {
    console.error('[ADMIN_ASSIGNMENT_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to remove vehicle assignment.' }, { status: 500 });
  }
}
