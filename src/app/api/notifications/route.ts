import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';

export async function GET() {
  const { user: actor, errorResponse } = await checkAuth();
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, actor!.userId))
      .orderBy(desc(notifications.createdAt));

    return NextResponse.json({ success: true, notifications: list });
  } catch (error) {
    console.error('[NOTIFICATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve notifications.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { notificationId } = body;

    if (notificationId) {
      // Mark specific notification as read
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, actor!.userId)
          )
        );
    } else {
      // Mark all as read
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(eq(notifications.userId, actor!.userId));
    }

    return NextResponse.json({ success: true, message: 'Notifications updated.' });
  } catch (error) {
    console.error('[NOTIFICATIONS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
