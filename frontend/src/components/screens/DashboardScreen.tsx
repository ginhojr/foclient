import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Clock,
  MessageSquare,
  QrCode,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFoclient } from '../../context/FoclientContext';
import { calculateTenantMetrics, formatBRL } from '../../utils/foclientLogic';

export function DashboardScreen() {
  const { activeTenant, theme, setActiveScreen } = useFoclient();
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const metrics = calculateTenantMetrics(activeTenant);

  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisTick = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const kpis = [
    {
      label: 'Atendimentos Hoje',
      value: String(metrics.chatsToday),
      delta: `${metrics.chatsGrowthPct >= 0 ? '+' : ''}${metrics.chatsGrowthPct}% vs. ontem`,
      positive: metrics.chatsGrowthPct >= 0,
      icon: MessageSquare,
      accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    },
    {
      label: 'Resolvidos pela IA',
      value: `${metrics.aiResolvedPct}%`,
      delta: `Agente ${activeTenant.agentConfig.name} ativo`,
      positive: true,
      icon: Bot,
      accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    },
    {
      label: 'Tempo Médio de Resposta',
      value: `${metrics.avgResponseSeconds}s`,
      delta: 'SLA meta abaixo de 30s',
      positive: true,
      icon: Clock,
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      label: 'Vendas via Pix no Chat',
      value: formatBRL(metrics.pixSalesTotal),
      delta: 'Baixa automática no WhatsApp',
      positive: true,
      icon: QrCode,
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
    },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Top Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resumo de {activeTenant.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Performance operacional dos últimos 7 dias · WhatsApp {activeTenant.whatsappNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveScreen('inbox')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <span>Abrir Inbox Omnichannel</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <section aria-label="Indicadores principais" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${kpi.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight font-mono tabular-nums text-slate-900 dark:text-white">
                  {kpi.value}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                  {kpi.positive ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  )}
                  <span
                    className={
                      kpi.positive
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-rose-600 dark:text-rose-400 font-medium'
                    }
                  >
                    {kpi.delta}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Main Analytics + Recent Activity Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* 7-day Volume Chart (IA vs Humano) */}
        <section className="xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Volume de Atendimentos — IA vs. Humano (7 dias)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Distribuição diária entre resoluções autônomas da IA e atendimento da equipe
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
                  IA
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  Humano
                </span>
              </div>

              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setChartType('area')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartType === 'area'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Área
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartType === 'bar'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Barras
                </button>
              </div>
            </div>
          </div>

          <div className="w-full h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={activeTenant.dailyVolume} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="iaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="humanoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: axisTick }}
                    axisLine={false}
                    tickLine={false}
                    padding={{ left: 10, right: 16 }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: axisTick }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ia"
                    name="Atendidos pela IA"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#iaGradient)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="humano"
                    name="Atendimento Humano"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#humanoGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart data={activeTenant.dailyVolume} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: axisTick }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: axisTick }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="ia" name="Atendidos pela IA" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="humano" name="Atendimento Humano" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Activity List */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Atividade Recente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pagamentos Pix confirmados e transbordos da IA
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('billing')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Ver extrato</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {activeTenant.recentActivity.map((event) => {
              const isPix = event.type === 'pix_confirmed';
              return (
                <div key={event.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isPix
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isPix ? <QrCode className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {event.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {event.subtitle}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {event.timestamp}
                      </span>
                      {event.amount !== undefined && (
                        <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          +{formatBRL(event.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
