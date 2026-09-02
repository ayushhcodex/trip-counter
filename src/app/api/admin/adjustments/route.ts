import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tripAdjustments, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(req.url);
    const vehicleId = url.searchParams.get('vehicleId');
    const date = url.searchParams.get('date');

    if (!vehicleId || !date) {
      return NextResponse.json(
        { error: 'Vehicle ID and date parameters are required.' },
        { status: 400 }
      );
    }

    const adjustments = await db
      .select({
        id: tripAdjustments.id,
        adjustment: tripAdjustments.adjustment,
        reason: tripAdjustments.reason,
        createdAt: tripAdjustments.createdAt,
        driverId: tripAdjustments.driverId,
        adminName: users.name,
      })
      .from(tripAdjustments)
      .innerJoin(users, eq(tripAdjustments.adminId, users.id))
      .where(
        and(
          eq(tripAdjustments.vehicleId, vehicleId),
          eq(tripAdjustments.date, date)
        )
      );

    return NextResponse.json({
      success: true,
      adjustments,
    });
  } catch (error) {
    console.error('[ADMIN_ADJUSTMENTS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve adjustments.' }, { status: 500 });
  }
}
