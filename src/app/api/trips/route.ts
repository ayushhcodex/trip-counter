import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, vehicleDriverAssignments, vehicles, users } from '@/db/schema';
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getDateBoundaries, getLocalDateString } from '@/lib/timezone';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    // 1. Fetch active assignment for this driver
    const [assignment] = await db
      .select({
        id: vehicleDriverAssignments.id,
        vehicleId: vehicleDriverAssignments.vehicleId,
        slot: vehicleDriverAssignments.slot,
        vehicleNumber: vehicles.vehicleNumber,
        vehicleStatus: vehicles.status,
      })
      .from(vehicleDriverAssignments)
      .innerJoin(vehicles, eq(vehicleDriverAssignments.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicleDriverAssignments.driverId, actor!.userId),
          isNull(vehicleDriverAssignments.endAt)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json({
        success: true,
        assigned: false,
        vehicle: null,
        trips: [],
        todayCount: 0,
      });
    }

    // 2. Fetch today's trips in the local timezone (e.g. Asia/Kolkata)
    const todayStr = getLocalDateString(new Date());
    const { start, end } = getDateBoundaries(todayStr);

    const todayTrips = await db
      .select({
        id: trips.id,
        completedAt: trips.completedAt,
        createdAt: trips.createdAt,
      })
      .from(trips)
      .where(
        and(
          eq(trips.driverId, actor!.userId),
          eq(trips.vehicleId, assignment.vehicleId),
          gte(trips.completedAt, start),
          lte(trips.completedAt, end)
        )
      )
      .orderBy(desc(trips.completedAt));

    return NextResponse.json({
      success: true,
      assigned: true,
      vehicle: {
        id: assignment.vehicleId,
        vehicleNumber: assignment.vehicleNumber,
        status: assignment.vehicleStatus,
        slot: assignment.slot,
      },
      trips: todayTrips,
      todayCount: todayTrips.length,
    });
  } catch (error) {
    console.error('[DRIVER_TRIPS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve trip history.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { idempotencyKey, completedAt } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency key is required.' }, { status: 400 });
    }

    // 1. Fetch fresh driver details to verify active status
    const [driver] = await db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, actor!.userId))
      .limit(1);

    if (!driver || driver.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Trip submission rejected. Driver account is not active.' },
        { status: 400 }
      );
    }

    // 2. Fetch driver's active vehicle assignment
    const [assignment] = await db
      .select({
        vehicleId: vehicleDriverAssignments.vehicleId,
        vehicleNumber: vehicles.vehicleNumber,
        vehicleStatus: vehicles.status,
      })
      .from(vehicleDriverAssignments)
      .innerJoin(vehicles, eq(vehicleDriverAssignments.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicleDriverAssignments.driverId, actor!.userId),
          isNull(vehicleDriverAssignments.endAt)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json(
        { error: 'Trip submission rejected. Driver is not currently assigned to any vehicle.' },
        { status: 400 }
      );
    }

    // 3. Verify vehicle status (must not be in breakdown/inactive)
    if (assignment.vehicleStatus === 'BREAKDOWN') {
      return NextResponse.json(
        { error: 'Trip submission rejected. Assigned vehicle is currently marked as BREAKDOWN.' },
        { status: 400 }
      );
    }
    if (assignment.vehicleStatus === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Trip submission rejected. Assigned vehicle is currently marked as INACTIVE.' },
        { status: 400 }
      );
    }

    // 4. Save trip (with idempotency handling)
    const tripCompletedTime = completedAt ? new Date(completedAt) : new Date();

    const [newTrip] = await db
      .insert(trips)
      .values({
        vehicleId: assignment.vehicleId,
        driverId: actor!.userId,
        completedAt: tripCompletedTime,
        idempotencyKey,
      })
      .onConflictDoNothing()
      .returning();

    if (!newTrip) {
      // Existed before, handle gracefully
      return NextResponse.json({
        success: true,
        duplicated: true,
        message: 'Trip was already recorded successfully.',
      });
    }

    // Log trip creation in audit logs
    await logAudit({
      actorUserId: actor!.userId,
      action: 'TRIP_REPORTED',
      entityType: 'trips',
      entityId: newTrip.id,
      metadata: {
        vehicleId: assignment.vehicleId,
        vehicleNumber: assignment.vehicleNumber,
        completedAt: tripCompletedTime.toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      duplicated: false,
      trip: newTrip,
    }, { status: 201 });
  } catch (error) {
    console.error('[DRIVER_TRIPS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to record trip.' }, { status: 500 });
  }
}
