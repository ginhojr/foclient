import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AIAgentConfig,
  AppNotification,
  AuthUser,
  Contact,
  CrmStage,
  KnowledgeSource,
  PlanTier,
  ScreenId,
  TenantData,
  ThemeMode,
  WhatsAppLiveStatus,
} from '../types/foclient';
import { INITIAL_NOTIFICATIONS, INITIAL_TENANTS, PLAN_CATALOG } from '../data/mockTenants';
import {
  anonymizeContactRecord,
  getInitials,
  moveDealToStage,
} from '../utils/foclientLogic';
import {
  api,
  clearAuthTokens,
  getStoredAccessToken,
  setAuthTokens,
  setStoredTenantId,
} from '../services/api';
import {
  connectSocket,
  disconnectSocket,
  joinTenantSocketRoom,
} from '../services/socket';

interface FoclientContextValue {
  // Auth & Multi-tenancy
  user: AuthUser | null;
  authReady: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerTenant: (payload: {
    companyName: string;
    segment: string;
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;

  // Workspace State
  tenants: TenantData[];
  activeTenantId: string;
  activeTenant: TenantData;
  activeScreen: ScreenId;
  selectedConversationId: string | null;
  theme: ThemeMode;
  globalSearchOpen: boolean;
  notifications: AppNotification[];
  toastMessage: string | null;
  whatsappStatus: WhatsAppLiveStatus;

  // Navigation & UI
  setActiveScreen: (screen: ScreenId) => void;
  switchTenant: (tenantId: string, navigateTo?: ScreenId) => void;
  setSelectedConversationId: (convId: string | null) => void;
  openContactInChat: (contactId: string) => void;
  toggleTheme: () => void;
  setGlobalSearchOpen: (open: boolean) => void;
  markAllNotificationsRead: () => void;
  dismissToast: () => void;

  // WhatsApp Real Engine
  refreshWhatsAppStatus: () => Promise<void>;
  connectWhatsAppSession: () => Promise<void>;
  disconnectWhatsAppSession: () => Promise<void>;
  sendDirectWhatsAppTest: (to: string, text: string) => Promise<void>;

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
  importSimulatedCsvContacts: (
    rows: { name: string; phone: string; email: string; tag: string }[]
  ) => void;

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

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
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppLiveStatus>({
    provider: 'BAILEYS',
    engineName: 'Baileys Multi-Device WebSocket',
    status: 'DISCONNECTED',
    qrCode: null,
    phoneNumber: null,
  });

  const agentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTenant = useMemo(
    () => tenants.find((t) => t.id === activeTenantId) ?? tenants[0],
    [tenants, activeTenantId]
  );

  const showToast = useCallback((msg: string) => setToastMessage(msg), []);

  const loadWorkspaceFromBackend = useCallback(async (preferredTenantId?: string) => {
    const data = await api.getTenants();
    if (Array.isArray(data.tenants) && data.tenants.length > 0) {
      setTenants(data.tenants);
      const targetId =
        preferredTenantId && data.tenants.some((t: TenantData) => t.id === preferredTenantId)
          ? preferredTenantId
          : data.activeTenantId && data.tenants.some((t: TenantData) => t.id === data.activeTenantId)
            ? data.activeTenantId
            : data.tenants[0].id;

      setActiveTenantId(targetId);
      setStoredTenantId(targetId);
      const targetTenant = data.tenants.find((t: TenantData) => t.id === targetId) ?? data.tenants[0];
      setSelectedConversationId(targetTenant.conversations[0]?.id ?? null);

      try {
        const wa = await api.getWhatsAppStatus();
        setWhatsappStatus(wa);
      } catch {
        // ignore
      }
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setAuthReady(true);
      return;
    }

    (async () => {
      try {
        const meRes = await api.me();
        setUser(meRes.user);
        await loadWorkspaceFromBackend(meRes.user.tenantId);
      } catch {
        clearAuthTokens();
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    })();
  }, [loadWorkspaceFromBackend]);

  // Real-time Socket.io binding when authenticated
  useEffect(() => {
    if (!user || !activeTenantId) return;

    const sock = connectSocket(activeTenantId);
    joinTenantSocketRoom(activeTenantId);

    const onWhatsAppQr = (payload: any) => {
      if (payload.tenantId && payload.tenantId !== activeTenantId) return;
      setWhatsappStatus((prev) => ({
        ...prev,
        status: 'QR_READY',
        qrCode: payload.qrCode,
      }));
    };

    const onWhatsAppStatus = (payload: any) => {
      if (payload.tenantId && payload.tenantId !== activeTenantId) return;
      setWhatsappStatus((prev) => ({
        ...prev,
        status: payload.status ?? prev.status,
        qrCode: payload.qrCode !== undefined ? payload.qrCode : prev.qrCode,
        phoneNumber: payload.phoneNumber !== undefined ? payload.phoneNumber : prev.phoneNumber,
        engineName: payload.engineName ?? prev.engineName,
      }));
      if (payload.status === 'CONNECTED') {
        showToast(
          `WhatsApp conectado com sucesso (${payload.phoneNumber || 'Sessão Ativa'})!`
        );
      }
    };

    const onNewMessage = (payload: any) => {
      if (payload.tenantId && payload.tenantId !== activeTenantId) return;
      setTenants((prev) =>
        prev.map((t) => {
          if (t.id !== activeTenantId) return t;

          let nextContacts = t.contacts;
          if (payload.contact) {
            const exists = t.contacts.some((c) => c.id === payload.contact.id);
            nextContacts = exists
              ? t.contacts.map((c) => (c.id === payload.contact.id ? payload.contact : c))
              : [payload.contact, ...t.contacts];
          }

          let nextConversations = t.conversations;
          if (payload.conversation) {
            const existsConv = t.conversations.some((c) => c.id === payload.conversation.id);
            nextConversations = existsConv
              ? t.conversations.map((c) =>
                  c.id === payload.conversation.id ? payload.conversation : c
                )
              : [payload.conversation, ...t.conversations];
          }

          return {
            ...t,
            contacts: nextContacts,
            conversations: nextConversations,
          };
        })
      );

      if (payload.message?.sender === 'client') {
        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            tenantId: activeTenantId,
            title: `Nova mensagem de ${payload.message.senderName}`,
            description: payload.message.content,
            time: 'Agora',
            read: false,
            screen: 'inbox',
          },
          ...prev,
        ]);
      }
    };

    const onHandoff = (payload: any) => {
      if (payload.tenantId && payload.tenantId !== activeTenantId) return;
      if (payload.conversation) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id !== activeTenantId
              ? t
              : {
                  ...t,
                  conversations: t.conversations.map((c) =>
                    c.id === payload.conversation.id ? payload.conversation : c
                  ),
                }
          )
        );
      }
      if (payload.contactName) {
        setNotifications((prev) => [
          {
            id: `handoff-${Date.now()}`,
            tenantId: activeTenantId,
            title: `Transbordo IA → Humano (${payload.contactName})`,
            description: payload.reason || 'Cliente solicitou atendimento humano.',
            time: 'Agora',
            read: false,
            screen: 'inbox',
          },
          ...prev,
        ]);
        showToast(`Transbordo de IA: ${payload.contactName} aguarda atendente humano!`);
      }
    };

    const onPixConfirmed = (payload: any) => {
      if (payload.tenantId && payload.tenantId !== activeTenantId) return;
      loadWorkspaceFromBackend(activeTenantId).catch(() => {});
    };

    sock.on('whatsapp:qr', onWhatsAppQr);
    sock.on('whatsapp:status', onWhatsAppStatus);
    sock.on('message:new', onNewMessage);
    sock.on('conversation:handoff', onHandoff);
    sock.on('pix:confirmed', onPixConfirmed);

    return () => {
      sock.off('whatsapp:qr', onWhatsAppQr);
      sock.off('whatsapp:status', onWhatsAppStatus);
      sock.off('message:new', onNewMessage);
      sock.off('conversation:handoff', onHandoff);
      sock.off('pix:confirmed', onPixConfirmed);
    };
  }, [user, activeTenantId, loadWorkspaceFromBackend, showToast]);

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

  const login = async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const res = await api.login(email, password);
      setAuthTokens(res.accessToken, res.refreshToken, res.user.tenantId);
      setUser(res.user);
      await loadWorkspaceFromBackend(res.user.tenantId);
      setActiveScreen('dashboard');
      showToast(`Bem-vindo(a), ${res.user.name}!`);
    } finally {
      setAuthLoading(false);
    }
  };

  const registerTenant = async (payload: {
    companyName: string;
    segment: string;
    name: string;
    email: string;
    password: string;
  }) => {
    setAuthLoading(true);
    try {
      const res = await api.register(payload);
      setAuthTokens(res.accessToken, res.refreshToken, res.user.tenantId);
      setUser(res.user);
      await loadWorkspaceFromBackend(res.user.tenantId);
      setActiveScreen('dashboard');
      showToast(`Empresa "${payload.companyName}" criada no Neon PostgreSQL!`);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    clearAuthTokens();
    disconnectSocket();
    setUser(null);
    setActiveScreen('dashboard');
  };

  const updateActiveTenant = (updater: (tenant: TenantData) => TenantData) => {
    setTenants((prev) => prev.map((t) => (t.id === activeTenantId ? updater(t) : t)));
  };

  const switchTenant = async (tenantId: string, navigateTo?: ScreenId) => {
    const nextTenant = tenants.find((t) => t.id === tenantId);
    if (!nextTenant) return;

    setActiveTenantId(tenantId);
    setStoredTenantId(tenantId);
    setSelectedConversationId(nextTenant.conversations[0]?.id ?? null);
    joinTenantSocketRoom(tenantId);

    if (navigateTo) {
      setActiveScreen(navigateTo);
    }

    if (user?.role === 'SUPER_ADMIN') {
      try {
        const switched = await api.switchTenant(tenantId);
        if (switched.accessToken) {
          setAuthTokens(switched.accessToken, undefined, tenantId);
        }
        if (switched.tenant) {
          setTenants((prev) =>
            prev.map((t) => (t.id === tenantId ? switched.tenant : t))
          );
        }
        const wa = await api.getWhatsAppStatus();
        setWhatsappStatus(wa);
      } catch (err) {
        console.warn('[switchTenant] sync warning:', err);
      }
    }

    showToast(`Empresa ativa alterada para ${nextTenant.name}`);
  };

  const refreshWhatsAppStatus = useCallback(async () => {
    try {
      const status = await api.getWhatsAppStatus();
      setWhatsappStatus(status);
    } catch {
      // ignore
    }
  }, []);

  const connectWhatsAppSession = async () => {
    try {
      const status = await api.connectWhatsApp();
      setWhatsappStatus(status);
      if (status.status === 'QR_READY') {
        showToast('QR Code gerado! Escaneie com o WhatsApp do seu celular.');
      } else if (status.status === 'CONNECTED') {
        showToast('WhatsApp conectado com sucesso!');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao iniciar sessão WhatsApp.');
    }
  };

  const disconnectWhatsAppSession = async () => {
    try {
      await api.disconnectWhatsApp();
      setWhatsappStatus((prev) => ({
        ...prev,
        status: 'DISCONNECTED',
        qrCode: null,
        phoneNumber: null,
      }));
      showToast('Sessão WhatsApp desconectada.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao desconectar WhatsApp.');
    }
  };

  const sendDirectWhatsAppTest = async (to: string, text: string) => {
    try {
      const res = await api.sendDirectWhatsApp(to, text);
      await loadWorkspaceFromBackend(activeTenantId);
      showToast(
        res.deliveredVia === 'baileys-whatsapp-real'
          ? 'Mensagem enviada no WhatsApp real com sucesso!'
          : 'Mensagem registrada na Inbox (conecte o QR Code para envio externo real).'
      );
    } catch (err: any) {
      showToast(err?.message || 'Falha ao enviar mensagem.');
    }
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
    api.getMessages(convId).catch(() => {});
  };

  const openContactInChat = async (contactId: string) => {
    const existing = activeTenant.conversations.find((c) => c.contactId === contactId);
    if (existing) {
      handleSelectConversation(existing.id);
      setActiveScreen('inbox');
      return;
    }

    try {
      const res = await api.openConversationForContact(contactId);
      if (res.conversation) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          conversations: [
            res.conversation,
            ...tenant.conversations.filter((c) => c.id !== res.conversation.id),
          ],
        }));
        setSelectedConversationId(res.conversation.id);
        setActiveScreen('inbox');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao abrir conversa.');
    }
  };

  const sendMessage = async (
    conversationId: string,
    content: string,
    mode: 'client_reply' | 'internal_note'
  ) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      const res = await api.sendMessage(conversationId, trimmed, mode);
      if (res.conversation) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          conversations: tenant.conversations.map((c) =>
            c.id === conversationId ? res.conversation : c
          ),
        }));
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao enviar mensagem.');
    }
  };

  const toggleConversationAI = async (conversationId: string) => {
    try {
      const res = await api.toggleHandoff(conversationId);
      if (res.conversation) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          conversations: tenant.conversations.map((c) =>
            c.id === conversationId ? res.conversation : c
          ),
        }));
        showToast(
          res.aiActive
            ? `Agente ${activeTenant.agentConfig.name} reassumiu a conversa`
            : 'Você assumiu o atendimento manualmente'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alternar modo IA/Humano.');
    }
  };

  const sendPixChargeInChat = async (
    conversationId: string,
    description: string,
    amount: number
  ) => {
    try {
      const res = await api.generatePix(conversationId, description, amount);
      if (res.conversation) {
        const targetContactId = res.conversation.contactId;
        updateActiveTenant((tenant) => ({
          ...tenant,
          conversations: tenant.conversations.map((c) =>
            c.id === conversationId ? res.conversation : c
          ),
          contacts: tenant.contacts.map((ct) =>
            ct.id === targetContactId ? { ...ct, stage: 'aguardando_pagamento' } : ct
          ),
          deals: tenant.deals.map((d) =>
            d.contactId === targetContactId ? { ...d, stage: 'aguardando_pagamento' } : d
          ),
        }));
      }
      showToast('Cobrança Pix gerada no Neon e enviada no chat!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar cobrança Pix.');
    }
  };

  const confirmPixPayment = async (conversationId: string, messageId: string) => {
    try {
      await api.confirmPixWebhook({ conversationId, messageId });
      await loadWorkspaceFromBackend(activeTenantId);
      showToast('Pagamento Pix confirmado! Dashboard, CRM e Financeiro atualizados.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao confirmar Pix.');
    }
  };

  const updateContactStage = async (contactId: string, stage: CrmStage) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) => (c.id === contactId ? { ...c, stage } : c)),
      deals: tenant.deals.map((d) =>
        d.contactId === contactId ? { ...d, stage, lastInteraction: nowHHMM() } : d
      ),
    }));

    try {
      await api.patchContact(contactId, { stage });
      showToast('Etapa do funil CRM salva no Neon');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar etapa.');
    }
  };

  const toggleContactTag = async (contactId: string, tag: string) => {
    const contact = activeTenant.contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const exists = contact.tags.includes(tag);
    const nextTags = exists
      ? contact.tags.filter((t) => t !== tag)
      : [...contact.tags, tag];

    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) =>
        c.id === contactId ? { ...c, tags: nextTags } : c
      ),
    }));

    api.patchContact(contactId, { tags: nextTags }).catch(() => {});
  };

  const moveDeal = async (dealId: string, nextStage: CrmStage) => {
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

    try {
      await api.moveDealStage(dealId, nextStage);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao mover card no Kanban.');
    }
  };

  const createDeal = async (payload: {
    title: string;
    clientName: string;
    phone: string;
    value: number;
    stage: CrmStage;
    origin: string;
    tags: string[];
  }) => {
    try {
      const res = await api.createDeal(payload);
      updateActiveTenant((tenant) => ({
        ...tenant,
        contacts: res.contact ? [res.contact, ...tenant.contacts] : tenant.contacts,
        deals: res.deal ? [res.deal, ...tenant.deals] : tenant.deals,
      }));
      showToast(`Negócio "${payload.title}" criado no banco Neon`);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar negócio.');
    }
  };

  const anonymizeContact = async (contactId: string) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      contacts: tenant.contacts.map((c) =>
        c.id === contactId ? anonymizeContactRecord(c) : c
      ),
      deals: tenant.deals.map((d) =>
        d.contactId === contactId
          ? {
              ...d,
              clientName: `Titular Anonimizado #${contactId.replace(/-/g, '').slice(-4).toUpperCase()}`,
            }
          : d
      ),
    }));

    try {
      const res = await api.anonymizeContact(contactId);
      if (res.contact) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          contacts: tenant.contacts.map((c) => (c.id === contactId ? res.contact : c)),
        }));
      }
      showToast('Dados pessoais anonimizados e Audit Log LGPD registrado!');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao anonimizar contato.');
    }
  };

  const importSimulatedCsvContacts = async (
    rows: { name: string; phone: string; email: string; tag: string }[]
  ) => {
    try {
      const res = await api.importContacts(rows);
      if (Array.isArray(res.contacts)) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          contacts: [...res.contacts, ...tenant.contacts],
        }));
        showToast(`${res.contacts.length} contatos importados no Neon PostgreSQL`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao importar CSV.');
    }
  };

  const updateAgentConfig = (patch: Partial<AIAgentConfig>) => {
    let mergedConfig: AIAgentConfig | null = null;
    updateActiveTenant((tenant) => {
      mergedConfig = {
        ...tenant.agentConfig,
        ...patch,
      };
      return {
        ...tenant,
        agentConfig: mergedConfig,
      };
    });

    if (agentSaveTimerRef.current) {
      clearTimeout(agentSaveTimerRef.current);
    }
    agentSaveTimerRef.current = setTimeout(() => {
      if (mergedConfig) {
        api.updateAIAgent(mergedConfig as unknown as Record<string, unknown>).catch(() => {});
      }
    }, 500);
  };

  const addKnowledgeSource = async (source: Omit<KnowledgeSource, 'id' | 'addedAt'>) => {
    try {
      const res = await api.addKnowledgeSource(source);
      if (res.source) {
        updateActiveTenant((tenant) => ({
          ...tenant,
          agentConfig: {
            ...tenant.agentConfig,
            knowledgeBase: [res.source, ...tenant.agentConfig.knowledgeBase],
          },
        }));
        showToast(`Fonte "${source.title}" indexada na base RAG (Neon)`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao indexar fonte RAG.');
    }
  };

  const removeKnowledgeSource = async (sourceId: string) => {
    updateActiveTenant((tenant) => ({
      ...tenant,
      agentConfig: {
        ...tenant.agentConfig,
        knowledgeBase: tenant.agentConfig.knowledgeBase.filter((k) => k.id !== sourceId),
      },
    }));
    api.removeKnowledgeSource(sourceId).catch(() => {});
  };

  const changePlanTier = async (tier: PlanTier) => {
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

    try {
      await api.updateSubscription(tier);
      showToast(`Plano atualizado para ${tier} (R$ ${spec.price}/mês) no Neon`);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar assinatura.');
    }
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
        user,
        authReady,
        authLoading,
        login,
        registerTenant,
        logout,
        tenants,
        activeTenantId,
        activeTenant,
        activeScreen,
        selectedConversationId,
        theme,
        globalSearchOpen,
        notifications: tenantNotifications,
        toastMessage,
        whatsappStatus,
        setActiveScreen,
        switchTenant,
        setSelectedConversationId: handleSelectConversation,
        openContactInChat,
        toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
        setGlobalSearchOpen,
        markAllNotificationsRead,
        dismissToast: () => setToastMessage(null),
        refreshWhatsAppStatus,
        connectWhatsAppSession,
        disconnectWhatsAppSession,
        sendDirectWhatsAppTest,
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
