import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserX,
  X,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { Contact } from '../../types/foclient';
import {
  exportContactsToCSV,
  filterContacts,
  getStageLabel,
} from '../../utils/foclientLogic';

const SAMPLE_CSV_IMPORT = [
  {
    name: 'Larissa Carvalho',
    phone: '+55 (11) 97214-8890',
    email: 'larissa.carvalho@exemplo.com.br',
    tag: 'Campanha Novembro',
  },
  {
    name: 'Felipe Augusto Rocha',
    phone: '+55 (11) 98650-4412',
    email: 'felipe.rocha@empresa.com.br',
    tag: 'Campanha Novembro',
  },
  {
    name: 'Aline Moreira',
    phone: '+55 (11) 99321-7750',
    email: 'aline.moreira@gmail.com',
    tag: 'VIP',
  },
];

export function ContactsScreen() {
  const {
    activeTenant,
    openContactInChat,
    anonymizeContact,
    importSimulatedCsvContacts,
  } = useFoclient();

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('todas');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [anonymizeTarget, setAnonymizeTarget] = useState<Contact | null>(null);
  const [csvFileName, setCsvFileName] = useState('leads_novembro_2026.csv');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    activeTenant.contacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [activeTenant.contacts]);

  const filteredContacts = useMemo(
    () => filterContacts(activeTenant.contacts, query, tagFilter),
    [activeTenant.contacts, query, tagFilter]
  );

  const handleExportCSV = () => {
    const csv = exportContactsToCSV(filteredContacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos-${activeTenant.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = () => {
    importSimulatedCsvContacts(SAMPLE_CSV_IMPORT);
    setImportModalOpen(false);
  };

  const handleConfirmAnonymize = () => {
    if (!anonymizeTarget) return;
    anonymizeContact(anonymizeTarget.id);
    setAnonymizeTarget(null);
  };

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Base de Contatos & Conformidade LGPD
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTenant.contacts.length} contatos cadastrados em {activeTenant.name} · Gestão
            auditável de opt-in e anonimização
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Lista</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar contatos por nome, WhatsApp ou e-mail"
              placeholder="Buscar por nome, WhatsApp ou e-mail..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="tag-filter-select" className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Filtrar por tag:
            </label>
            <select
              id="tag-filter-select"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="todas">Todas as tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Etapa CRM</th>
                <th className="py-3 px-4">Status LGPD</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Nenhum contato encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {contact.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {contact.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {contact.tags.join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {contact.phone}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {contact.email}
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                      {getStageLabel(contact.stage)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {contact.lgpdStatus === 'ativo' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Consentimento Ativo
                        </span>
                      ) : contact.lgpdStatus === 'opt_out' ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Opt-out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                          <UserX className="w-3.5 h-3.5" />
                          Anonimizado LGPD
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openContactInChat(contact.id)}
                          aria-label={`Abrir ${contact.name} no chat`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Abrir no chat</span>
                        </button>
                        <button
                          type="button"
                          disabled={contact.lgpdStatus === 'anonimizado'}
                          onClick={() => setAnonymizeTarget(contact)}
                          aria-label={`Anonimizar dados LGPD de ${contact.name}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/70 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Anonimizar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulated CSV Import Modal */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Importar contatos via CSV"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setImportModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Importar Base CSV (com validação LGPD)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                aria-label="Fechar modal de importação CSV"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-center mb-4">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Arquivo selecionado: <span className="font-mono">{csvFileName}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                3 registros prontos para importação em {activeTenant.name} com opt-in verificado.
              </p>
              <label className="mt-2.5 inline-block px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                Escolher outro arquivo .csv
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCsvFileName(file.name);
                  }}
                />
              </label>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden mb-4">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Nome</th>
                    <th className="py-2 px-3">WhatsApp</th>
                    <th className="py-2 px-3">Tag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {SAMPLE_CSV_IMPORT.map((row) => (
                    <tr key={row.email}>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {row.name}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {row.phone}
                      </td>
                      <td className="py-2 px-3 text-indigo-600 dark:text-indigo-400">{row.tag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
              >
                Confirmar Importação (3 contatos)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LGPD Anonymize Confirmation Dialog */}
      {anonymizeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar anonimização LGPD"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setAnonymizeTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Anonimizar dados pessoais (LGPD)?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Esta ação substituirá o nome, telefone e e-mail de{' '}
              <strong>{anonymizeTarget.name}</strong> por identificadores anônimos conforme o Art.
              18 da LGPD, preservando apenas o histórico estatístico da empresa.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnonymizeTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAnonymize}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
              >
                Confirmar Anonimização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
