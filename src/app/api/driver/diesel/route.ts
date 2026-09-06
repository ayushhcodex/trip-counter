import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDieselTable } from '@/db';
import { dieselEntries, vehicles, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { getLocalDateString } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER', 'ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    // Auto-create diesel table if it does not exist yet
    await ensureDieselTable();

    const url = new URL(req.url);
    const filterDriverId = url.searchParams.get('driverId');

    // Determine target driver ID
    let targetDriverId = actor!.userId;
    if ((actor!.role === 'ADMIN' || actor!.role === 'SUPER_ADMIN') && filterDriverId) {
      targetDriverId = filterDriverId;
    }

    // Build diesel query with left joins to prevent join dropouts
    const query = db
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
      .leftJoin(users, eq(dieselEntries.adminId, users.id));

    let entries: any[] = [];
    if (actor!.role === 'DRIVER') {
      entries = await query
        .where(eq(dieselEntries.driverId, targetDriverId))
        .orderBy(desc(dieselEntries.date), desc(dieselEntries.createdAt));
    } else if (filterDriverId) {
      entries = await query
        .where(eq(dieselEntries.driverId, targetDriverId))
        .orderBy(desc(dieselEntries.date), desc(dieselEntries.createdAt));
    } else {
      // SuperAdmin or Admin viewing entries without specific driver filter
      entries = await query
        .orderBy(desc(dieselEntries.date), desc(dieselEntries.createdAt))
        .limit(100);
    }

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
      if (e.date && e.date.startsWith(currentMonthStr)) {
        monthLitres += l;
      }
    }

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        ...e,
        adminName: e.adminName || 'Site Admin',
      })),
      metrics: {
        totalLitres: Math.round(totalLitres * 100) / 100,
        todayLitres: Math.round(todayLitres * 100) / 100,
        monthLitres: Math.round(monthLitres * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[DRIVER_DIESEL_GET_ERROR]', error);
    // Return empty state rather than 500 so UI never crashes or logs out
    return NextResponse.json({
      success: true,
      entries: [],
      metrics: { totalLitres: 0, todayLitres: 0, monthLitres: 0 },
    });
  }
}
