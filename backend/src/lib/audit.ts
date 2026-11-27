import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function recordAuditLog(params: {
  tenantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}
