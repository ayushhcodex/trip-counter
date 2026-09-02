import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  // Guard access to Super Admins only
  const { errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(req.url);
    const roleParam = url.searchParams.get('role');

    // Retrieve users list without hashes
    const allUsers = await db
      .select({
        id: users.id,
        usernameOrEmail: users.usernameOrEmail,
        name: users.name,
        phone: users.phone,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users);

    const filteredUsers = roleParam
      ? allUsers.filter((u) => u.role === roleParam)
      : allUsers;

    return NextResponse.json({ success: true, users: filteredUsers });
  } catch (error) {
    console.error('[SUPERADMIN_GET_USERS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve users.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { usernameOrEmail, name, phone, password, role, status } = body;

    if (!usernameOrEmail || !name || !password || !role) {
      return NextResponse.json(
        { error: 'Username/Email, name, password, and role are required fields.' },
        { status: 400 }
      );
    }

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'DRIVER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid user role specified.' }, { status: 400 });
    }

    // Check duplication
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.usernameOrEmail, usernameOrEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this Driver ID / Username already exists.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        usernameOrEmail,
        name,
        phone: phone || null,
        passwordHash,
        role: role as 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER',
        status: status || 'ACTIVE',
      })
      .returning({
        id: users.id,
        usernameOrEmail: users.usernameOrEmail,
        name: users.name,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      });

    // Write audit trail
    await logAudit({
      actorUserId: actor!.userId,
      action: 'USER_CREATED',
      entityType: 'users',
      entityId: newUser.id,
      metadata: { role: newUser.role, username: newUser.usernameOrEmail },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error('[SUPERADMIN_POST_USERS_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 });
  }
}
