import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { comparePassword, setSessionCookie } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { usernameOrEmail, password } = body;

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { error: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    // Fetch user from DB
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.usernameOrEmail, usernameOrEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Check account activation status
    if (user.status === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Your account is deactivated. Contact an administrator.' },
        { status: 403 }
      );
    }

    // Compare passwords
    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Setup secure session cookie
    const sessionPayload = {
      userId: user.id,
      username: user.usernameOrEmail,
      role: user.role,
    };
    await setSessionCookie(sessionPayload);

    // Audit log this login event
    await logAudit({
      actorUserId: user.id,
      action: 'USER_LOGIN',
      entityType: 'users',
      entityId: user.id,
      metadata: { role: user.role },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        usernameOrEmail: user.usernameOrEmail,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('[LOGIN_API_ERROR]', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
