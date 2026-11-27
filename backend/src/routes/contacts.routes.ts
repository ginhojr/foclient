import { CrmStage, LgpdStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAuditLog } from '../lib/audit';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
  serializeContact,
} from '../services/serializer.service';

const createContactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().optional().default(''),
  stage: z
    .enum([
      'novo_lead',
      'qualificado_ia',
      'proposta_enviada',
      'aguardando_pagamento',
      'ganho',
    ])
    .optional()
    .default('novo_lead'),
  tags: z.array(z.string()).optional().default([]),
  origin: z.string().optional().default('Cadastro Manual'),
  lgpdConsent: z.boolean().optional().default(true),
});

const patchContactSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  stage: z
    .enum([
      'novo_lead',
      'qualificado_ia',
      'proposta_enviada',
      'aguardando_pagamento',
      'ganho',
    ])
    .optional(),
  tags: z.array(z.string()).optional(),
  lgpdStatus: z.enum(['ativo', 'opt_out', 'anonimizado']).optional(),
});

const importContactsSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().min(6),
      email: z.string().optional().default(''),
      tag: z.string().optional().default('Importado CSV'),
    })
  ),
});

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/contacts',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Lista e filtra contatos do tenant com status LGPD',
      },
    },
    async (request, reply) => {
      const { q, tag, stage } = request.query as {
        q?: string;
        tag?: string;
        stage?: CrmStage;
      };

      const contacts = await prisma.contact.findMany({
        where: {
          tenantId: request.tenantId,
          ...(stage ? { stage } : {}),
          ...(tag && tag !== 'todas' ? { tags: { has: tag } } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { phone: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ contacts: contacts.map(serializeContact) });
    }
  );

  app.post(
    '/api/contacts',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Cria novo contato com consentimento LGPD',
      },
    },
    async (request, reply) => {
      const parsed = createContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Dados do contato inválidos.' });
      }

      const { name, phone, email, stage, tags, origin, lgpdConsent } = parsed.data;
      const norm = normalizePhoneDigits(phone);

      const contact = await prisma.contact.create({
        data: {
          tenantId: request.tenantId,
          name,
          phone: formatPhoneDisplay(norm || phone),
          phoneNormalized: norm || phone,
          email,
          stage: stage as CrmStage,
          tags,
          origin,
          lgpdConsent,
          lgpdConsentAt: lgpdConsent ? new Date() : null,
          lgpdStatus: lgpdConsent ? 'ativo' : 'opt_out',
        },
      });

      return reply.status(201).send({ contact: serializeContact(contact) });
    }
  );

  app.patch(
    '/api/contacts/:id',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Atualiza etapa CRM, tags ou dados de contato',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = patchContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Payload inválido.' });
      }

      const existing = await prisma.contact.findFirst({
        where: { id, tenantId: request.tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ error: 'Contato não encontrado.' });
      }

      const updated = await prisma.contact.update({
        where: { id },
        data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          phoneNormalized: parsed.data.phone ? normalizePhoneDigits(parsed.data.phone) : undefined,
          email: parsed.data.email,
          stage: parsed.data.stage as CrmStage | undefined,
          tags: parsed.data.tags,
          lgpdStatus: parsed.data.lgpdStatus as LgpdStatus | undefined,
        },
      });

      if (parsed.data.stage) {
        await prisma.deal.updateMany({
          where: { contactId: id, tenantId: request.tenantId },
          data: { stage: parsed.data.stage as CrmStage, lastInteractionAt: new Date() },
        });
      }

      return reply.send({ contact: serializeContact(updated) });
    }
  );

  app.post(
    '/api/contacts/import',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Importa lote de contatos CSV para o banco Neon',
      },
    },
    async (request, reply) => {
      const parsed = importContactsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Linhas CSV inválidas.' });
      }

      const created = await prisma.$transaction(
        parsed.data.rows.map((row) => {
          const norm = normalizePhoneDigits(row.phone);
          return prisma.contact.create({
            data: {
              tenantId: request.tenantId,
              name: row.name,
              phone: formatPhoneDisplay(norm || row.phone),
              phoneNormalized: norm || row.phone,
              email: row.email,
              stage: 'novo_lead',
              tags: [row.tag || 'Importado CSV'],
              origin: 'Importação CSV',
              lgpdConsent: true,
              lgpdConsentAt: new Date(),
              lgpdStatus: 'ativo',
            },
          });
        })
      );

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'CONTACTS_IMPORT_CSV',
        entity: 'contacts',
        metadata: { importedCount: created.length },
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        contacts: created.map(serializeContact),
      });
    }
  );

  app.post(
    '/api/contacts/:id/anonymize',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Anonimiza dados pessoais do titular conforme Art. 18 da LGPD e grava Audit Log',
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.contact.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Contato não encontrado.' });
      }

      const shortCode = id.replace(/-/g, '').slice(-4).toUpperCase();
      const anonName = `Titular Anonimizado #${shortCode}`;

      const updated = await prisma.contact.update({
        where: { id },
        data: {
          name: anonName,
          phone: '+55 (00) 00000-0000',
          phoneNormalized: `0000000000${shortCode}`,
          email: `anonimizado.${shortCode.toLowerCase()}@lgpd.foclient.local`,
          lgpdConsent: false,
          lgpdStatus: 'anonimizado',
          tags: ['LGPD Anonimizado'],
        },
      });

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'CONTACT_ANONYMIZE_LGPD',
        entity: 'contacts',
        entityId: id,
        metadata: {
          anonymizedAlias: anonName,
          protocol: 'LGPD_ART_18',
        },
        ipAddress: request.ip,
      });

      return reply.send({
        contact: serializeContact(updated),
        message: 'Dados pessoais anonimizados com sucesso conforme LGPD.',
      });
    }
  );

  app.get(
    '/api/contacts/export',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Contatos & LGPD'],
        summary: 'Exporta contatos em CSV e registra log de auditoria LGPD',
      },
    },
    async (request, reply) => {
      const contacts = await prisma.contact.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { createdAt: 'desc' },
      });

      await recordAuditLog({
        tenantId: request.tenantId,
        userId: request.user?.sub,
        action: 'CONTACTS_EXPORT_LGPD',
        entity: 'contacts',
        metadata: { exportedCount: contacts.length },
        ipAddress: request.ip,
      });

      const headers = ['Nome', 'WhatsApp', 'E-mail', 'Etapa CRM', 'Status LGPD', 'Tags'];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const rows = contacts.map((c) => [
        esc(c.name),
        esc(c.phone),
        esc(c.email),
        esc(c.stage),
        esc(c.lgpdStatus),
        esc(c.tags.join('; ')),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="contatos-foclient.csv"');
      return reply.send(csv);
    }
  );
}
