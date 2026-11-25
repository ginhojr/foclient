import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Lock,
  MessageSquare,
  Plus,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { CRM_STAGES, CrmStage } from '../../types/foclient';
import { filterConversations, formatBRL } from '../../utils/foclientLogic';

const SUGGESTED_TAGS = ['VIP', 'Urgente', 'Pix', 'Alta Intenção', 'Retorno'];

export function InboxScreen() {
  const {
    activeTenant,
    selectedConversationId,
    setSelectedConversationId,
    sendMessage,
    toggleConversationAI,
    sendPixChargeInChat,
    confirmPixPayment,
    updateContactStage,
    toggleContactTag,
  } = useFoclient();

  const [tab, setTab] = useState<'todos' | 'ia' | 'humano' | 'aguardando'>('todos');
  const [search, setSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [composerMode, setComposerMode] = useState<'client_reply' | 'internal_note'>('client_reply');
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixDesc, setPixDesc] = useState('');
  const [pixAmount, setPixAmount] = useState('');
  const [pixError, setPixError] = useState('');
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'list' | 'chat' | 'crm'>('chat');

  const filteredConversations = useMemo(
    () => filterConversations(activeTenant.conversations, activeTenant.contacts, tab, search),
    [activeTenant.conversations, activeTenant.contacts, tab, search]
  );

  const activeConversation = useMemo(
    () =>
      activeTenant.conversations.find((c) => c.id === selectedConversationId) ??
      filteredConversations[0] ??
      activeTenant.conversations[0] ??
      null,
    [activeTenant.conversations, selectedConversationId, filteredConversations]
  );

  const activeContact = useMemo(
    () => activeTenant.contacts.find((c) => c.id === activeConversation?.contactId) ?? null,
    [activeTenant.contacts, activeConversation]
  );

  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeConversation?.id, activeConversation?.messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !composerText.trim()) return;
    sendMessage(activeConversation.id, composerText, composerMode);
    setComposerText('');
    setQuickRepliesOpen(false);
  };

  const handleComposerChange = (val: string) => {
    setComposerText(val);
    if (val === '/') {
      setQuickRepliesOpen(true);
    } else if (!val.startsWith('/')) {
      setQuickRepliesOpen(false);
    }
  };

  const handlePixSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation) return;
    const parsed = Number(pixAmount.replace(',', '.'));
    if (!pixDesc.trim()) {
      setPixError('Informe a descrição da cobrança.');
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      setPixError('Informe um valor válido maior que zero.');
      return;
    }
    sendPixChargeInChat(activeConversation.id, pixDesc.trim(), parsed);
    setPixModalOpen(false);
    setPixDesc('');
    setPixAmount('');
    setPixError('');
  };

  const handleCopyPix = (pixId: string, code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedPixId(pixId);
    setTimeout(() => setCopiedPixId(null), 2000);
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact || !customTagInput.trim()) return;
    const cleaned = customTagInput.trim();
    if (!activeContact.tags.includes(cleaned)) {
      toggleContactTag(activeContact.id, cleaned);
    }
    setCustomTagInput('');
  };

  const filterTabs: { id: 'todos' | 'ia' | 'humano' | 'aguardando'; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'ia', label: 'Com IA' },
    { id: 'humano', label: 'Humano' },
    { id: 'aguardando', label: 'Aguardando' },
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Mobile Panel Switcher */}
      <div className="xl:hidden flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 gap-1.5">
        <button
          type="button"
          onClick={() => setMobilePanel('list')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${
            mobilePanel === 'list'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Conversas ({activeTenant.conversations.length})
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('chat')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${
            mobilePanel === 'chat'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Chat Ativo
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('crm')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${
            mobilePanel === 'crm'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Mini-CRM
        </button>
      </div>

      {/* 3-Column Split Screen */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Column 1: Conversations List */}
        <section
          aria-label="Lista de conversas"
          className={`${
            mobilePanel === 'list' ? 'flex' : 'hidden'
          } xl:flex flex-col w-full xl:w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-0`}
        >
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar conversa por nome ou telefone"
                placeholder="Buscar nome ou telefone..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {filterTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                    tab === t.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhuma conversa neste filtro.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const contact = activeTenant.contacts.find((c) => c.id === conv.contactId);
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isSelected = activeConversation?.id === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      setMobilePanel('chat');
                    }}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-semibold">
                        {contact?.avatarInitials ?? 'CL'}
                      </div>
                      {conv.aiActive && (
                        <span
                          title="Agente IA ativo nesta conversa"
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900"
                        >
                          <Bot className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {contact?.name ?? 'Cliente'}
                        </p>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                          {conv.lastMessageAt}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {lastMsg?.content ?? 'Sem mensagens'}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            WhatsApp
                          </span>{' '}
                          ·{' '}
                          {conv.aiActive
                            ? 'IA Ativa'
                            : conv.status === 'aguardando'
                              ? 'Aguardando'
                              : 'Humano'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-mono font-bold tabular-nums">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Column 2: Active Chat Workspace */}
        <section
          aria-label="Área de chat ativo"
          className={`${
            mobilePanel === 'chat' ? 'flex' : 'hidden'
          } xl:flex flex-1 flex-col min-w-0 bg-slate-50 dark:bg-slate-950 min-h-0`}
        >
          {activeConversation && activeContact ? (
            <>
              {/* Chat Header */}
              <div className="px-4 lg:px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold shrink-0">
                    {activeContact.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {activeContact.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                      {activeContact.phone} · {activeConversation.channel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleConversationAI(activeConversation.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    activeConversation.aiActive
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {activeConversation.aiActive ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Assumir da IA</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>Devolver para IA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Messages Feed */}
              <div
                ref={messagesScrollRef}
                className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-3.5"
              >
                {activeConversation.messages.map((msg) => {
                  if (msg.sender === 'internal_note') {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <div className="w-full max-w-xl rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Nota Interna · {msg.senderName}
                            </span>
                            <span className="font-mono text-[11px] opacity-75">{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  const isClient = msg.sender === 'client';
                  const isAI = msg.sender === 'ai';

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-lg rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          isClient
                            ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                            : isAI
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-slate-900 dark:text-indigo-100 rounded-tr-sm'
                              : 'bg-indigo-600 text-white rounded-tr-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold text-[11px] ${
                              isClient
                                ? 'text-slate-600 dark:text-slate-300'
                                : isAI
                                  ? 'text-indigo-700 dark:text-indigo-300'
                                  : 'text-indigo-100'
                            }`}
                          >
                            {isAI && <Sparkles className="w-3 h-3" />}
                            {!isClient && !isAI && <User className="w-3 h-3" />}
                            {msg.senderName}
                          </span>
                          <span
                            className={`font-mono text-[10px] ${
                              isClient || isAI ? 'text-slate-400' : 'text-indigo-200'
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>
                        <p>{msg.content}</p>

                        {/* Interactive Pix Card */}
                        {msg.pix && (
                          <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 p-3.5 text-slate-900 dark:text-slate-100 shadow-xs">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                <QrCode className="w-4 h-4" />
                                Cobrança Pix FOCLIENT
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  msg.pix.status === 'pago'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {msg.pix.status === 'pago' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {msg.pix.description}
                            </p>
                            <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                              {formatBRL(msg.pix.amount)}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {msg.pix.status === 'pago'
                                ? `Confirmado às ${msg.pix.paidAt}`
                                : msg.pix.expiresAt}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyPix(msg.pix!.id, msg.pix!.copyPasteCode)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                {copiedPixId === msg.pix.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Código copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar Pix</span>
                                  </>
                                )}
                              </button>

                              {msg.pix.status === 'pendente' && (
                                <button
                                  type="button"
                                  onClick={() => confirmPixPayment(activeConversation.id, msg.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Simular Pagamento Confirmado</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer Area */}
              <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
                {/* Quick Replies Popover */}
                {quickRepliesOpen && (
                  <div className="absolute bottom-full left-3.5 right-3.5 mb-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 z-20">
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>Respostas Rápidas (/)</span>
                      <button
                        type="button"
                        onClick={() => setQuickRepliesOpen(false)}
                        aria-label="Fechar respostas rápidas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1 mt-1">
                      {activeTenant.quickReplies.map((qr) => (
                        <button
                          key={qr.shortcut}
                          type="button"
                          onClick={() => {
                            setComposerText(qr.text);
                            setQuickRepliesOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {qr.shortcut}
                            </span>
                            <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                              {qr.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {qr.text}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode Switcher + Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setComposerMode('client_reply')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        composerMode === 'client_reply'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Responder Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('internal_note')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        composerMode === 'internal_note'
                          ? 'bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Nota Interna
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickRepliesOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Respostas Rápidas (/)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPixModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors whitespace-nowrap"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Gerar Cobrança Pix</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={composerText}
                    onChange={(e) => handleComposerChange(e.target.value)}
                    aria-label={
                      composerMode === 'internal_note'
                        ? 'Escrever nota interna'
                        : 'Escrever mensagem para o cliente'
                    }
                    placeholder={
                      composerMode === 'internal_note'
                        ? 'Escreva uma nota visível apenas para sua equipe...'
                        : 'Digite uma mensagem ou "/" para respostas rápidas...'
                    }
                    className={`flex-1 px-3.5 py-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 transition-colors ${
                      composerMode === 'internal_note'
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 placeholder:text-amber-600/70 focus:ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-indigo-500/30 focus:border-indigo-500'
                    }`}
                  />
                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-colors shrink-0 ${
                      composerMode === 'internal_note'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Selecione uma conversa para atender
              </p>
            </div>
          )}
        </section>

        {/* Column 3: Mini-CRM & Client Context */}
        <aside
          aria-label="Contexto do cliente Mini-CRM"
          className={`${
            mobilePanel === 'crm' ? 'flex' : 'hidden'
          } xl:flex flex-col w-full xl:w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-5`}
        >
          {activeContact && activeConversation ? (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                  Contexto do Cliente
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm font-bold shrink-0">
                    {activeContact.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {activeContact.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {activeContact.email}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">WhatsApp</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {activeContact.phone}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Origem</span>
                    <span className="text-slate-900 dark:text-slate-100">{activeContact.origin}</span>
                  </div>
                </div>
              </div>

              {/* Funnel Stage Selector */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <label
                  htmlFor="mini-crm-stage"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Etapa do Funil CRM
                </label>
                <select
                  id="mini-crm-stage"
                  value={activeContact.stage}
                  onChange={(e) =>
                    updateContactStage(activeContact.id, e.target.value as CrmStage)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                >
                  {CRM_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clickable Tags */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Tags do Lead
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {Array.from(new Set([...activeContact.tags, ...SUGGESTED_TAGS])).map((tag) => {
                    const isActive = activeContact.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleContactTag(activeContact.id, tag)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                          isActive
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {isActive ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
                <form onSubmit={handleAddCustomTag} className="flex gap-1.5">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="Nova tag..."
                    aria-label="Adicionar nova tag ao contato"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    aria-label="Salvar nova tag"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* LGPD Opt-in Verification */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Conformidade LGPD
                </p>
                <div
                  className={`rounded-lg p-3 border text-xs ${
                    activeContact.lgpdStatus === 'ativo'
                      ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                      : 'border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {activeContact.lgpdStatus === 'ativo'
                        ? 'Opt-in Verificado'
                        : activeContact.lgpdStatus === 'opt_out'
                          ? 'Opt-out Registrado'
                          : 'Dados Anonimizados'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-85 mt-1">
                    {activeContact.lgpdStatus === 'ativo'
                      ? `Consentimento registrado via WhatsApp em ${activeContact.lgpdVerifiedAt ?? '25/11/2026'}.`
                      : 'Comunicação proativa bloqueada conforme solicitação do titular.'}
                  </p>
                </div>
              </div>

              {/* Automatic AI Lead Summary */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Resumo Automático da IA</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                  {activeConversation.aiSummary}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nenhum contato selecionado.
            </p>
          )}
        </aside>
      </div>

      {/* Generate Pix Modal */}
      {pixModalOpen && activeContact && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gerar Cobrança Pix"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setPixModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Gerar Cobrança Pix no Chat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPixModalOpen(false)}
                aria-label="Fechar modal Pix"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              O cartão interativo de pagamento será enviado diretamente para{' '}
              <strong className="text-slate-800 dark:text-slate-200">{activeContact.name}</strong> no
              WhatsApp.
            </p>

            <form onSubmit={handlePixSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="pix-desc-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Descrição do serviço ou sinal
                </label>
                <input
                  id="pix-desc-input"
                  type="text"
                  value={pixDesc}
                  onChange={(e) => setPixDesc(e.target.value)}
                  placeholder="Ex.: Sinal de Avaliação + Clareamento"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="pix-value-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Valor (R$)
                </label>
                <input
                  id="pix-value-input"
                  type="number"
                  step="0.01"
                  min="1"
                  value={pixAmount}
                  onChange={(e) => setPixAmount(e.target.value)}
                  placeholder="450.00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {pixError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{pixError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPixModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  Enviar Pix no WhatsApp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
