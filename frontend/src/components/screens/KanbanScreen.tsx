import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { CRM_STAGES, CrmStage } from '../../types/foclient';
import {
  calculateColumnTotals,
  formatBRL,
  getAdjacentStage,
} from '../../utils/foclientLogic';

export function KanbanScreen() {
  const { activeTenant, moveDeal, createDeal, openContactInChat } = useFoclient();
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CrmStage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state for "+ Novo Negócio"
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<CrmStage>('novo_lead');
  const [origin, setOrigin] = useState('WhatsApp Direto');
  const [tagsText, setTagsText] = useState('VIP');
  const [formError, setFormError] = useState('');

  const totals = useMemo(() => calculateColumnTotals(activeTenant.deals), [activeTenant.deals]);
  const totalPipeline = useMemo(
    () => activeTenant.deals.reduce((sum, d) => sum + d.value, 0),
    [activeTenant.deals]
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericValue = Number(value.replace(',', '.'));
    if (!title.trim() || !clientName.trim()) {
      setFormError('Preencha o título do negócio e o nome do cliente.');
      return;
    }
    if (Number.isNaN(numericValue) || numericValue <= 0) {
      setFormError('Informe um valor estimado válido maior que zero.');
      return;
    }

    const parsedTags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    createDeal({
      title: title.trim(),
      clientName: clientName.trim(),
      phone: phone.trim(),
      value: numericValue,
      stage,
      origin,
      tags: parsedTags,
    });

    setModalOpen(false);
    setTitle('');
    setClientName('');
    setPhone('');
    setValue('');
    setStage('novo_lead');
    setFormError('');
  };

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col min-h-0">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Funil de Vendas — {activeTenant.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTenant.deals.length} negócios ativos · Total em funil:{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              {formatBRL(totalPipeline)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Negócio</span>
        </button>
      </div>

      {/* 5-Column Horizontal Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-2 min-h-0">
        <div className="grid grid-cols-5 gap-3 min-w-[1040px] h-full">
          {CRM_STAGES.map((col) => {
            const columnDeals = activeTenant.deals.filter((d) => d.stage === col.id);
            const colStats = totals[col.id];
            const isOver = dragOverStage === col.id;

            return (
              <section
                key={col.id}
                aria-label={`Coluna ${col.label}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(col.id);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const dealId = e.dataTransfer.getData('text/plain') || draggingDealId;
                  if (dealId) {
                    moveDeal(dealId, col.id);
                  }
                  setDraggingDealId(null);
                  setDragOverStage(null);
                }}
                className={`flex flex-col rounded-xl border transition-colors min-h-[420px] ${
                  isOver
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/25'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60'
                }`}
              >
                {/* Column Header */}
                <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900 rounded-t-xl">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {col.label}
                    </h3>
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                      {colStats.count}
                    </span>
                  </div>
                  <p className="text-xs font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                    {formatBRL(colStats.total)}
                  </p>
                </div>

                {/* Cards Stack */}
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto">
                  {columnDeals.length === 0 ? (
                    <div className="h-28 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-4 text-center">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Arraste um card para esta etapa
                      </p>
                    </div>
                  ) : (
                    columnDeals.map((deal) => {
                      const prevStage = getAdjacentStage(deal.stage, 'prev');
                      const nextStage = getAdjacentStage(deal.stage, 'next');

                      return (
                        <article
                          key={deal.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggingDealId(deal.id);
                            e.dataTransfer.setData('text/plain', deal.id);
                          }}
                          onDragEnd={() => {
                            setDraggingDealId(null);
                            setDragOverStage(null);
                          }}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {deal.clientName}
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {deal.title}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-2.5">
                            {formatBRL(deal.value)}
                          </p>

                          {/* Clean unboxed metadata */}
                          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span>{deal.origin}</span>
                            {deal.tags.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                  {deal.tags.join(', ')}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              {deal.lastInteraction}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openContactInChat(deal.contactId)}
                                aria-label={`Abrir conversa de ${deal.clientName}`}
                                title="Abrir no WhatsApp"
                                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!prevStage}
                                onClick={() => prevStage && moveDeal(deal.id, prevStage)}
                                aria-label={`Voltar etapa de ${deal.clientName}`}
                                title="Mover para etapa anterior"
                                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={!nextStage}
                                onClick={() => nextStage && moveDeal(deal.id, nextStage)}
                                aria-label={`Avançar etapa de ${deal.clientName}`}
                                title="Avançar para próxima etapa"
                                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Modal: + Novo Negócio */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Criar Novo Negócio"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Novo Negócio no Funil
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal de novo negócio"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="deal-client-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nome do Cliente
                </label>
                <input
                  id="deal-client-name"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex.: Juliana Andrade"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="deal-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Título da Oportunidade
                </label>
                <input
                  id="deal-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Protocolo Lentes Porcelana"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="deal-value"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Valor Estimado (R$)
                  </label>
                  <input
                    id="deal-value"
                    type="number"
                    min="1"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="3500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="deal-phone"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    WhatsApp
                  </label>
                  <input
                    id="deal-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 (11) 99999-0000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="deal-stage"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Etapa Inicial
                  </label>
                  <select
                    id="deal-stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as CrmStage)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {CRM_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="deal-origin"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Origem
                  </label>
                  <select
                    id="deal-origin"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="WhatsApp Direto">WhatsApp Direto</option>
                    <option value="Instagram Ads">Instagram Ads</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Indicação">Indicação</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="deal-tags"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Tags (separadas por vírgula)
                </label>
                <input
                  id="deal-tags"
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="VIP, Alta Intenção"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                >
                  Criar Negócio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
