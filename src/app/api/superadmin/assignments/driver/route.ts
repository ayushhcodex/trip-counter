import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicleDriverAssignments, vehicles, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkAuth(['SUPER_ADMIN', 'ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get('vehicleId');
    const driverId = url.searchParams.get('driverId');

    let query = db.select({
      id: vehicleDriverAssignments.id,
      vehicleId: vehicleDriverAssignments.vehicleId,
      driverId: vehicleDriverAssignments.driverId,
      slot: vehicleDriverAssignments.slot,
      startAt: vehicleDriverAssignments.startAt,
      endAt: vehicleDriverAssignments.endAt,
      driverName: users.name,
      driverUsername: users.usernameOrEmail,
      vehicleNumber: vehicles.vehicleNumber,
    })
    .from(vehicleDriverAssignments)
    .innerJoin(users, eq(vehicleDriverAssignments.driverId, users.id))
    .innerJoin(vehicles, eq(vehicleDriverAssignments.vehicleId, vehicles.id));

    // Execute query and filter in-memory for simpler code matching dynamic search criteria
    const assignments = await query;
    let filtered = assignments;
    if (vehicleId) {
      filtered = filtered.filter((a) => a.vehicleId === vehicleId);
    }
    if (driverId) {
      filtered = filtered.filter((a) => a.driverId === driverId);
    }

    return NextResponse.json({ success: true, assignments: filtered });
  } catch (error) {
    console.error('[ASSIGNMENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve assignments.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicleId, driverId, slot } = body; // driverId is null if unassigning

    if (!vehicleId || !slot || ![1, 2].includes(slot)) {
      return NextResponse.json(
        { error: 'Vehicle ID and valid slot (1 or 2) are required.' },
        { status: 400 }
      );
    }

    // Verify vehicle exists
    const [targetVehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    if (!targetVehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    if (driverId) {
      // Verify driver exists, is a DRIVER role, and is not deactivated
      const [driver] = await db
        .select()
        .from(users)
        .where(eq(users.id, driverId))
        .limit(1);

      if (!driver) {
        return NextResponse.json({ error: 'Driver user not found.' }, { status: 404 });
      }

      if (driver.role !== 'DRIVER') {
        return NextResponse.json({ error: 'Assigned user must be a DRIVER.' }, { status: 400 });
      }

      if (driver.status === 'INACTIVE') {
        return NextResponse.json(
          { error: 'Driver is inactive and cannot be assigned to a vehicle.' },
          { status: 400 }
        );
      }
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // 1. Terminate the active driver assignment currently occupying the specified slot on this vehicle
      const [activeSlotAssignment] = await tx
        .select()
        .from(vehicleDriverAssignments)
        .where(
          and(
            eq(vehicleDriverAssignments.vehicleId, vehicleId),
            eq(vehicleDriverAssignments.slot, slot),
            isNull(vehicleDriverAssignments.endAt)
          )
        )
        .limit(1);

      if (activeSlotAssignment) {
        await tx
          .update(vehicleDriverAssignments)
          .set({ endAt: now })
          .where(eq(vehicleDriverAssignments.id, activeSlotAssignment.id));
      }

      // If driverId is provided, perform the assignment
      if (driverId) {
        // 2. Terminate any other currently active assignments for this driver to avoid duplicate driving slots
        const otherDriverAssignments = await tx
          .select()
          .from(vehicleDriverAssignments)
          .where(
            and(
              eq(vehicleDriverAssignments.driverId, driverId),
              isNull(vehicleDriverAssignments.endAt)
            )
          );

        for (const assignment of otherDriverAssignments) {
          await tx
            .update(vehicleDriverAssignments)
            .set({ endAt: now })
            .where(eq(vehicleDriverAssignments.id, assignment.id));
        }

        // 3. Create the new assignment record
        const [newAssignment] = await tx
          .insert(vehicleDriverAssignments)
          .values({
            vehicleId,
            driverId,
            slot,
            startAt: now,
          })
          .returning();

        return { newAssignment, terminatedPrevious: !!activeSlotAssignment };
      }

      return { newAssignment: null, terminatedPrevious: !!activeSlotAssignment };
    });

    // Write audit trail
    await logAudit({
      actorUserId: actor!.userId,
      action: driverId ? 'DRIVER_ASSIGNED' : 'DRIVER_UNASSIGNED',
      entityType: 'vehicles',
      entityId: vehicleId,
      metadata: {
        driverId,
        slot,
        terminatedPrevious: result.terminatedPrevious,
      },
    });

    return NextResponse.json({
      success: true,
      assignment: result.newAssignment,
      message: driverId
        ? `Driver successfully assigned to Slot ${slot}.`
        : `Slot ${slot} successfully cleared.`,
    });
  } catch (error) {
    console.error('[ASSIGNMENT_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update assignment.' }, { status: 500 });
  }
}
