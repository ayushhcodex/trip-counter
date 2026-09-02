import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tripAdjustmentAcknowledgements, tripAdjustments, notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { adjustmentId } = body;

    if (!adjustmentId) {
      return NextResponse.json({ error: 'Adjustment ID is required.' }, { status: 400 });
    }

    // 1. Verify target adjustment exists and belongs to the authenticated driver
    const [adjustment] = await db
      .select()
      .from(tripAdjustments)
      .where(
        and(
          eq(tripAdjustments.id, adjustmentId),
          eq(tripAdjustments.driverId, actor!.userId)
        )
      )
      .limit(1);

    if (!adjustment) {
      return NextResponse.json(
        { error: 'Trip adjustment not found or does not belong to you.' },
        { status: 404 }
      );
    }

    // 2. Perform updates in a transaction
    await db.transaction(async (tx) => {
      // A. Insert acknowledgment record
      await tx
        .insert(tripAdjustmentAcknowledgements)
        .values({
          adjustmentId,
          acknowledgedBy: actor!.userId,
          acknowledgedAt: new Date(),
        })
        .onConflictDoNothing(); // Prevent error on double acknowledgment

      // B. Find and update matching notifications to "read" status
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, actor!.userId),
            eq(notifications.relatedEntityId, adjustmentId)
          )
        );
    });

    // Write audit trail
    await logAudit({
      actorUserId: actor!.userId,
      action: 'ADJUSTMENT_ACKNOWLEDGED',
      entityType: 'trip_adjustments',
      entityId: adjustmentId,
      metadata: { vehicleId: adjustment.vehicleId, date: adjustment.date },
    });

    return NextResponse.json({ success: true, message: 'Adjustment acknowledged.' });
  } catch (error) {
    console.error('[DRIVER_ACKNOWLEDGE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to record acknowledgment.' }, { status: 500 });
  }
}
