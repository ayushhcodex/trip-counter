import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dailyVehicleVerifications, adminVehicleAssignments, trips, tripAdjustments } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getDateBoundaries } from '@/lib/timezone';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { vehicleId, date, note } = body; // date is in YYYY-MM-DD format

    if (!vehicleId || !date) {
      return NextResponse.json({ error: 'Vehicle ID and verification date are required.' }, { status: 400 });
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
          { error: 'Forbidden. You do not have permission to verify this vehicle.' },
          { status: 403 }
        );
      }
    }

    // 2. Fetch driver reported count for this vehicle on this date
    const { start, end } = getDateBoundaries(date);
    const [tripsCountResult] = await db
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

    // 3. Fetch adjustments total for this vehicle on this date
    const [adjustmentsResult] = await db
      .select({ sum: sql<number>`sum(adjustment)::int` })
      .from(tripAdjustments)
      .where(
        and(
          eq(tripAdjustments.vehicleId, vehicleId),
          eq(tripAdjustments.date, date)
        )
      );
    const adjustmentsSum = adjustmentsResult?.sum || 0;

    const finalVerifiedCount = Math.max(0, reportedCount + adjustmentsSum);

    // 4. Upsert verification status in DB
    const [verification] = await db
      .insert(dailyVehicleVerifications)
      .values({
        vehicleId,
        date,
        reportedTripCount: reportedCount,
        adjustmentTotal: adjustmentsSum,
        verifiedTripCount: finalVerifiedCount,
        status: 'VERIFIED',
        verifiedBy: actor!.userId,
        verifiedAt: new Date(),
        note: note || null,
      })
      .onConflictDoUpdate({
        target: [dailyVehicleVerifications.vehicleId, dailyVehicleVerifications.date],
        set: {
          reportedTripCount: reportedCount,
          adjustmentTotal: adjustmentsSum,
          verifiedTripCount: finalVerifiedCount,
          status: 'VERIFIED',
          verifiedBy: actor!.userId,
          verifiedAt: new Date(),
          note: note || null,
        },
      })
      .returning();

    // Log the verification
    await logAudit({
      actorUserId: actor!.userId,
      action: 'DAILY_TRIPS_VERIFIED',
      entityType: 'daily_vehicle_verifications',
      entityId: verification.id,
      metadata: {
        vehicleId,
        date,
        reportedCount,
        adjustmentsSum,
        finalCount: finalVerifiedCount,
      },
    });

    return NextResponse.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error('[VEHICLE_VERIFY_ERROR]', error);
    return NextResponse.json({ error: 'Failed to verify daily vehicle trips.' }, { status: 500 });
  }
}
