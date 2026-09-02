import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST() {
  try {
    const user = await getSession();
    if (user) {
      await logAudit({
        actorUserId: user.userId,
        action: 'USER_LOGOUT',
        entityType: 'users',
        entityId: user.userId,
      });
    }

    await clearSession();

    return NextResponse.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('[LOGOUT_API_ERROR]', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
