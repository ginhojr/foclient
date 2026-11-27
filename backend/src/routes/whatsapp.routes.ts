import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAuditLog } from '../lib/audit';
import { encryptSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { whatsAppManager } from '../providers/whatsapp/WhatsAppManager';
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
} from '../services/serializer.service';

const sendDirectSchema = z.object({
  to: z.string().min(8),
  text: z.string().min(1),
});

const configureProviderSchema = z.object({
  provider: z.enum(['BAILEYS', 'OPENWA', 'META_CLOUD_API']),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
});

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/whatsapp/status',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['WhatsApp'],
        summary: 'Consulta status atual da instância WhatsApp e QR Code ativo',
      },
    },
    async (request, reply) => {
      const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
      const statusInfo = await provider.getStatus(request.tenantId);
      return reply.send(statusInfo);
    }
  );

  app.post(
    '/api/whatsapp/connect',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['WhatsApp'],
        summary: 'Inicia sessão WhatsApp Multi-Device para o tenant e gera QR Code em tempo real',
      },
    },
    async (request, reply) => {
      const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
      const statusInfo = await provider.connect(request.tenantId);

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'WHATSAPP_CONNECT_INIT',
        entity: 'whatsapp_instances',
        metadata: { provider: statusInfo.provider, status: statusInfo.status },
        ipAddress: request.ip,
      });

      return reply.send(statusInfo);
    }
  );

  app.post(
    '/api/whatsapp/disconnect',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['WhatsApp'],
        summary: 'Desconecta e encerra a sessão WhatsApp do tenant ativo',
      },
    },
    async (request, reply) => {
      const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
      await provider.disconnect(request.tenantId);

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'WHATSAPP_DISCONNECT',
        entity: 'whatsapp_instances',
        ipAddress: request.ip,
      });

      return reply.send({ status: 'DISCONNECTED', message: 'Sessão WhatsApp desconectada.' });
    }
  );

  app.post(
    '/api/whatsapp/send',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['WhatsApp'],
        summary: 'Dispara mensagem direta para um número no WhatsApp e registra na Inbox',
      },
    },
    async (request, reply) => {
      const parsed = sendDirectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Informe número de destino (to) e texto (text).' });
      }

      const { to, text } = parsed.data;
      const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
      const sent = await provider.sendText(request.tenantId, to, text);

      const normalized = normalizePhoneDigits(to);
      if (normalized) {
        let contact = await prisma.contact.findFirst({
          where: { tenantId: request.tenantId, phoneNormalized: normalized },
        });
        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              tenantId: request.tenantId,
              name: formatPhoneDisplay(normalized),
              phone: formatPhoneDisplay(normalized),
              phoneNormalized: normalized,
              origin: 'Disparo Ativo Painel',
              tags: ['WhatsApp Ativo'],
              lgpdConsent: true,
              lgpdConsentAt: new Date(),
            },
          });
        }

        let conv = await prisma.conversation.findFirst({
          where: { tenantId: request.tenantId, contactId: contact.id },
        });
        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              tenantId: request.tenantId,
              contactId: contact.id,
              status: 'OPEN',
              unreadCount: 0,
              channel: 'WhatsApp Oficial',
            },
          });
        }

        await prisma.message.create({
          data: {
            tenantId: request.tenantId,
            conversationId: conv.id,
            senderType: 'AGENT',
            senderName: request.user?.name ?? 'Atendente',
            content: text,
            externalId: sent.externalId,
          },
        });
      }

      return reply.send({
        ok: true,
        ...sent,
      });
    }
  );

  app.patch(
    '/api/whatsapp/provider',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['WhatsApp'],
        summary: 'Alterna Strategy Provider (BAILEYS <-> META_CLOUD_API) com criptografia AES-256',
      },
    },
    async (request, reply) => {
      const parsed = configureProviderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Configuração de provider inválida.' });
      }

      const { provider, phoneNumberId, accessToken, displayPhoneNumber } = parsed.data;

      const encryptedSession =
        provider === 'META_CLOUD_API' && phoneNumberId && accessToken
          ? encryptSecret(JSON.stringify({ phoneNumberId, accessToken, displayPhoneNumber }))
          : undefined;

      const instance = await prisma.whatsAppInstance.upsert({
        where: {
          tenantId_name: {
            tenantId: request.tenantId,
            name: 'Canal Principal',
          },
        },
        update: {
          provider: provider === 'OPENWA' ? 'BAILEYS' : provider,
          phoneNumber: displayPhoneNumber ?? undefined,
          encryptedSession: encryptedSession ?? undefined,
        },
        create: {
          tenantId: request.tenantId,
          name: 'Canal Principal',
          provider: provider === 'OPENWA' ? 'BAILEYS' : provider,
          status: 'DISCONNECTED',
          phoneNumber: displayPhoneNumber ?? null,
          encryptedSession: encryptedSession ?? null,
        },
      });

      return reply.send({
        id: instance.id,
        provider: instance.provider,
        status: instance.status,
      });
    }
  );
}
