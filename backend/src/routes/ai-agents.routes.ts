import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { encryptSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';
import { generateAgentReply, KnowledgeDoc } from '../services/ai.service';
import { serializeAIAgent } from '../services/serializer.service';

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  roleTitle: z.string().optional(),
  tone: z.enum(['Consultivo', 'Amigável', 'Direto']).optional(),
  systemPrompt: z.string().optional(),
  skills: z
    .object({
      transcribeAudio: z.boolean().optional(),
      generatePixLink: z.boolean().optional(),
      handoffOnFrustration: z.boolean().optional(),
    })
    .optional(),
  knowledgeBase: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['pdf', 'url']),
        title: z.string(),
        sizeOrUrl: z.string(),
        addedAt: z.string(),
        snippet: z.string(),
      })
    )
    .optional(),
  apiKey: z.string().optional(),
});

const addKnowledgeSchema = z.object({
  type: z.enum(['pdf', 'url']),
  title: z.string().min(1),
  sizeOrUrl: z.string().min(1),
  snippet: z.string().min(1),
});

const simulateSchema = z.object({
  message: z.string().min(1),
  config: updateAgentSchema.optional(),
});

export async function aiAgentsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/ai-agents',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agentes de IA'],
        summary: 'Obtém configuração atual do Agente de IA e base RAG do tenant',
      },
    },
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        include: { aiAgent: true },
      });

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant não encontrado.' });
      }

      return reply.send({
        agentConfig: serializeAIAgent(tenant.aiAgent, tenant.name),
      });
    }
  );

  app.put(
    '/api/ai-agents',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agentes de IA'],
        summary: 'Salva configurações de persona, tom de voz, habilidades e base RAG no Neon',
      },
    },
    async (request, reply) => {
      const parsed = updateAgentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Configuração inválida.', details: parsed.error.flatten() });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenantId },
        include: { aiAgent: true },
      });
      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant não encontrado.' });
      }

      const d = parsed.data;
      const encryptedApiKey = d.apiKey?.trim() ? encryptSecret(d.apiKey.trim()) : undefined;

      const updated = await prisma.aIAgent.upsert({
        where: { tenantId: request.tenantId },
        update: {
          name: d.name,
          roleTitle: d.roleTitle,
          tone: d.tone,
          systemPrompt: d.systemPrompt,
          transcribeAudio: d.skills?.transcribeAudio,
          generatePixLink: d.skills?.generatePixLink,
          handoffOnFrustration: d.skills?.handoffOnFrustration,
          knowledgeDocuments:
            d.knowledgeBase !== undefined
              ? (d.knowledgeBase as unknown as Prisma.InputJsonValue)
              : undefined,
          encryptedApiKey,
        },
        create: {
          tenantId: request.tenantId,
          name: d.name ?? 'Clara IA',
          roleTitle: d.roleTitle ?? `Especialista Digital — ${tenant.name}`,
          tone: d.tone ?? 'Consultivo',
          systemPrompt:
            d.systemPrompt ?? `Atue como especialista comercial digital da ${tenant.name}.`,
          transcribeAudio: d.skills?.transcribeAudio ?? true,
          generatePixLink: d.skills?.generatePixLink ?? true,
          handoffOnFrustration: d.skills?.handoffOnFrustration ?? true,
          knowledgeDocuments: (d.knowledgeBase ?? []) as unknown as Prisma.InputJsonValue,
          encryptedApiKey: encryptedApiKey ?? null,
        },
      });

      return reply.send({
        agentConfig: serializeAIAgent(updated, tenant.name),
      });
    }
  );

  app.post(
    '/api/ai-agents/knowledge',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agentes de IA'],
        summary: 'Adiciona documento PDF ou URL à base de conhecimento RAG do agente',
      },
    },
    async (request, reply) => {
      const parsed = addKnowledgeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Fonte RAG inválida.' });
      }

      const existing = await prisma.aIAgent.findUnique({
        where: { tenantId: request.tenantId },
      });

      const currentDocs: KnowledgeDoc[] = Array.isArray(existing?.knowledgeDocuments)
        ? (existing!.knowledgeDocuments as unknown as KnowledgeDoc[])
        : [];

      const newDoc: KnowledgeDoc = {
        id: `kb-${Date.now()}`,
        ...parsed.data,
        addedAt: 'Hoje',
      };

      const nextDocs = [newDoc, ...currentDocs];

      await prisma.aIAgent.upsert({
        where: { tenantId: request.tenantId },
        update: {
          knowledgeDocuments: nextDocs as unknown as Prisma.InputJsonValue,
        },
        create: {
          tenantId: request.tenantId,
          systemPrompt: 'Especialista comercial inteligente.',
          knowledgeDocuments: nextDocs as unknown as Prisma.InputJsonValue,
        },
      });

      return reply.status(201).send({ source: newDoc });
    }
  );

  app.delete(
    '/api/ai-agents/knowledge/:sourceId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agentes de IA'],
        summary: 'Remove documento da base de conhecimento RAG',
      },
    },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const existing = await prisma.aIAgent.findUnique({
        where: { tenantId: request.tenantId },
      });

      if (!existing) {
        return reply.send({ ok: true });
      }

      const currentDocs: KnowledgeDoc[] = Array.isArray(existing.knowledgeDocuments)
        ? (existing.knowledgeDocuments as unknown as KnowledgeDoc[])
        : [];

      const filtered = currentDocs.filter((doc) => doc.id !== sourceId);

      await prisma.aIAgent.update({
        where: { tenantId: request.tenantId },
        data: {
          knowledgeDocuments: filtered as unknown as Prisma.InputJsonValue,
        },
      });

      return reply.send({ ok: true });
    }
  );

  app.post(
    '/api/ai-agents/simulate',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Agentes de IA'],
        summary: 'Executa simulação em tempo real do Agente de IA (Gemini ou Smart RAG)',
      },
    },
    async (request, reply) => {
      const parsed = simulateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Informe a mensagem para simulação.' });
      }

      const replyData = await generateAgentReply({
        tenantId: request.tenantId,
        userMessage: parsed.data.message,
        overrideConfig: parsed.data.config,
      });

      return reply.send(replyData);
    }
  );
}
