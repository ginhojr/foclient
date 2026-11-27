import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAuditLog } from '../lib/audit';
import { prisma } from '../lib/prisma';
import { emitToTenant } from '../lib/socket';
import { authenticate } from '../middlewares/auth';
import { whatsAppManager } from '../providers/whatsapp/WhatsAppManager';
import { buildPixCopyPasteCode } from '../services/pix.service';
import {
  formatDateBR,
  mapPlanFromFrontend,
  mapPlanToFrontend,
  serializeConversation,
  serializeMessage,
} from '../services/serializer.service';

const PLAN_SPECS = {
  STARTER: { price: 197, usersLimit: 3, whatsappLimit: 1, aiInteractionsLimit: 1500 },
  GROWTH: { price: 397, usersLimit: 10, whatsappLimit: 2, aiInteractionsLimit: 5000 },
  SCALE: { price: 897, usersLimit: 30, whatsappLimit: 6, aiInteractionsLimit: 20000 },
} as const;

const updateSubscriptionSchema = z.object({
  tier: z.enum(['Starter', 'Growth', 'Scale']),
});

const generatePixSchema = z.object({
  conversationId: z.string().uuid(),
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
});

const webhookPixSchema = z.object({
  pixChargeId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/billing/subscription',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Financeiro & Pix'],
        summary: 'Retorna consumo da assinatura SaaS e extrato de faturas / Pix',
      },
    },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        include: {
          users: { select: { id: true } },
          whatsappInstances: true,
          billingInvoices: { orderBy: { issuedAt: 'desc' } },
        },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant não encontrado.' });
      }

      return reply.send({
        billing: {
          tier: mapPlanToFrontend(tenant.plan),
          monthlyPrice: tenant.mrr,
          usersUsed: Math.max(1, tenant.users.length),
          usersLimit: tenant.usersLimit,
          whatsappUsed: Math.max(
            1,
            tenant.whatsappInstances.filter((w) => w.status === 'CONNECTED').length || 1
          ),
          whatsappLimit: tenant.whatsappLimit,
          aiInteractionsUsed: tenant.aiInteractionsUsed,
          aiInteractionsLimit: tenant.aiInteractionsLimit,
          renewalDate: tenant.renewalDate,
        },
        invoices: tenant.billingInvoices.map((inv) => ({
          id: inv.id,
          date: formatDateBR(inv.issuedAt),
          description: inv.description,
          type: inv.type,
          clientOrRef: inv.clientOrRef,
          amount: inv.amount,
          status: inv.status,
        })),
      });
    }
  );

  app.patch(
    '/api/billing/subscription',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Financeiro & Pix'],
        summary: 'Altera plano da empresa (Starter / Growth / Scale) e atualiza franquias',
      },
    },
    async (request, reply) => {
      const parsed = updateSubscriptionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Plano inválido.' });
      }

      const planEnum = mapPlanFromFrontend(parsed.data.tier);
      const spec = PLAN_SPECS[planEnum];

      const updated = await prisma.tenant.update({
        where: { id: request.tenantId },
        data: {
          plan: planEnum,
          mrr: spec.price,
          usersLimit: spec.usersLimit,
          whatsappLimit: spec.whatsappLimit,
          aiInteractionsLimit: spec.aiInteractionsLimit,
        },
      });

      return reply.send({
        tier: mapPlanToFrontend(updated.plan),
        monthlyPrice: updated.mrr,
        usersLimit: updated.usersLimit,
        whatsappLimit: updated.whatsappLimit,
        aiInteractionsLimit: updated.aiInteractionsLimit,
      });
    }
  );

  app.post(
    '/api/pix/generate',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Financeiro & Pix'],
        summary: 'Gera cobrança Pix Copia e Cola, insere card no chat e dispara no WhatsApp real',
      },
    },
    async (request, reply) => {
      const parsed = generatePixSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Informe conversa, descrição e valor > 0.' });
      }

      const { conversationId, description, amount } = parsed.data;

      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, tenantId: request.tenantId },
        include: { contact: true, tenant: { include: { aiAgent: true } } },
      });

      if (!conv) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      const copyPasteCode = buildPixCopyPasteCode(
        conv.tenant.name,
        amount,
        `${Date.now()}`
      );

      const pixCharge = await prisma.pixCharge.create({
        data: {
          tenantId: request.tenantId,
          conversationId: conv.id,
          contactId: conv.contactId,
          description,
          amount,
          copyPasteCode,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const isBot = conv.status === 'BOT';
      const senderName = isBot
        ? conv.tenant.aiAgent?.name ?? 'Clara IA'
        : `${request.user?.name ?? 'Você'} (Atendente)`;
      const msgContent = `Cobrança Pix gerada para "${description}". Assim que o pagamento for efetuado, a confirmação aparece automaticamente aqui.`;

      // Also dispatch real WhatsApp message with Pix Copy-and-Paste if connected!
      let externalId: string | undefined;
      try {
        const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
        const formattedBRL = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(amount);
        const waPixText = `💳 *Cobrança Pix — ${conv.tenant.name}*\n📌 Descrição: ${description}\n💰 Valor: *${formattedBRL}*\n\nCopie e cole o código Pix abaixo no app do seu banco:\n\n${copyPasteCode}`;
        const sent = await provider.sendText(request.tenantId, conv.contact.phone, waPixText);
        externalId = sent.externalId;
      } catch (err) {
        console.warn('[Pix Generate] WhatsApp send skipped:', err);
      }

      const message = await prisma.message.create({
        data: {
          tenantId: request.tenantId,
          conversationId: conv.id,
          senderType: isBot ? 'AI' : 'AGENT',
          senderName,
          content: msgContent,
          externalId,
          pixChargeId: pixCharge.id,
        },
        include: { pixCharge: true },
      });

      await Promise.all([
        prisma.conversation.update({
          where: { id: conv.id },
          data: { lastMessageAt: new Date() },
        }),
        prisma.contact.update({
          where: { id: conv.contactId },
          data: { stage: 'aguardando_pagamento' },
        }),
        prisma.deal.updateMany({
          where: { contactId: conv.contactId, tenantId: request.tenantId },
          data: { stage: 'aguardando_pagamento', lastInteractionAt: new Date() },
        }),
      ]);

      const updatedConv = await prisma.conversation.findUnique({
        where: { id: conv.id },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const serializedMsg = serializeMessage(message);
      const serializedConv = updatedConv ? serializeConversation(updatedConv) : null;

      emitToTenant(request.tenantId, 'message:new', {
        tenantId: request.tenantId,
        conversationId: conv.id,
        conversation: serializedConv,
        message: serializedMsg,
      });

      return reply.status(201).send({
        pixCharge: serializedMsg.pix,
        message: serializedMsg,
        conversation: serializedConv,
      });
    }
  );

  app.post(
    '/api/pix/webhook',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Financeiro & Pix'],
        summary: 'Confirma pagamento Pix (Webhook/Simulação), avança CRM para Ganho e gera fatura',
      },
    },
    async (request, reply) => {
      const parsed = webhookPixSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload de confirmação Pix inválido.' });
      }

      const { pixChargeId, messageId } = parsed.data;

      let targetCharge = pixChargeId
        ? await prisma.pixCharge.findFirst({
            where: { id: pixChargeId, tenantId: request.tenantId },
            include: { contact: true, message: true },
          })
        : null;

      if (!targetCharge && messageId) {
        const msg = await prisma.message.findFirst({
          where: { id: messageId, tenantId: request.tenantId },
          include: { pixCharge: { include: { contact: true, message: true } } },
        });
        targetCharge = msg?.pixCharge ?? null;
      }

      if (!targetCharge) {
        return reply.status(404).send({ error: 'Cobrança Pix não localizada.' });
      }

      if (targetCharge.status === 'PAID') {
        return reply.send({ ok: true, alreadyPaid: true });
      }

      const now = new Date();
      const paidCharge = await prisma.pixCharge.update({
        where: { id: targetCharge.id },
        data: { status: 'PAID', paidAt: now },
      });

      const clientName = targetCharge.contact?.name ?? 'Cliente WhatsApp';

      const invoice = await prisma.billingInvoice.create({
        data: {
          tenantId: request.tenantId,
          description: `Pix recebido — ${targetCharge.description}`,
          type: 'Pix no Chat',
          clientOrRef: clientName,
          amount: targetCharge.amount,
          status: 'Pago',
          issuedAt: now,
        },
      });

      if (targetCharge.contactId) {
        await Promise.all([
          prisma.contact.update({
            where: { id: targetCharge.contactId },
            data: { stage: 'ganho' },
          }),
          prisma.deal.updateMany({
            where: { contactId: targetCharge.contactId, tenantId: request.tenantId },
            data: { stage: 'ganho', lastInteractionAt: now },
          }),
        ]);
      }

      // Append to tenant recentActivity
      const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId } });
      if (tenant) {
        const settings = (tenant.settings ?? {}) as Record<string, unknown>;
        const existingActs = Array.isArray(settings.recentActivity)
          ? settings.recentActivity
          : [];
        const newAct = {
          id: `act-${Date.now()}`,
          type: 'pix_confirmed',
          title: `Pix confirmado — ${clientName}`,
          subtitle: targetCharge.description,
          timestamp: 'Agora mesmo',
          amount: targetCharge.amount,
        };
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            settings: {
              ...settings,
              recentActivity: [newAct, ...existingActs.slice(0, 14)],
            } as Prisma.InputJsonValue,
          },
        });

        // Notify customer on WhatsApp if connected
        if (targetCharge.contact?.phone) {
          try {
            const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
            const formattedBRL = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(targetCharge.amount);
            await provider.sendText(
              request.tenantId,
              targetCharge.contact.phone,
              `✅ *Pagamento Pix Confirmado!*\nRecebemos seu Pix de *${formattedBRL}* referente a "${targetCharge.description}". Muito obrigado pela confiança na ${tenant.name}!`
            );
          } catch {
            // ignore if disconnected
          }
        }
      }

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'PIX_PAYMENT_CONFIRMED',
        entity: 'pix_charges',
        entityId: paidCharge.id,
        metadata: { amount: paidCharge.amount, description: paidCharge.description },
        ipAddress: request.ip,
      });

      const updatedConv = targetCharge.conversationId
        ? await prisma.conversation.findUnique({
            where: { id: targetCharge.conversationId },
            include: {
              messages: {
                include: { pixCharge: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          })
        : null;

      emitToTenant(request.tenantId, 'pix:confirmed', {
        tenantId: request.tenantId,
        pixChargeId: paidCharge.id,
        conversationId: targetCharge.conversationId,
        conversation: updatedConv ? serializeConversation(updatedConv) : null,
        invoice: {
          id: invoice.id,
          date: formatDateBR(invoice.issuedAt),
          description: invoice.description,
          type: invoice.type,
          clientOrRef: invoice.clientOrRef,
          amount: invoice.amount,
          status: invoice.status,
        },
      });

      return reply.send({
        ok: true,
        conversation: updatedConv ? serializeConversation(updatedConv) : null,
        invoice: {
          id: invoice.id,
          date: formatDateBR(invoice.issuedAt),
          description: invoice.description,
          type: invoice.type,
          clientOrRef: invoice.clientOrRef,
          amount: invoice.amount,
          status: invoice.status,
        },
      });
    }
  );
}
