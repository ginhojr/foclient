import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Search,
  TrendingDown,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { TenantStatus } from '../../types/foclient';
import {
  calculateGlobalSuperAdminMetrics,
  formatBRL,
  formatCompactNumber,
} from '../../utils/foclientLogic';

export function SuperAdminScreen() {
  const { tenants, activeTenantId, switchTenant } = useFoclient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | TenantStatus>('todos');

  const globalMetrics = useMemo(() => calculateGlobalSuperAdminMetrics(tenants), [tenants]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.segment.toLowerCase().includes(q) ||
        t.billing.tier.toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  const cards = [
    {
      label: 'MRR Total',
      value: formatBRL(globalMetrics.mrrTotal),
      sub: 'Receita recorrente ativa',
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      label: 'Empresas Ativas',
      value: `${globalMetrics.activeCount}/${globalMetrics.totalCount}`,
      sub: 'Contas Ativas + Trial em operação',
      icon: Building2,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    },
    {
      label: 'Churn Mensal',
      value: `${globalMetrics.churnRate}%`,
      sub: 'Meta operacional abaixo de 3,0%',
      icon: TrendingDown,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      label: 'Consumo Global de IA',
      value: formatCompactNumber(globalMetrics.totalAiInteractions),
      sub: 'Interações processadas neste ciclo',
      icon: Bot,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Backoffice Super Admin — Plataforma FOCLIENT
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Monitoramento consolidado de receita recorrente, saúde dos tenants e impersonation seguro
        </p>
      </div>

      {/* 4 Global Metrics */}
      <section aria-label="Métricas globais do SaaS" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {card.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Tenants Management Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar empresa tenant"
              placeholder="Buscar empresa, segmento ou plano..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
            {(['todos', 'Ativo', 'Trial', 'Inadimplente'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'todos' ? 'Todos' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Empresa (Tenant)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4 text-right">MRR</th>
                <th className="py-3 px-4 text-right">Interações IA</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredTenants.map((tenant) => {
                const isCurrent = tenant.id === activeTenantId;
                return (
                  <tr
                    key={tenant.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {tenant.name}
                          {isCurrent && (
                            <span className="ml-2 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                              (Sessão atual)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {tenant.segment} · {tenant.whatsappNumber}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tenant.status === 'Ativo' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : tenant.status === 'Trial' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          Trial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Inadimplente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {tenant.billing.tier}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatBRL(tenant.mrr)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatCompactNumber(tenant.billing.aiInteractionsUsed)} /{' '}
                      {formatCompactNumber(tenant.billing.aiInteractionsLimit)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => switchTenant(tenant.id, 'dashboard')}
                        aria-label={`Acessar como empresa ${tenant.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                      >
                        <span>Acessar como Empresa</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
