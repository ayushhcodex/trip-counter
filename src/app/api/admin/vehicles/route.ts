import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicles, adminVehicleAssignments, vehicleDriverAssignments, users, trips, tripAdjustments, dailyVehicleVerifications } from '@/db/schema';
import { eq, and, gte, lte, isNull, sql } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getDateBoundaries, getLocalDateString } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || 'today';
    const startDateParam = url.searchParams.get('startDate'); // YYYY-MM-DD
    const endDateParam = url.searchParams.get('endDate');     // YYYY-MM-DD

    // 1. Resolve date boundaries
    const todayStr = getLocalDateString(new Date());
    let startStr = todayStr;
    let endStr = todayStr;

    if (range === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      startStr = yesterdayStr;
      endStr = yesterdayStr;
    } else if (range === 'week') {
      const now = new Date();
      const currentDay = now.getDay();
      const distance = currentDay === 0 ? 6 : currentDay - 1; // Monday start
      const monday = new Date(now);
      monday.setDate(now.getDate() - distance);
      startStr = getLocalDateString(monday);
      endStr = todayStr;
    } else if (range === 'month') {
      const firstDay = new Date();
      firstDay.setDate(1);
      startStr = getLocalDateString(firstDay);
      endStr = todayStr;
    } else if (range === 'custom' && startDateParam && endDateParam) {
      startStr = startDateParam;
      endStr = endDateParam;
    }

    const { start: startUTC } = getDateBoundaries(startStr);
    const { end: endUTC } = getDateBoundaries(endStr);

    // 2. Fetch accessible vehicles for the actor
    let targetVehicles;
    if (actor!.role === 'SUPER_ADMIN') {
      targetVehicles = await db.select().from(vehicles);
    } else {
      targetVehicles = await db
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
    }

    const vehicleStats = [];

    // 3. Populate statistics for each vehicle
    for (const vehicle of targetVehicles) {
      // A. Get active drivers currently assigned to this vehicle
      const activeAssignments = await db
        .select({
          slot: vehicleDriverAssignments.slot,
          driverId: users.id,
          driverName: users.name,
        })
        .from(vehicleDriverAssignments)
        .innerJoin(users, eq(vehicleDriverAssignments.driverId, users.id))
        .where(
          and(
            eq(vehicleDriverAssignments.vehicleId, vehicle.id),
            isNull(vehicleDriverAssignments.endAt)
          )
        );

      const driver1 = activeAssignments.find((a) => a.slot === 1);
      const driver2 = activeAssignments.find((a) => a.slot === 2);

      // B. Count reported trips in range
      const [tripsResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(trips)
        .where(
          and(
            eq(trips.vehicleId, vehicle.id),
            gte(trips.completedAt, startUTC),
            lte(trips.completedAt, endUTC)
          )
        );
      const reportedCount = tripsResult?.count || 0;

      // C. Count reported trips split by driver for additional dashboard breakdown
      const driver1Trips = driver1
        ? (await db
            .select({ count: sql<number>`count(*)::int` })
            .from(trips)
            .where(
              and(
                eq(trips.vehicleId, vehicle.id),
                eq(trips.driverId, driver1.driverId),
                gte(trips.completedAt, startUTC),
                lte(trips.completedAt, endUTC)
              )
            ))[0]?.count || 0
        : 0;

      const driver2Trips = driver2
        ? (await db
            .select({ count: sql<number>`count(*)::int` })
            .from(trips)
            .where(
              and(
                eq(trips.vehicleId, vehicle.id),
                eq(trips.driverId, driver2.driverId),
                gte(trips.completedAt, startUTC),
                lte(trips.completedAt, endUTC)
              )
            ))[0]?.count || 0
        : 0;

      // D. Sum adjustments in range
      // For a single day, adjustments can be matched by YYYY-MM-DD
      // For a multi-day range, we must filter between dates
      let adjustmentSum = 0;
      if (startStr === endStr) {
        // Single day optimization
        const [adjResult] = await db
          .select({ sum: sql<number>`sum(adjustment)::int` })
          .from(tripAdjustments)
          .where(
            and(
              eq(tripAdjustments.vehicleId, vehicle.id),
              eq(tripAdjustments.date, startStr)
            )
          );
        adjustmentSum = adjResult?.sum || 0;
      } else {
        // Date range
        const [adjResult] = await db
          .select({ sum: sql<number>`sum(adjustment)::int` })
          .from(tripAdjustments)
          .where(
            and(
              eq(tripAdjustments.vehicleId, vehicle.id),
              gte(tripAdjustments.date, startStr),
              lte(tripAdjustments.date, endStr)
            )
          );
        adjustmentSum = adjResult?.sum || 0;
      }

      // E. Check daily verification status (applicable mostly for single-day views)
      let verificationStatus = 'UNVERIFIED';
      let verifiedBy = null;
      let verifiedAt = null;

      if (startStr === endStr) {
        const [verif] = await db
          .select()
          .from(dailyVehicleVerifications)
          .where(
            and(
              eq(dailyVehicleVerifications.vehicleId, vehicle.id),
              eq(dailyVehicleVerifications.date, startStr)
            )
          )
          .limit(1);

        if (verif) {
          verificationStatus = verif.status;
          verifiedBy = verif.verifiedBy;
          verifiedAt = verif.verifiedAt;
        }
      }

      vehicleStats.push({
        id: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        status: vehicle.status,
        reportedCount,
        adjustmentTotal: adjustmentSum,
        verifiedCount: Math.max(0, reportedCount + adjustmentSum),
        verificationStatus,
        verifiedBy,
        verifiedAt,
        driver1: driver1 ? { id: driver1.driverId, name: driver1.driverName, reportedCount: driver1Trips } : null,
        driver2: driver2 ? { id: driver2.driverId, name: driver2.driverName, reportedCount: driver2Trips } : null,
      });
    }

    return NextResponse.json({
      success: true,
      dateRange: { start: startStr, end: endStr },
      vehicles: vehicleStats,
    });
  } catch (error) {
    console.error('[ADMIN_VEHICLES_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve vehicle stats.' }, { status: 500 });
  }
}
