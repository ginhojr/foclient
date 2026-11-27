import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { emitToTenant } from '../lib/socket';
import { authenticate } from '../middlewares/auth';
import { whatsAppManager } from '../providers/whatsapp/WhatsAppManager';
import {
  serializeConversation,
  serializeMessage,
} from '../services/serializer.service';

const sendMessageSchema = z.object({
  content: z.string().min(1),
  mode: z.enum(['client_reply', 'internal_note']).default('client_reply'),
});

const openContactSchema = z.object({
  contactId: z.string().uuid(),
});

const handoffSchema = z.object({
  aiActive: z.boolean().optional(),
});

export async function conversationsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/conversations',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Inbox & Chat'],
        summary: 'Lista todas as conversas do tenant com mensagens e status de IA',
      },
    },
    async (request, reply) => {
      const conversations = await prisma.conversation.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return reply.send({
        conversations: conversations.map(serializeConversation),
      });
    }
  );

  app.post(
    '/api/conversations/open',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Inbox & Chat'],
        summary: 'Localiza ou inicia uma conversa para um contato específico',
      },
    },
    async (request, reply) => {
      const parsed = openContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'contactId inválido.' });
      }

      const { contactId } = parsed.data;
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, tenantId: request.tenantId },
      });

      if (!contact) {
        return reply.status(404).send({ error: 'Contato não encontrado neste tenant.' });
      }

      let conv = await prisma.conversation.findFirst({
        where: { tenantId: request.tenantId, contactId },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            tenantId: request.tenantId,
            contactId,
            status: 'OPEN',
            unreadCount: 0,
            channel: 'WhatsApp Oficial',
            aiSummary: `Conversa iniciada manualmente pelo painel para ${contact.name} (${contact.origin}).`,
            messages: {
              create: {
                tenantId: request.tenantId,
                senderType: 'INTERNAL_NOTE',
                senderName: 'Sistema FOCLIENT',
                content: `Canal WhatsApp pronto para iniciar conversa ativa com ${contact.name} (${contact.phone}).`,
              },
            },
          },
          include: {
            messages: {
              include: { pixCharge: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      }

      return reply.send({ conversation: serializeConversation(conv) });
    }
  );

  app.get(
    '/api/conversations/:id/messages',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Inbox & Chat'],
        summary: 'Retorna histórico completo de mensagens da conversa e zera não-lidas',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const conv = await prisma.conversation.findFirst({
        where: { id, tenantId: request.tenantId },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conv) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      if (conv.unreadCount > 0) {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { unreadCount: 0 },
        });
      }

      return reply.send({
        conversationId: conv.id,
        messages: conv.messages.map(serializeMessage),
      });
    }
  );

  app.post(
    '/api/conversations/:id/messages',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Inbox & Chat'],
        summary: 'Envia mensagem pela Inbox (salva no Neon e dispara no WhatsApp real)',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Mensagem inválida.' });
      }

      const conv = await prisma.conversation.findFirst({
        where: { id, tenantId: request.tenantId },
        include: { contact: true },
      });

      if (!conv) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      const { content, mode } = parsed.data;
      const isNote = mode === 'internal_note';
      let externalId: string | undefined;
      let deliveredVia = 'internal-note';

      // Dispatch to real WhatsApp if replying to client!
      if (!isNote) {
        try {
          const provider = await whatsAppManager.getProviderForTenant(request.tenantId);
          const sent = await provider.sendText(request.tenantId, conv.contact.phone, content.trim());
          externalId = sent.externalId;
          deliveredVia = sent.deliveredVia;
        } catch (err: any) {
          console.warn('[Inbox Send] WhatsApp dispatch warning:', err?.message || err);
        }
      }

      const senderName = isNote
        ? `${request.user?.name ?? 'Atendente'} (Nota Interna)`
        : `${request.user?.name ?? 'Você'} (Atendente)`;

      const message = await prisma.message.create({
        data: {
          tenantId: request.tenantId,
          conversationId: conv.id,
          senderType: isNote ? 'INTERNAL_NOTE' : 'AGENT',
          senderName,
          content: content.trim(),
          externalId,
        },
        include: { pixCharge: true },
      });

      const nextStatus = !isNote ? 'OPEN' : conv.status;
      const updatedConv = await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          status: nextStatus,
          unreadCount: 0,
          assignedUserId: request.user?.sub,
          lastMessageAt: new Date(),
        },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const serializedMsg = serializeMessage(message);
      const serializedConv = serializeConversation(updatedConv);

      emitToTenant(request.tenantId, 'message:new', {
        tenantId: request.tenantId,
        conversationId: conv.id,
        conversation: serializedConv,
        message: serializedMsg,
      });

      return reply.status(201).send({
        message: serializedMsg,
        conversation: serializedConv,
        deliveredVia,
      });
    }
  );

  app.post(
    '/api/conversations/:id/handoff',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Inbox & Chat'],
        summary: 'Alterna conversa entre Agente de IA (BOT) e Atendimento Humano (OPEN)',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = handoffSchema.safeParse(request.body ?? {});

      const conv = await prisma.conversation.findFirst({
        where: { id, tenantId: request.tenantId },
        include: { contact: true },
      });

      if (!conv) {
        return reply.status(404).send({ error: 'Conversa não encontrada.' });
      }

      const aiAgent = await prisma.aIAgent.findUnique({
        where: { tenantId: request.tenantId },
      });
      const agentName = aiAgent?.name ?? 'Clara IA';

      const targetAiActive =
        parsed.success && parsed.data.aiActive !== undefined
          ? parsed.data.aiActive
          : conv.status !== 'BOT';

      const nextStatus = targetAiActive ? 'BOT' : 'OPEN';
      const noteText = targetAiActive
        ? `Conversa devolvida para o agente ${agentName}.`
        : `Atendimento assumido manualmente por ${request.user?.name ?? 'atendente humano'}.`;

      await prisma.message.create({
        data: {
          tenantId: request.tenantId,
          conversationId: conv.id,
          senderType: 'INTERNAL_NOTE',
          senderName: 'Controle de Atendimento',
          content: noteText,
        },
      });

      const updated = await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          status: nextStatus,
          assignedUserId: targetAiActive ? null : request.user?.sub,
          lastMessageAt: new Date(),
        },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const serializedConv = serializeConversation(updated);

      emitToTenant(request.tenantId, 'conversation:handoff', {
        tenantId: request.tenantId,
        conversationId: conv.id,
        aiActive: targetAiActive,
        conversation: serializedConv,
      });

      return reply.send({
        aiActive: targetAiActive,
        conversation: serializedConv,
      });
    }
  );
}
