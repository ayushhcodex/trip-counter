import { NextResponse } from 'next/server';
import { db } from '@/db';
import { trips, tripAdjustments, tripAdjustmentAcknowledgements, users, vehicles } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getLocalDateString } from '@/lib/timezone';

export async function GET() {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    // 1. Fetch all trips for this driver
    const driverTrips = await db
      .select({
        id: trips.id,
        completedAt: trips.completedAt,
        vehicleNumber: vehicles.vehicleNumber,
      })
      .from(trips)
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.id))
      .where(eq(trips.driverId, actor!.userId))
      .orderBy(desc(trips.completedAt));

    // 2. Fetch all adjustments for this driver
    const adjustments = await db
      .select({
        id: tripAdjustments.id,
        date: tripAdjustments.date,
        adjustment: tripAdjustments.adjustment,
        reason: tripAdjustments.reason,
        createdAt: tripAdjustments.createdAt,
        adminName: users.name,
        acknowledgedAt: tripAdjustmentAcknowledgements.acknowledgedAt,
      })
      .from(tripAdjustments)
      .innerJoin(users, eq(tripAdjustments.adminId, users.id))
      .leftJoin(
        tripAdjustmentAcknowledgements,
        and(
          eq(tripAdjustments.id, tripAdjustmentAcknowledgements.adjustmentId),
          eq(tripAdjustmentAcknowledgements.acknowledgedBy, actor!.userId)
        )
      )
      .where(eq(tripAdjustments.driverId, actor!.userId))
      .orderBy(desc(tripAdjustments.createdAt));

    // 3. Group in-memory by local date string (YYYY-MM-DD)
    const groupedData: Record<string, {
      date: string;
      reportedCount: number;
      adjustmentCount: number;
      verifiedCount: number;
      trips: typeof driverTrips;
      adjustments: typeof adjustments;
    }> = {};

    // Group trips
    for (const trip of driverTrips) {
      const localDate = getLocalDateString(new Date(trip.completedAt));
      if (!groupedData[localDate]) {
        groupedData[localDate] = {
          date: localDate,
          reportedCount: 0,
          adjustmentCount: 0,
          verifiedCount: 0,
          trips: [],
          adjustments: [],
        };
      }
      groupedData[localDate].trips.push(trip);
      groupedData[localDate].reportedCount++;
    }

    // Group adjustments
    for (const adj of adjustments) {
      const localDate = adj.date; // already YYYY-MM-DD format from pg DATE
      if (!groupedData[localDate]) {
        groupedData[localDate] = {
          date: localDate,
          reportedCount: 0,
          adjustmentCount: 0,
          verifiedCount: 0,
          trips: [],
          adjustments: [],
        };
      }
      groupedData[localDate].adjustments.push(adj);
      groupedData[localDate].adjustmentCount += adj.adjustment;
    }

    // Sort dates descending and compile final payload
    const historyList = Object.values(groupedData).map((day) => {
      day.verifiedCount = Math.max(0, day.reportedCount + day.adjustmentCount);
      return day;
    }).sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      success: true,
      history: historyList,
    });
  } catch (error) {
    console.error('[DRIVER_TRIP_HISTORY_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve day-wise history.' }, { status: 500 });
  }
}
