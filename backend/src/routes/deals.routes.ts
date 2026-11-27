import { CrmStage } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
  serializeContact,
  serializeDeal,
} from '../services/serializer.service';

const crmStageEnum = z.enum([
  'novo_lead',
  'qualificado_ia',
  'proposta_enviada',
  'aguardando_pagamento',
  'ganho',
]);

const createDealSchema = z.object({
  title: z.string().min(2),
  clientName: z.string().min(2),
  phone: z.string().optional().default('+55 (11) 99000-0000'),
  contactId: z.string().uuid().optional(),
  value: z.coerce.number().min(0).default(0),
  stage: crmStageEnum.default('novo_lead'),
  origin: z.string().optional().default('WhatsApp Direto'),
  tags: z.array(z.string()).optional().default(['Novo']),
});

const updateDealSchema = z.object({
  title: z.string().min(2).optional(),
  value: z.coerce.number().min(0).optional(),
  stage: crmStageEnum.optional(),
  origin: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const patchStageSchema = z.object({
  stage: crmStageEnum,
});

export async function dealsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/deals',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CRM Kanban'],
        summary: 'Lista oportunidades do funil Kanban do tenant',
      },
    },
    async (request, reply) => {
      const deals = await prisma.deal.findMany({
        where: { tenantId: request.tenantId },
        include: { contact: true },
        orderBy: { updatedAt: 'desc' },
      });

      return reply.send({ deals: deals.map(serializeDeal) });
    }
  );

  app.post(
    '/api/deals',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CRM Kanban'],
        summary: 'Cria novo negócio no Kanban e vincula/cria contato no banco Neon',
      },
    },
    async (request, reply) => {
      const parsed = createDealSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Dados do negócio inválidos.', details: parsed.error.flatten() });
      }

      const { title, clientName, phone, contactId, value, stage, origin, tags } = parsed.data;

      let contact = contactId
        ? await prisma.contact.findFirst({ where: { id: contactId, tenantId: request.tenantId } })
        : null;

      if (!contact) {
        const normPhone = normalizePhoneDigits(phone) || `55119${Date.now().toString().slice(-8)}`;
        contact = await prisma.contact.create({
          data: {
            tenantId: request.tenantId,
            name: clientName,
            phone: formatPhoneDisplay(normPhone),
            phoneNormalized: normPhone,
            email: `${clientName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '.')}@cliente.com.br`,
            stage: stage as CrmStage,
            tags: tags.length > 0 ? tags : ['Novo'],
            origin,
            lgpdConsent: true,
            lgpdConsentAt: new Date(),
            lgpdStatus: 'ativo',
          },
        });
      }

      const deal = await prisma.deal.create({
        data: {
          tenantId: request.tenantId,
          contactId: contact.id,
          title,
          value,
          stage: stage as CrmStage,
          tags: tags.length > 0 ? tags : ['Novo'],
          origin,
          lastInteractionAt: new Date(),
        },
        include: { contact: true },
      });

      return reply.status(201).send({
        deal: serializeDeal(deal),
        contact: serializeContact(contact),
      });
    }
  );

  app.put(
    '/api/deals/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CRM Kanban'],
        summary: 'Atualiza dados de um card do CRM Kanban',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateDealSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload inválido.' });
      }

      const existing = await prisma.deal.findFirst({
        where: { id, tenantId: request.tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Negócio não encontrado.' });
      }

      const updated = await prisma.deal.update({
        where: { id },
        data: {
          ...parsed.data,
          lastInteractionAt: new Date(),
        },
        include: { contact: true },
      });

      return reply.send({ deal: serializeDeal(updated) });
    }
  );

  app.patch(
    '/api/deals/:id/stage',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CRM Kanban'],
        summary: 'Move card entre etapas do funil Kanban e sincroniza o contato',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchStageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Etapa inválida.' });
      }

      const existing = await prisma.deal.findFirst({
        where: { id, tenantId: request.tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Negócio não encontrado.' });
      }

      const [updatedDeal] = await prisma.$transaction([
        prisma.deal.update({
          where: { id },
          data: {
            stage: parsed.data.stage as CrmStage,
            lastInteractionAt: new Date(),
          },
          include: { contact: true },
        }),
        prisma.contact.update({
          where: { id: existing.contactId },
          data: { stage: parsed.data.stage as CrmStage },
        }),
      ]);

      return reply.send({ deal: serializeDeal(updatedDeal) });
    }
  );

  app.delete(
    '/api/deals/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['CRM Kanban'],
        summary: 'Remove negócio do CRM Kanban',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.deal.findFirst({
        where: { id, tenantId: request.tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Negócio não encontrado.' });
      }

      await prisma.deal.delete({ where: { id } });
      return reply.send({ ok: true });
    }
  );
}
