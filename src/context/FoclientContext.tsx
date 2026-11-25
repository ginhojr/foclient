import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AIAgentConfig,
  AppNotification,
  Contact,
  CrmStage,
  KnowledgeSource,
  PlanTier,
  ScreenId,
  TenantData,
  ThemeMode,
} from '../types/foclient';
import { INITIAL_NOTIFICATIONS, INITIAL_TENANTS, PLAN_CATALOG } from '../data/mockTenants';
import {
  anonymizeContactRecord,
  buildPixCopyPasteCode,
  getInitials,
  moveDealToStage,
} from '../utils/foclientLogic';

interface FoclientContextValue {
  tenants: TenantData[];
  activeTenantId: string;
  activeTenant: TenantData;
  activeScreen: ScreenId;
  selectedConversationId: string | null;
  theme: ThemeMode;
  globalSearchOpen: boolean;
  notifications: AppNotification[];
  toastMessage: string | null;
  setActiveScreen: (screen: ScreenId) => void;
  switchTenant: (tenantId: string, navigateTo?: ScreenId) => void;
  setSelectedConversationId: (convId: string | null) => void;
  openContactInChat: (contactId: string) => void;
  toggleTheme: () => void;
  setGlobalSearchOpen: (open: boolean) => void;
  markAllNotificationsRead: () => void;
  dismissToast: () => void;
  // Inbox actions
  sendMessage: (
    conversationId: string,
    content: string,
    mode: 'client_reply' | 'internal_note'
  ) => void;
  toggleConversationAI: (conversationId: string) => void;
  sendPixChargeInChat: (conversationId: string, description: string, amount: number) => void;
  confirmPixPayment: (conversationId: string, messageId: string) => void;
  updateContactStage: (contactId: string, stage: CrmStage) => void;
  toggleContactTag: (contactId: string, tag: string) => void;
  // Kanban actions
  moveDeal: (dealId: string, nextStage: CrmStage) => void;
  createDeal: (payload: {
    title: string;
    clientName: string;
    phone: string;
    value: number;
    stage: CrmStage;
    origin: string;
    tags: string[];
  }) => void;
  // Contacts & LGPD
  anonymizeContact: (contactId: string) => void;
  importSimulatedCsvContacts: (rows: { name: string; phone: string; email: string; tag: string }[]) => void;
  // AI Agent Studio
  updateAgentConfig: (patch: Partial<AIAgentConfig>) => void;
  addKnowledgeSource: (source: Omit<KnowledgeSource, 'id' | 'addedAt'>) => void;
  removeKnowledgeSource: (sourceId: string) => void;
  // Billing
  changePlanTier: (tier: PlanTier) => void;
}

