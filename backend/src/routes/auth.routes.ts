import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAuditLog } from '../lib/audit';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { authenticate, requireRoles } from '../middlewares/auth';
import { serializeFullTenant } from '../services/serializer.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const registerSchema = z.object({
  companyName: z.string().min(2),
  segment: z.string().optional().default('Comercial & Atendimento'),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const switchTenantSchema = z.object({
  tenantId: z.string().uuid(),
});

const FULL_TENANT_INCLUDE = {
  contacts: { orderBy: { createdAt: 'desc' as const } },
  conversations: {
    orderBy: { lastMessageAt: 'desc' as const },
    include: {
      messages: {
        include: { pixCharge: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  deals: {
    include: { contact: true },
    orderBy: { updatedAt: 'desc' as const },
  },
  aiAgent: true,
  billingInvoices: { orderBy: { issuedAt: 'desc' as const } },
  users: { select: { id: true } },
  whatsappInstances: true,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Autenticação multi-tenant (JWT + Refresh Token)',
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Credenciais inválidas.', details: parsed.error.flatten() });
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { tenant: true },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      const accessToken = signAccessToken({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      });

      const refreshToken = signRefreshToken({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });

      const refreshTokenHash = await bcrypt.hash(refreshToken, 8);
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash },
      });

      await recordAuditLog({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'AUTH_LOGIN',
        entity: 'users',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
        ipAddress: request.ip,
      });

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
      });
    }
  );

  app.post(
    '/api/auth/register',
    {
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Cadastro de nova empresa (Tenant) + Administrador',
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Dados inválidos no cadastro.', details: parsed.error.flatten() });
      }

      const { companyName, segment, name, email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return reply.status(409).send({ error: 'Este e-mail já está em uso.' });
      }

      const baseSlug = companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = `${baseSlug || 'empresa'}-${Date.now().toString().slice(-4)}`;
      const passwordHash = await bcrypt.hash(password, 10);

      const tenant = await prisma.tenant.create({
        data: {
          slug,
          name: companyName,
          segment,
          plan: 'GROWTH',
          status: 'TRIAL',
          mrr: 397,
          usersLimit: 10,
          whatsappLimit: 2,
          aiInteractionsLimit: 5000,
          aiAgent: {
            create: {
              name: 'Clara IA',
              roleTitle: `Especialista Digital — ${companyName}`,
              tone: 'Consultivo',
              systemPrompt: `Você é o agente comercial inteligente da ${companyName} (${segment}). Qualifique leads, responda dúvidas com clareza e ofereça pagamento via Pix quando o cliente desejar fechar.`,
            },
          },
          whatsappInstances: {
            create: {
              name: 'Canal Principal',
              provider: 'BAILEYS',
              status: 'DISCONNECTED',
            },
          },
        },
      });

      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name,
          email: normalizedEmail,
          passwordHash,
          role: 'TENANT_ADMIN',
        },
      });

      const accessToken = signAccessToken({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
        email: user.email,
        name: user.name,
      });

      const refreshToken = signRefreshToken({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
      });

      await recordAuditLog({
        tenantId: tenant.id,
        userId: user.id,
        action: 'TENANT_REGISTER',
        entity: 'tenants',
        entityId: tenant.id,
        metadata: { companyName, email: user.email },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: tenant.id,
          tenantName: tenant.name,
        },
      });
    }
  );

  app.post(
    '/api/auth/refresh',
    {
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Renova Access Token via Refresh Token',
      },
    },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Refresh token obrigatório.' });
      }

      try {
        const decoded = verifyRefreshToken(parsed.data.refreshToken);
        const user = await prisma.user.findUnique({
          where: { id: decoded.sub },
          include: { tenant: true },
        });
        if (!user || !user.isActive) {
          return reply.status(401).send({ error: 'Usuário inválido.' });
        }

        const accessToken = signAccessToken({
          sub: user.id,
          tenantId: decoded.tenantId,
          role: user.role,
          email: user.email,
          name: user.name,
        });

        return reply.send({ accessToken });
      } catch {
        return reply.status(401).send({ error: 'Refresh token expirado ou inválido.' });
      }
    }
  );

  app.get(
    '/api/auth/me',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Retorna usuário logado e contexto multi-tenant atual',
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.sub },
        include: { tenant: true },
      });
      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado.' });
      }

      return reply.send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: request.tenantId,
          homeTenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
      });
    }
  );

  app.get(
    '/api/tenants',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Lista empresas (todas para SUPER_ADMIN; apenas a própria para demais perfis)',
      },
    },
    async (request, reply) => {
      const isSuperAdmin = request.user!.role === 'SUPER_ADMIN';

      const tenants = await prisma.tenant.findMany({
        where: isSuperAdmin ? undefined : { id: request.user!.tenantId },
        include: FULL_TENANT_INCLUDE,
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        tenants: tenants.map(serializeFullTenant),
        activeTenantId: request.tenantId,
      });
    }
  );

  app.post(
    '/api/tenants/switch',
    {
      preHandler: [authenticate, requireRoles('SUPER_ADMIN')],
      schema: {
        tags: ['Auth & Tenants'],
        summary: 'Alterna empresa ativa (Impersonation exclusivo para SUPER_ADMIN)',
      },
    },
    async (request, reply) => {
      const parsed = switchTenantSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'tenantId inválido.' });
      }

      const target = await prisma.tenant.findUnique({
        where: { id: parsed.data.tenantId },
        include: FULL_TENANT_INCLUDE,
      });

      if (!target) {
        return reply.status(404).send({ error: 'Empresa não encontrada.' });
      }

      const accessToken = signAccessToken({
        sub: request.user!.sub,
        tenantId: target.id,
        role: request.user!.role,
        email: request.user!.email,
        name: request.user!.name,
      });

      await recordAuditLog({
        tenantId: target.id,
        userId: request.user!.sub,
        action: 'SUPER_ADMIN_TENANT_SWITCH',
        entity: 'tenants',
        entityId: target.id,
        metadata: { targetTenantName: target.name },
        ipAddress: request.ip,
      });

      return reply.send({
        accessToken,
        tenant: serializeFullTenant(target),
      });
    }
  );
}
