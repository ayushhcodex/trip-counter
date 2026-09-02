import { db } from '@/db';
import { auditLogs } from '@/db/schema';

interface AuditLogParams {
  actorUserId: string | null; // User making the change (null for system automated changes)
  action: string;             // Action name, e.g. 'DRIVER_ASSIGNED', 'TRIP_ADJUSTED'
  entityType: string;         // e.g. 'user', 'vehicle', 'trip', 'trip_adjustment'
  entityId?: string | null;   // ID of the target entity
  metadata?: Record<string, any> | null; // Extensible JSON metadata
}

/**
 * Persists an event to the audit_logs table.
 */
export async function logAudit({
  actorUserId,
  action,
  entityType,
  entityId = null,
  metadata = null,
}: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    // Fail silently in production or log to console so it does not block the main workflow transaction
    console.error('[AUDIT LOG ERROR] Failed to write audit log:', error);
  }
}
