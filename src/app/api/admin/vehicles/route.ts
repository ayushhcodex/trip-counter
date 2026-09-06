import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicles, adminVehicleAssignments, vehicleDriverAssignments, users, trips, tripAdjustments, dailyVehicleVerifications } from '@/db/schema';
import { eq, and, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getDateBoundaries, getLocalDateString } from '@/lib/timezone';
import { getShiftInfo } from '@/lib/shifts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN']);
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
      targetVehicles = await db
        .select({
          id: vehicles.id,
          vehicleNumber: vehicles.vehicleNumber,
          status: vehicles.status,
          createdAt: vehicles.createdAt,
          updatedAt: vehicles.updatedAt,
        })
        .from(vehicles);
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

    if (!targetVehicles || targetVehicles.length === 0) {
      return NextResponse.json({
        success: true,
        dateRange: { start: startStr, end: endStr },
        vehicles: [],
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    const vehicleIds = targetVehicles.map((v) => v.id);

    // 3. Parallel batch fetching for all target vehicles
    const [
      activeAssignments,
      tripsGrouped,
      adjustmentsGrouped,
      verificationsList,
      tripDetailsList,
    ] = await Promise.all([
      // A. Active driver assignments
      db
        .select({
          vehicleId: vehicleDriverAssignments.vehicleId,
          slot: vehicleDriverAssignments.slot,
          driverId: users.id,
          driverName: users.name,
        })
        .from(vehicleDriverAssignments)
        .innerJoin(users, eq(vehicleDriverAssignments.driverId, users.id))
        .where(
          and(
            inArray(vehicleDriverAssignments.vehicleId, vehicleIds),
            isNull(vehicleDriverAssignments.endAt)
          )
        ),

      // B. Trips count grouped by vehicleId and driverId
      db
        .select({
          vehicleId: trips.vehicleId,
          driverId: trips.driverId,
          count: sql<number>`count(*)::int`,
        })
        .from(trips)
        .where(
          and(
            inArray(trips.vehicleId, vehicleIds),
            gte(trips.completedAt, startUTC),
            lte(trips.completedAt, endUTC)
          )
        )
        .groupBy(trips.vehicleId, trips.driverId),

      // C. Adjustments sum grouped by vehicleId
      db
        .select({
          vehicleId: tripAdjustments.vehicleId,
          sum: sql<number>`coalesce(sum(${tripAdjustments.adjustment}), 0)::int`,
        })
        .from(tripAdjustments)
        .where(
          and(
            inArray(tripAdjustments.vehicleId, vehicleIds),
            startStr === endStr
              ? eq(tripAdjustments.date, startStr)
              : and(gte(tripAdjustments.date, startStr), lte(tripAdjustments.date, endStr))
          )
        )
        .groupBy(tripAdjustments.vehicleId),

      // D. Verifications list (for single-day view)
      startStr === endStr
        ? db
            .select({
              vehicleId: dailyVehicleVerifications.vehicleId,
              status: dailyVehicleVerifications.status,
              verifiedBy: dailyVehicleVerifications.verifiedBy,
              verifiedAt: dailyVehicleVerifications.verifiedAt,
              reportedTripCount: dailyVehicleVerifications.reportedTripCount,
              adjustmentTotal: dailyVehicleVerifications.adjustmentTotal,
            })
            .from(dailyVehicleVerifications)
            .where(
              and(
                inArray(dailyVehicleVerifications.vehicleId, vehicleIds),
                eq(dailyVehicleVerifications.date, startStr)
              )
            )
        : Promise.resolve([]),

      // E. Individual trip records (for single-day accordion expansion)
      startStr === endStr
        ? db
            .select({
              id: trips.id,
              vehicleId: trips.vehicleId,
              driverId: trips.driverId,
              driverName: users.name,
              completedAt: trips.completedAt,
            })
            .from(trips)
            .innerJoin(users, eq(trips.driverId, users.id))
            .where(
              and(
                inArray(trips.vehicleId, vehicleIds),
                gte(trips.completedAt, startUTC),
                lte(trips.completedAt, endUTC)
              )
            )
            .orderBy(trips.completedAt)
        : Promise.resolve([]),
    ]);

    // Map active assignments by vehicleId
    const assignmentsByVehicle = new Map<
      string,
      {
        driver1: { id: string; name: string } | null;
        driver2: { id: string; name: string } | null;
      }
    >();
    for (const a of activeAssignments) {
      let entry = assignmentsByVehicle.get(a.vehicleId);
      if (!entry) {
        entry = { driver1: null, driver2: null };
        assignmentsByVehicle.set(a.vehicleId, entry);
      }
      if (a.slot === 1) {
        entry.driver1 = { id: a.driverId, name: a.driverName };
      } else if (a.slot === 2) {
        entry.driver2 = { id: a.driverId, name: a.driverName };
      }
    }

    // Map total trips per vehicle and trips per driver
    const vehicleTotalTrips = new Map<string, number>();
    const driverTripsMap = new Map<string, number>();
    for (const row of tripsGrouped) {
      const count = Number(row.count) || 0;
      const currentTotal = vehicleTotalTrips.get(row.vehicleId) || 0;
      vehicleTotalTrips.set(row.vehicleId, currentTotal + count);
      driverTripsMap.set(`${row.vehicleId}:${row.driverId}`, count);
    }

    // Map adjustments by vehicleId
    const adjustmentsByVehicle = new Map<string, number>();
    for (const row of adjustmentsGrouped) {
      adjustmentsByVehicle.set(row.vehicleId, Number(row.sum) || 0);
    }

    // Map verifications by vehicleId
    const verificationsByVehicle = new Map<string, (typeof verificationsList)[number]>();
    for (const v of verificationsList) {
      verificationsByVehicle.set(v.vehicleId, v);
    }

    // Map individual trip details by vehicleId (single-day only)
    const tripDetailsByVehicle = new Map<string, { id: string; driverId: string; driverName: string; completedAt: Date; shift: string }[]>();
    for (const t of tripDetailsList) {
      const shiftInfo = getShiftInfo(new Date(t.completedAt));
      const entry = {
        id: t.id,
        driverId: t.driverId,
        driverName: t.driverName,
        completedAt: t.completedAt,
        shift: shiftInfo.shiftName,
      };
      const existing = tripDetailsByVehicle.get(t.vehicleId);
      if (existing) {
        existing.push(entry);
      } else {
        tripDetailsByVehicle.set(t.vehicleId, [entry]);
      }
    }

    // 4. Populate statistics for each vehicle
    const vehicleStats = targetVehicles.map((vehicle) => {
      const assigned = assignmentsByVehicle.get(vehicle.id);
      const driver1 = assigned?.driver1 || null;
      const driver2 = assigned?.driver2 || null;

      const reportedCount = vehicleTotalTrips.get(vehicle.id) || 0;
      const driver1Trips = driver1 ? (driverTripsMap.get(`${vehicle.id}:${driver1.id}`) || 0) : 0;
      const driver2Trips = driver2 ? (driverTripsMap.get(`${vehicle.id}:${driver2.id}`) || 0) : 0;

      const adjustmentSum = adjustmentsByVehicle.get(vehicle.id) || 0;
      const verif = verificationsByVehicle.get(vehicle.id);

      // Check if the current reportedCount and adjustmentTotal match the verified snapshot.
      // If new trips were logged or adjustments changed, it requires re-verification.
      const isVerified = Boolean(
        verif &&
        verif.status === 'VERIFIED' &&
        verif.reportedTripCount === reportedCount &&
        verif.adjustmentTotal === adjustmentSum
      );

      const verificationStatus = isVerified ? 'VERIFIED' : 'UNVERIFIED';
      const verifiedBy = isVerified && verif ? verif.verifiedBy : null;
      const verifiedAt = isVerified && verif ? verif.verifiedAt : null;

      return {
        id: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        status: vehicle.status,
        reportedCount,
        adjustmentTotal: adjustmentSum,
        verifiedCount: Math.max(0, reportedCount + adjustmentSum),
        verificationStatus,
        verifiedBy,
        verifiedAt,
        driver1: driver1 ? { id: driver1.id, name: driver1.name, reportedCount: driver1Trips } : null,
        driver2: driver2 ? { id: driver2.id, name: driver2.name, reportedCount: driver2Trips } : null,
        trips: tripDetailsByVehicle.get(vehicle.id) || [],
      };
    });

    return NextResponse.json({
      success: true,
      dateRange: { start: startStr, end: endStr },
      vehicles: vehicleStats,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('[ADMIN_VEHICLES_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve vehicle stats.' }, { status: 500 });
  }
}
