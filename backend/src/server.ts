import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { initSocketServer } from './lib/socket';
import { aiAgentsRoutes } from './routes/ai-agents.routes';
import { authRoutes } from './routes/auth.routes';
import { billingRoutes } from './routes/billing.routes';
import { contactsRoutes } from './routes/contacts.routes';
import { conversationsRoutes } from './routes/conversations.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { dealsRoutes } from './routes/deals.routes';
import { whatsappRoutes } from './routes/whatsapp.routes';

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FOCLIENT SaaS Multi-tenant API',
        description:
          'Back-end Multi-tenant FOCLIENT — WhatsApp Real (Baileys Multi-Device / Meta Cloud API), CRM Kanban, Inbox Omnichannel, Agentes de IA RAG, Cobrança Pix e LGPD.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Healthcheck endpoint verifying Neon PostgreSQL connectivity
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Verifica saúde da API e conexão com o PostgreSQL no Neon',
      },
    },
    async () => {
      const tenantCount = await prisma.tenant.count();
      return {
        status: 'ok',
        database: 'neon-postgresql-connected',
        tenantsCount: tenantCount,
        whatsappEngine: 'Baileys Multi-Device WebSocket + Meta Cloud API Adapter',
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Register Domain Routes
  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(conversationsRoutes);
  await app.register(whatsappRoutes);
  await app.register(dealsRoutes);
  await app.register(contactsRoutes);
  await app.register(aiAgentsRoutes);
  await app.register(billingRoutes);

  await app.ready();

  // Attach Socket.io to Fastify's underlying Node HTTP server
  initSocketServer(app.server);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`\n🚀 FOCLIENT Backend running at http://localhost:${env.PORT}`);
  console.log(`📚 OpenAPI / Swagger Docs available at http://localhost:${env.PORT}/docs`);
  console.log(`⚡ Socket.io Real-time Server attached & ready\n`);
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error starting FOCLIENT Backend:', err);
  process.exit(1);
});
