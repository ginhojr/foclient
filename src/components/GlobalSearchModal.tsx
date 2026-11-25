import React, { useMemo, useState } from 'react';
import { ArrowRight, Kanban, MessageSquare, Search, Users, X } from 'lucide-react';
import { useFoclient } from '../context/FoclientContext';
import { ScreenId } from '../types/foclient';
import { formatBRL, getStageLabel } from '../utils/foclientLogic';

const QUICK_NAV: { id: ScreenId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard Operacional' },
  { id: 'inbox', label: 'Inbox Omnichannel (WhatsApp + IA)' },
  { id: 'kanban', label: 'CRM Kanban (Funil de Vendas)' },
  { id: 'contacts', label: 'Base de Contatos & LGPD' },
  { id: 'ai-studio', label: 'Estúdio de Agentes de IA' },
  { id: 'billing', label: 'Financeiro & Planos' },
  { id: 'super-admin', label: 'Painel Super Admin' },
];

export function GlobalSearchModal() {
  const {
    activeTenant,
    globalSearchOpen,
    setGlobalSearchOpen,
    setActiveScreen,
    openContactInChat,
  } = useFoclient();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const matchingScreens = useMemo(
    () => QUICK_NAV.filter((item) => !q || item.label.toLowerCase().includes(q)),
    [q]
  );

  const matchingContacts = useMemo(
    () =>
      activeTenant.contacts
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        )
        .slice(0, 4),
    [activeTenant.contacts, q]
  );

  const matchingDeals = useMemo(
    () =>
      activeTenant.deals
        .filter(
          (d) =>
            !q ||
            d.title.toLowerCase().includes(q) ||
            d.clientName.toLowerCase().includes(q)
        )
        .slice(0, 4),
    [activeTenant.deals, q]
  );

  if (!globalSearchOpen) return null;

  const close = () => {
    setGlobalSearchOpen(false);
    setQuery('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/50 backdrop-blur-[1px]"
      onClick={close}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar em ${activeTenant.name} (telas, contatos, negócios)...`}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Fechar busca global"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {matchingContacts.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Contatos & Conversas
              </p>
              <div className="space-y-1">
                {matchingContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      openContactInChat(contact.id);
                      close();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {contact.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {contact.phone} · {getStageLabel(contact.stage)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0">
                      <MessageSquare className="w-3 h-3" />
                      Abrir chat
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingDeals.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Negócios no Funil
              </p>
              <div className="space-y-1">
                {matchingDeals.map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen('kanban');
                      close();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Kanban className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {deal.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {deal.clientName} · {getStageLabel(deal.stage)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      {formatBRL(deal.value)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingScreens.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Navegação Rápida
              </p>
              <div className="space-y-1">
                {matchingScreens.map((screen) => (
                  <button
                    key={screen.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(screen.id);
                      close();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span>{screen.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchingContacts.length === 0 &&
            matchingDeals.length === 0 &&
            matchingScreens.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}