const FoclientContext = createContext<FoclientContextValue | null>(null);

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FoclientProvider({ children }: { children: React.ReactNode }) {
  const [tenants, setTenants] = useState<TenantData[]>(INITIAL_TENANTS);
  const [activeTenantId, setActiveTenantId] = useState<string>(INITIAL_TENANTS[0].id);
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    INITIAL_TENANTS[0].conversations[0]?.id ?? null
  );
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeTenant = useMemo(
    () => tenants.find((t) => t.id === activeTenantId) ?? tenants[0],
    [tenants, activeTenantId]
  );

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-clear toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  const updateActiveTenant = (updater: (tenant: TenantData) => TenantData) => {
    setTenants((prev) => prev.map((t) => (t.id === activeTenantId ? updater(t) : t)));
  };

  const switchTenant = (tenantId: string, navigateTo?: ScreenId) => {
    const nextTenant = tenants.find((t) => t.id === tenantId);
    if (!nextTenant) return;
    setActiveTenantId(tenantId);
    setSelectedConversationId(nextTenant.conversations[0]?.id ?? null);
    if (navigateTo) {
      setActiveScreen(navigateTo);
    }
    showToast(`Empresa ativa alterada para ${nextTenant.name}`);
  };

  const handleSelectConversation = (convId: string | null) => {
    setSelectedConversationId(convId);
    if (!convId) return;
    updateActiveTenant((tenant) => ({
      ...tenant,
      conversations: tenant.conversations.map((c) =>
        c.id === convId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  };

  const openContactInChat = (contactId: string) => {
    const existing = activeTenant.conversations.find((c) => c.contactId === contactId);
    if (existing) {
      handleSelectConversation(existing.id);
      setActiveScreen('inbox');
      return;
    }

    const contact = activeTenant.contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const newConvId = `conv-${Date.now()}`;
    updateActiveTenant((tenant) => ({
      ...tenant,
      conversations: [
        {
          id: newConvId,
          contactId: contact.id,
          status: 'humano',
          unreadCount: 0,
          channel: 'WhatsApp Oficial',
          lastMessageAt: nowHHMM(),
          aiActive: false,
          aiSummary: `Conversa iniciada manualmente pelo painel para ${contact.name} (${contact.origin}).`,
          messages: [
            {
              id: `msg-${Date.now()}`,
              sender: 'internal_note',
              senderName: 'Sistema FOCLIENT',
              content: `Canal WhatsApp Oficial pronto para iniciar conversa ativa com ${contact.name}.`,
              timestamp: nowHHMM(),
            },
          ],
        },
        ...tenant.conversations,
      ],
    }));
    setSelectedConversationId(newConvId);
    setActiveScreen('inbox');
  };

  const sendMessage = (
    conversationId: string,
    content: string,
    mode: 'client_reply' | 'internal_note'
  ) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const time = nowHHMM();

    updateActiveTenant((tenant) => ({
      ...tenant,
      conversations: tenant.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        const nextStatus =
          mode === 'client_reply' && conv.status === 'aguardando' ? 'humano' : conv.status;
        return {
          ...conv,
          status: nextStatus,
          aiActive: mode === 'client_reply' ? false : conv.aiActive,
          lastMessageAt: time,
          messages: [
            ...conv.messages,
            {
              id: `msg-${Date.now()}`,
              sender: mode === 'internal_note' ? 'internal_note' : 'human',
              senderName: mode === 'internal_note' ? 'Você (Nota Interna)' : 'Você (Admin)',
              content: trimmed,
              timestamp: time,
            },
          ],
        };
      }),
    }));
  };

  const toggleConversationAI = (conversationId: string) => {
    const time = nowHHMM();
    let targetState = false;
    updateActiveTenant((tenant) => ({
      ...tenant,
      conversations: tenant.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        const nextAiActive = !conv.aiActive;
        targetState = nextAiActive;
        return {
          ...conv,
          aiActive: nextAiActive,
          status: nextAiActive ? 'ia' : 'humano',
          messages: [
            ...conv.messages,
            {
              id: `sys-${Date.now()}`,
              sender: 'internal_note',
              senderName: 'Controle de Atendimento',
              content: nextAiActive
                ? `Conversa devolvida para o agente ${tenant.agentConfig.name}.`
                : 'Atendimento assumido manualmente por um atendente humano.',
              timestamp: time,
            },
          ],
        };
      }),
    }));
    showToast(
      targetState
        ? `Agente ${activeTenant.agentConfig.name} reassumiu a conversa`
        : 'Você assumiu o atendimento manualmente'
    );
  };

  const sendPixChargeInChat = (conversationId: string, description: string, amount: number) => {
    const time = nowHHMM();
    const pixId = `pix-${Date.now()}`;
    const copyPasteCode = buildPixCopyPasteCode(activeTenant.name, amount, pixId);

    updateActiveTenant((tenant) => {
      const conv = tenant.conversations.find((c) => c.id === conversationId);
      const contact = tenant.contacts.find((c) => c.id === conv?.contactId);

      return {
        ...tenant,
        conversations: tenant.conversations.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                lastMessageAt: time,
                messages: [
                  ...c.messages,
                  {
                    id: `msg-pix-${Date.now()}`,
                    sender: c.aiActive ? 'ai' : 'human',
                    senderName: c.aiActive ? tenant.agentConfig.name : 'Você (Admin)',
                    content: `Cobrança Pix gerada para "${description}". Assim que o pagamento for efetuado, a confirmação aparece automaticamente aqui.`,
                    timestamp: time,
                    pix: {
                      id: pixId,
                      description,
                      amount,
                      status: 'pendente',
                      copyPasteCode,
                      expiresAt: 'Expira em 24h',
                    },
                  },
                ],
              }
        ),
        contacts: contact
          ? tenant.contacts.map((ct) =>
              ct.id === contact.id ? { ...ct, stage: 'aguardando_pagamento' } : ct
            )
          : tenant.contacts,
        deals: contact
          ? tenant.deals.map((d) =>
              d.contactId === contact.id ? { ...d, stage: 'aguardando_pagamento' } : d
            )
          : tenant.deals,
      };
    });

    showToast('Cobrança Pix enviada no chat com sucesso');
  };

  const confirmPixPayment = (conversationId: string, messageId: string) => {
    const time = nowHHMM();
    const todayStr = '25/11/2026';

    updateActiveTenant((tenant) => {
      const conv = tenant.conversations.find((c) => c.id === conversationId);
      const targetMsg = conv?.messages.find((m) => m.id === messageId);
      if (!conv || !targetMsg?.pix || targetMsg.pix.status === 'pago') return tenant;

      const contact = tenant.contacts.find((c) => c.id === conv.contactId);
      const clientName = contact?.name ?? 'Cliente WhatsApp';
      const paidAmount = targetMsg.pix.amount;
      const pixDesc = targetMsg.pix.description;

      return {
        ...tenant,
        conversations: tenant.conversations.map((c) =>
          c.id !== conversationId
            ? c
            : {
                ...c,
                lastMessageAt: time,
                messages: c.messages.map((m) =>
                  m.id === messageId && m.pix
                    ? { ...m, pix: { ...m.pix, status: 'pago', paidAt: time } }
                    : m
                ),
              }
        ),
        contacts: contact
          ? tenant.contacts.map((ct) => (ct.id === contact.id ? { ...ct, stage: 'ganho' } : ct))
          : tenant.contacts,
        deals: contact
          ? tenant.deals.map((d) =>
              d.contactId === contact.id
                ? { ...d, stage: 'ganho', lastInteraction: 'Pix pago agora' }
                : d
            )
          : tenant.deals,
        recentActivity: [
          {
            id: `act-${Date.now()}`,
            type: 'pix_confirmed',
            title: `Pix confirmado — ${clientName}`,
            subtitle: pixDesc,
            timestamp: 'Agora mesmo',
            amount: paidAmount,
          },
          ...tenant.recentActivity,
        ],
        invoices: [
          {
            id: `inv-${Date.now()}`,
            date: todayStr,
            description: `Pix recebido — ${pixDesc}`,
            type: 'Pix no Chat',
            clientOrRef: clientName,
            amount: paidAmount,
            status: 'Pago',
          },
          ...tenant.invoices,
        ],
      };
    });

    showToast('Pagamento Pix confirmado! Dashboard e Financeiro atualizados.');
  };

  const updateContactStage = (contactId: string, stage: CrmStage) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) => (c.id === contactId ? { ...c, stage } : c)),
      deals: tenant.deals.map((d) =>
        d.contactId === contactId ? { ...d, stage, lastInteraction: 'Agora mesmo' } : d
      ),
    }));
    showToast('Etapa do funil CRM atualizada');
  };

  const toggleContactTag = (contactId: string, tag: string) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) => {
        if (c.id !== contactId) return c;
        const exists = c.tags.includes(tag);
        return {
          ...c,
          tags: exists ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
        };
      }),
    }));
  };

  const moveDeal = (dealId: string, nextStage: CrmStage) => {
    updateActiveTenant((tenant) => {
      const targetDeal = tenant.deals.find((d) => d.id === dealId);
      const updatedDeals = moveDealToStage(tenant.deals, dealId, nextStage);
      return {
        ...tenant,
        deals: updatedDeals,
        contacts: targetDeal
          ? tenant.contacts.map((c) =>
              c.id === targetDeal.contactId ? { ...c, stage: nextStage } : c
            )
          : tenant.contacts,
      };
    });
  };

  const createDeal = (payload: {
    title: string;
    clientName: string;
    phone: string;
    value: number;
    stage: CrmStage;
    origin: string;
    tags: string[];
  }) => {
    const newContactId = `cnt-${Date.now()}`;
    const newDealId = `deal-${Date.now()}`;
    const newContact: Contact = {
      id: newContactId,
      name: payload.clientName,
      phone: payload.phone || '+55 (11) 99000-0000',
      email: `${payload.clientName.toLowerCase().replace(/\s+/g, '.')}@cliente.com.br`,
      stage: payload.stage,
      tags: payload.tags.length > 0 ? payload.tags : ['Novo'],
      lgpdStatus: 'ativo',
      lgpdVerifiedAt: '25/11/2026',
      origin: payload.origin,
      avatarInitials: getInitials(payload.clientName),
    };

    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: [newContact, ...tenant.contacts],
      deals: [
        {
          id: newDealId,
          contactId: newContactId,
          title: payload.title,
          clientName: payload.clientName,
          value: payload.value,
          stage: payload.stage,
          tags: payload.tags.length > 0 ? payload.tags : ['Novo'],
          origin: payload.origin,
          lastInteraction: 'Agora mesmo',
        },
        ...tenant.deals,
      ],
    }));

    showToast(`Negócio "${payload.title}" criado no funil`);
  };

  const anonymizeContact = (contactId: string) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) =>
        c.id === contactId ? anonymizeContactRecord(c) : c
      ),
      deals: tenant.deals.map((d) =>
        d.contactId === contactId
          ? { ...d, clientName: `Titular Anonimizado #${contactId.slice(-4).toUpperCase()}` }
          : d
      ),
    }));
    showToast('Dados pessoais anonimizados conforme protocolo LGPD');
  };

  const importSimulatedCsvContacts = (
    rows: { name: string; phone: string; email: string; tag: string }[]
  ) => {
    const newContacts: Contact[] = rows.map((row, idx) => ({
      id: `cnt-csv-${Date.now()}-${idx}`,
      name: row.name,
      phone: row.phone,
      email: row.email,
      stage: 'novo_lead',
      tags: [row.tag || 'Importado CSV'],
      lgpdStatus: 'ativo',
      lgpdVerifiedAt: '25/11/2026',
      origin: 'Importação CSV',
      avatarInitials: getInitials(row.name),
    }));

    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: [...newContacts, ...tenant.contacts],
    }));
    showToast(`${newContacts.length} contatos importados para a base LGPD`);
  };

  const updateAgentConfig = (patch: Partial<AIAgentConfig>) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      agentConfig: {
        ...tenant.agentConfig,
        ...patch,
      },
    }));
  };

  const addKnowledgeSource = (source: Omit<KnowledgeSource, 'id' | 'addedAt'>) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      agentConfig: {
        ...tenant.agentConfig,
        knowledgeBase: [
          {
            ...source,
            id: `kb-${Date.now()}`,
            addedAt: 'Hoje',
          },
          ...tenant.agentConfig.knowledgeBase,
        ],
      },
    }));
    showToast(`Fonte "${source.title}" indexada na base RAG`);
  };

  const removeKnowledgeSource = (sourceId: string) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      agentConfig: {
        ...tenant.agentConfig,
        knowledgeBase: tenant.agentConfig.knowledgeBase.filter((k) => k.id !== sourceId),
      },
    }));
  };

  const changePlanTier = (tier: PlanTier) => {
    const spec = PLAN_CATALOG[tier];
    updateActiveTenant((tenant) => ({
      ...tenant,
      mrr: spec.price,
      billing: {
        ...tenant.billing,
        tier,
        monthlyPrice: spec.price,
        usersLimit: spec.usersLimit,
        whatsappLimit: spec.whatsappLimit,
        aiInteractionsLimit: spec.aiInteractionsLimit,
      },
    }));
    showToast(`Plano atualizado para ${tier} (R$ ${spec.price}/mês)`);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (n.tenantId === activeTenantId ? { ...n, read: true } : n))
    );
  };

  const tenantNotifications = useMemo(
    () => notifications.filter((n) => n.tenantId === activeTenantId),
    [notifications, activeTenantId]
  );

  return (
    <FoclientContext.Provider
      value={{
        tenants,
        activeTenantId,
        activeTenant,
        activeScreen,
        selectedConversationId,
        theme,
        globalSearchOpen,
        notifications: tenantNotifications,
        toastMessage,
        setActiveScreen,
        switchTenant,
        setSelectedConversationId: handleSelectConversation,
        openContactInChat,
        toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
        setGlobalSearchOpen,
        markAllNotificationsRead,
        dismissToast: () => setToastMessage(null),
        sendMessage,
        toggleConversationAI,
        sendPixChargeInChat,
        confirmPixPayment,
        updateContactStage,
        toggleContactTag,
        moveDeal,
        createDeal,
        anonymizeContact,
        importSimulatedCsvContacts,
        updateAgentConfig,
        addKnowledgeSource,
        removeKnowledgeSource,
        changePlanTier,
      }}
    >
      {children}
    </FoclientContext.Provider>
  );
}

export function useFoclient() {
  const ctx = useContext(FoclientContext);
  if (!ctx) throw new Error('useFoclient must be used within FoclientProvider');
  return ctx;
}
