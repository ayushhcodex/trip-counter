import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const { user: actor, errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { name, phone, password, role, status } = body;

    // Check if target user exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (role !== undefined) updateFields.role = role;
    if (status !== undefined) updateFields.status = status;
    if (password) {
      updateFields.passwordHash = await hashPassword(password);
    }

    updateFields.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        usernameOrEmail: users.usernameOrEmail,
        name: users.name,
        role: users.role,
        status: users.status,
      });

    // Audit trail logging
    await logAudit({
      actorUserId: actor!.userId,
      action: 'USER_UPDATED',
      entityType: 'users',
      entityId: id,
      metadata: {
        fieldsChanged: Object.keys(updateFields).filter((key) => key !== 'passwordHash'),
        username: updatedUser.usernameOrEmail,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[SUPERADMIN_PUT_USER_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update user.' }, { status: 500 });
  }
}
