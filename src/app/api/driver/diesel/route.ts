import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dieselEntries, vehicles, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getLocalDateString } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const driverId = actor!.userId;

    // Query diesel entries for driver
    const entries = await db
      .select({
        id: dieselEntries.id,
        date: dieselEntries.date,
        litres: dieselEntries.litres,
        notes: dieselEntries.notes,
        createdAt: dieselEntries.createdAt,
        vehicleNumber: vehicles.vehicleNumber,
        adminName: users.name,
      })
      .from(dieselEntries)
      .leftJoin(vehicles, eq(dieselEntries.vehicleId, vehicles.id))
      .innerJoin(users, eq(dieselEntries.adminId, users.id))
      .where(eq(dieselEntries.driverId, driverId))
      .orderBy(desc(dieselEntries.date), desc(dieselEntries.createdAt));

    // Calculate metrics
    const todayStr = getLocalDateString(new Date());
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    let totalLitres = 0;
    let todayLitres = 0;
    let monthLitres = 0;

    for (const e of entries) {
      const l = parseFloat(e.litres || '0');
      totalLitres += l;
      if (e.date === todayStr) {
        todayLitres += l;
      }
      if (e.date.startsWith(currentMonthStr)) {
        monthLitres += l;
      }
    }

    return NextResponse.json({
      success: true,
      entries,
      metrics: {
        totalLitres: Math.round(totalLitres * 100) / 100,
        todayLitres: Math.round(todayLitres * 100) / 100,
        monthLitres: Math.round(monthLitres * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[DRIVER_DIESEL_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve diesel log entries.' },
      { status: 500 }
    );
  }
}
