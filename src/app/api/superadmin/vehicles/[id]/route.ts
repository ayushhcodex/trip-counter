import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicleNumber, status } = body;

    // Check if target vehicle exists
    const [existing] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    const updateFields: any = {};
    if (vehicleNumber !== undefined) updateFields.vehicleNumber = vehicleNumber;
    if (status !== undefined) updateFields.status = status;

    const validStatuses = ['ACTIVE', 'BREAKDOWN', 'INACTIVE'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid vehicle status specified.' }, { status: 400 });
    }

    updateFields.updatedAt = new Date();

    const [updatedVehicle] = await db
      .update(vehicles)
      .set(updateFields)
      .where(eq(vehicles.id, id))
      .returning();

    // Log vehicle status/number update to audit logs
    await logAudit({
      actorUserId: actor!.userId,
      action: 'VEHICLE_UPDATED',
      entityType: 'vehicles',
      entityId: id,
      metadata: {
        fieldsChanged: Object.keys(updateFields),
        vehicleNumber: updatedVehicle.vehicleNumber,
        status: updatedVehicle.status,
      },
    });

    return NextResponse.json({ success: true, vehicle: updatedVehicle });
  } catch (error) {
    console.error('[VEHICLES_PUT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update vehicle.' }, { status: 500 });
  }
}
