import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock, CreditCard, QrCode } from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { PLAN_CATALOG } from '../../data/mockTenants';
import { PlanTier } from '../../types/foclient';
import { formatBRL, formatCompactNumber } from '../../utils/foclientLogic';

export function BillingScreen() {
  const { activeTenant, changePlanTier } = useFoclient();
  const [invoiceFilter, setInvoiceFilter] = useState<'todos' | 'Pix no Chat' | 'Assinatura SaaS'>(
    'todos'
  );

  const billing = activeTenant.billing;

  const usageMeters = [
    {
      label: 'Usuários Ativos',
      used: billing.usersUsed,
      limit: billing.usersLimit,
      display: `${billing.usersUsed}/${billing.usersLimit}`,
    },
    {
      label: 'Números WhatsApp Oficial',
      used: billing.whatsappUsed,
      limit: billing.whatsappLimit,
      display: `${billing.whatsappUsed}/${billing.whatsappLimit}`,
    },
    {
      label: 'Interações de IA no Mês',
      used: billing.aiInteractionsUsed,
      limit: billing.aiInteractionsLimit,
      display: `${formatCompactNumber(billing.aiInteractionsUsed)}/${formatCompactNumber(
        billing.aiInteractionsLimit
      )}`,
    },
  ];

  const filteredInvoices = useMemo(
    () =>
      activeTenant.invoices.filter((inv) =>
        invoiceFilter === 'todos' ? true : inv.type === invoiceFilter
      ),
    [activeTenant.invoices, invoiceFilter]
  );

  const tiers: PlanTier[] = ['Starter', 'Growth', 'Scale'];

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Current Plan & Consumption Bars */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Assinatura ativa · {activeTenant.name}
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Plano {billing.tier} —{' '}
              <span className="font-mono tabular-nums">{formatBRL(billing.monthlyPrice)}</span>/mês
            </h2>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Próxima renovação em{' '}
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {billing.renewalDate}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5">
          {usageMeters.map((meter) => {
            const pct = Math.min(100, Math.round((meter.used / meter.limit) * 100));
            const barColor =
              pct >= 95 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-indigo-600';

            return (
              <div key={meter.label} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {meter.label}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {meter.display}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pct}% da franquia mensal utilizada
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparative Plans for Upgrade */}
      <section aria-label="Comparativo de planos">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Planos & Upgrade FOCLIENT
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Altere sua franquia instantaneamente conforme o crescimento dos canais WhatsApp
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const spec = PLAN_CATALOG[tier];
            const isCurrent = billing.tier === tier;

            return (
              <div
                key={tier}
                className={`rounded-xl border p-5 flex flex-col justify-between bg-white dark:bg-slate-900 ${
                  isCurrent
                    ? 'border-indigo-600 ring-1 ring-indigo-600/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {spec.name}
                    </h4>
                    {isCurrent && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        Plano Atual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {spec.audience}
                  </p>

                  <p className="mt-4 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatBRL(spec.price)}
                    <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400">
                      {' '}
                      /mês
                    </span>
                  </p>

                  <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4">
                    {spec.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => changePlanTier(tier)}
                  className={`mt-5 w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isCurrent ? 'Plano Ativo' : `Migrar para ${spec.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoices & Pix Payments Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Histórico de Faturas & Pagamentos Pix Recebidos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conciliação de cobranças Pix emitidas no WhatsApp e faturas da assinatura
            </p>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
            {(['todos', 'Pix no Chat', 'Assinatura SaaS'] as const).map((filterVal) => (
              <button
                key={filterVal}
                type="button"
                onClick={() => setInvoiceFilter(filterVal)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  invoiceFilter === filterVal
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {filterVal === 'todos' ? 'Todos' : filterVal}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Cliente / Ref.</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {inv.date}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {inv.description}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      {inv.type === 'Pix no Chat' ? (
                        <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                      )}
                      {inv.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {inv.clientOrRef}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatBRL(inv.amount)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {inv.status === 'Pago' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        Pendente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
