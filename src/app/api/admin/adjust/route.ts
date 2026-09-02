import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tripAdjustments, dailyVehicleVerifications, adminVehicleAssignments, trips, notifications } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getDateBoundaries } from '@/lib/timezone';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicleId, date, driverId, adjustment, reason } = body;

    if (!vehicleId || !date || !driverId || adjustment === undefined || !reason) {
      return NextResponse.json(
        { error: 'Vehicle ID, date, driver ID, adjustment quantity, and explanation reason are required.' },
        { status: 400 }
      );
    }

    if (adjustment === 0) {
      return NextResponse.json({ error: 'Adjustment quantity cannot be zero.' }, { status: 400 });
    }

    // 1. If ADMIN, assert they have permission for this vehicle
    if (actor!.role === 'ADMIN') {
      const [assigned] = await db
        .select()
        .from(adminVehicleAssignments)
        .where(
          and(
            eq(adminVehicleAssignments.adminId, actor!.userId),
            eq(adminVehicleAssignments.vehicleId, vehicleId)
          )
        )
        .limit(1);

      if (!assigned) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have permission to modify adjustments for this vehicle.' },
          { status: 403 }
        );
      }
    }

    // 2. Perform database updates in a transaction
    const result = await db.transaction(async (tx) => {
      // A. Insert adjustment record
      const [newAdjustment] = await tx
        .insert(tripAdjustments)
        .values({
          vehicleId,
          date,
          driverId,
          adminId: actor!.userId,
          adjustment,
          reason,
          createdAt: new Date(),
        })
        .returning();

      // B. Recalculate reported trips for vehicle on this date
      const { start, end } = getDateBoundaries(date);
      const [tripsCountResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(trips)
        .where(
          and(
            eq(trips.vehicleId, vehicleId),
            gte(trips.completedAt, start),
            lte(trips.completedAt, end)
          )
        );
      const reportedCount = tripsCountResult?.count || 0;

      // C. Recalculate adjustments total for vehicle on this date
      const [adjustmentsResult] = await tx
        .select({ sum: sql<number>`sum(adjustment)::int` })
        .from(tripAdjustments)
        .where(
          and(
            eq(tripAdjustments.vehicleId, vehicleId),
            eq(tripAdjustments.date, date)
          )
        );
      const adjustmentsSum = adjustmentsResult?.sum || 0;

      const finalCount = Math.max(0, reportedCount + adjustmentsSum);

      // D. Update or insert the verification summary, keeping status UNVERIFIED until re-approved
      await tx
        .insert(dailyVehicleVerifications)
        .values({
          vehicleId,
          date,
          reportedTripCount: reportedCount,
          adjustmentTotal: adjustmentsSum,
          verifiedTripCount: finalCount,
          status: 'UNVERIFIED',
          verifiedBy: actor!.userId,
          verifiedAt: new Date(),
          note: `Adjusted: ${adjustment > 0 ? '+' : ''}${adjustment} trips.`,
        })
        .onConflictDoUpdate({
          target: [dailyVehicleVerifications.vehicleId, dailyVehicleVerifications.date],
          set: {
            reportedTripCount: reportedCount,
            adjustmentTotal: adjustmentsSum,
            verifiedTripCount: finalCount,
            status: 'UNVERIFIED',
            verifiedBy: actor!.userId,
            verifiedAt: new Date(),
          },
        });

      // E. Insert a notification to inform the affected driver (Transparency)
      const adjustmentStr = adjustment > 0 ? `+${adjustment}` : `${adjustment}`;
      const [notification] = await tx
        .insert(notifications)
        .values({
          userId: driverId,
          type: 'TRIP_ADJUSTMENT',
          title: 'ADMIN UPDATED YOUR TRIP COUNT',
          message: `Date: ${date}\nAdmin adjustment: ${adjustmentStr}\nReason: ${reason}\nUpdated by: Admin`,
          relatedEntityId: newAdjustment.id,
          createdAt: new Date(),
        })
        .returning();

      return { newAdjustment, finalCount, notification };
    });

    // Write audit trail
    await logAudit({
      actorUserId: actor!.userId,
      action: 'TRIPS_ADJUSTED',
      entityType: 'trip_adjustments',
      entityId: result.newAdjustment.id,
      metadata: {
        vehicleId,
        date,
        driverId,
        adjustment,
        reason,
        finalCount: result.finalCount,
      },
    });

    return NextResponse.json({
      success: true,
      adjustment: result.newAdjustment,
    });
  } catch (error) {
    console.error('[TRIP_ADJUST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to record trip adjustment.' }, { status: 500 });
  }
}
