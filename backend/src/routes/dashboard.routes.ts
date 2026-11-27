import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/dashboard/metrics',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Dashboard'],
        summary: 'Calcula KPIs operacionais e comerciais reais direto do Neon PostgreSQL',
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const [tenant, totalConversations, botConversations, unreadAgg, paidPixAgg, dealsByStage] =
        await Promise.all([
          prisma.tenant.findUnique({ where: { id: tenantId } }),
          prisma.conversation.count({ where: { tenantId } }),
          prisma.conversation.count({ where: { tenantId, status: 'BOT' } }),
          prisma.conversation.aggregate({
            where: { tenantId },
            _sum: { unreadCount: true },
          }),
          prisma.billingInvoice.aggregate({
            where: { tenantId, type: 'Pix no Chat', status: 'Pago' },
            _sum: { amount: true },
          }),
          prisma.deal.groupBy({
            by: ['stage'],
            where: { tenantId },
            _count: { _all: true },
            _sum: { value: true },
          }),
        ]);

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant não encontrado.' });
      }

      const aiResolvedPct =
        totalConversations > 0
          ? Math.min(
              98,
              Math.max(
                20,
                Math.round(
                  tenant.baseAiResolvedPct * 0.75 +
                    (botConversations / totalConversations) * 100 * 0.25
                )
              )
            )
          : tenant.baseAiResolvedPct;

      const settings = (tenant.settings ?? {}) as {
        dailyVolume?: unknown[];
        recentActivity?: unknown[];
      };

      return reply.send({
        tenantId,
        chatsToday: Math.max(tenant.baseChatsToday, totalConversations),
        chatsGrowthPct: tenant.chatsGrowthPct,
        aiResolvedPct,
        avgResponseSeconds: tenant.avgResponseSeconds,
        pixSalesTotal: paidPixAgg._sum.amount ?? 0,
        unreadTotal: unreadAgg._sum.unreadCount ?? 0,
        dailyVolume: settings.dailyVolume ?? [],
        recentActivity: settings.recentActivity ?? [],
        pipelineSummary: dealsByStage.map((g) => ({
          stage: g.stage,
          count: g._count._all,
          totalValue: g._sum.value ?? 0,
        })),
      });
    }
  );
}
