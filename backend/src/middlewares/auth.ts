import { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';
import { JwtUserPayload, verifyAccessToken } from '../lib/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
    tenantId: string;
  }
}

/**
 * Multi-tenant authentication middleware.
 * Extracts `tenant_id` and `role` from the signed JWT and injects into `request`.
 * Only `SUPER_ADMIN` may inspect/impersonate another tenant via `x-tenant-id` header;
 * all other roles are strictly isolated to their JWT `tenantId`.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Token de autenticação ausente ou inválido.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;

    const headerTenantId = request.headers['x-tenant-id'];
    if (
      payload.role === 'SUPER_ADMIN' &&
      typeof headerTenantId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerTenantId)
    ) {
      request.tenantId = headerTenantId;
    } else {
      request.tenantId = payload.tenantId;
    }
  } catch {
    reply.status(401).send({ error: 'Sessão expirada ou token inválido.' });
  }
}

/**
 * RBAC Role Guard factory.
 */
export function requireRoles(...allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({ error: 'Não autenticado.' });
      return;
    }
    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({
        error: 'Acesso negado: perfil sem permissão para esta operação.',
        requiredRoles: allowedRoles,
        currentRole: request.user.role,
      });
    }
  };
}
