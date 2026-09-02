import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, vehicleDriverAssignments, vehicles, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { trips: offlineTrips } = body;

    if (!offlineTrips || !Array.isArray(offlineTrips)) {
      return NextResponse.json({ error: 'Unsynced trips list is required.' }, { status: 400 });
    }

    if (offlineTrips.length === 0) {
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    // 1. Fetch fresh driver details to verify active status
    const [driver] = await db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, actor!.userId))
      .limit(1);

    if (!driver || driver.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Sync rejected. Driver account is not active.' },
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
        { error: 'Sync rejected. Driver is not assigned to any vehicle.' },
        { status: 400 }
      );
    }

    // 3. Verify vehicle status (must not be breakdown/inactive)
    if (assignment.vehicleStatus === 'BREAKDOWN') {
      return NextResponse.json(
        { error: 'Sync rejected. Assigned vehicle is currently marked as BREAKDOWN.' },
        { status: 400 }
      );
    }
    if (assignment.vehicleStatus === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Sync rejected. Assigned vehicle is currently marked as INACTIVE.' },
        { status: 400 }
      );
    }

    // 4. Batch transaction for inserting trips
    const processedCount = await db.transaction(async (tx) => {
      let insertedCount = 0;
      
      for (const trip of offlineTrips) {
        if (!trip.idempotencyKey || !trip.completedAt) continue;

        const [inserted] = await tx
          .insert(trips)
          .values({
            vehicleId: assignment.vehicleId,
            driverId: actor!.userId,
            completedAt: new Date(trip.completedAt),
            idempotencyKey: trip.idempotencyKey,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted) {
          insertedCount++;
        }
      }
      
      return insertedCount;
    });

    if (processedCount > 0) {
      // Log sync event in audit trail
      await logAudit({
        actorUserId: actor!.userId,
        action: 'TRIPS_SYNCED',
        entityType: 'trips',
        metadata: {
          vehicleId: assignment.vehicleId,
          vehicleNumber: assignment.vehicleNumber,
          countSynced: processedCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      processedCount,
    });
  } catch (error) {
    console.error('[TRIPS_SYNC_ERROR]', error);
    return NextResponse.json({ error: 'Failed to synchronize offline trips.' }, { status: 500 });
  }
}
