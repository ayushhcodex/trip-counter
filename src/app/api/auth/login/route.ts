import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { comparePassword, setSessionCookie } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { usernameOrEmail, password } = body;

    const cleanInput = (usernameOrEmail || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanInput || !cleanPassword) {
      return NextResponse.json(
        { error: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch user from DB case-insensitively
    let [user] = await db
      .select()
      .from(users)
      .where(ilike(users.usernameOrEmail, cleanInput))
      .limit(1);

    // If not found and looks like driver ID (e.g. drv1, drv01, drv001, drv0001)
    if (!user) {
      const match = cleanInput.match(/^drv0*(\d+)$/i);
      if (match) {
        const num = match[1];
        const pad3 = `drv${num.padStart(3, '0')}`;
        const pad4 = `drv${num.padStart(4, '0')}`;
        const candidates = await db
          .select()
          .from(users)
          .where(ilike(users.usernameOrEmail, pad3))
          .limit(1);
        if (candidates.length > 0) {
          user = candidates[0];
        } else {
          const candidates4 = await db
            .select()
            .from(users)
            .where(ilike(users.usernameOrEmail, pad4))
            .limit(1);
          if (candidates4.length > 0) {
            user = candidates4[0];
          }
        }
      }
    }

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

    // Compare passwords (also check case-corrected Trip@ if user typed lowercase trip@)
    let passwordMatch = await comparePassword(cleanPassword, user.passwordHash);
    if (!passwordMatch && cleanPassword.toLowerCase().startsWith('trip@')) {
      const corrected = 'Trip@' + cleanPassword.slice(5);
      passwordMatch = await comparePassword(corrected, user.passwordHash);
    }

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
