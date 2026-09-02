import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';

export async function GET() {
  const { errorResponse } = await checkAuth(['SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const list = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
        actorUsername: users.usernameOrEmail,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100); // return latest 100 entries for performance

    return NextResponse.json({
      success: true,
      logs: list,
    });
  } catch (error) {
    console.error('[AUDIT_LOGS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve audit logs.' }, { status: 500 });
  }
}
