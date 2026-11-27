export type ScreenId =
  | 'dashboard'
  | 'inbox'
  | 'kanban'
  | 'contacts'
  | 'ai-studio'
  | 'channels'
  | 'billing'
  | 'super-admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'AGENT';
  tenantId: string;
  tenantName: string;
}

export interface WhatsAppLiveStatus {
  provider: 'BAILEYS' | 'OPENWA' | 'META_CLOUD_API';
  engineName: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';
  qrCode: string | null;
  phoneNumber: string | null;
  lastConnectedAt?: string | null;
}

export type ThemeMode = 'light' | 'dark';

export type CrmStage =
  | 'novo_lead'
  | 'qualificado_ia'
  | 'proposta_enviada'
  | 'aguardando_pagamento'
  | 'ganho';

export const CRM_STAGES: { id: CrmStage; label: string; shortLabel: string }[] = [
  { id: 'novo_lead', label: 'Novo Lead', shortLabel: 'Novo Lead' },
  { id: 'qualificado_ia', label: 'Qualificado pela IA', shortLabel: 'Qualificado IA' },
  { id: 'proposta_enviada', label: 'Proposta Enviada', shortLabel: 'Proposta' },
  { id: 'aguardando_pagamento', label: 'Aguardando Pagamento', shortLabel: 'Aguard. Pix' },
  { id: 'ganho', label: 'Ganho', shortLabel: 'Ganho' },
];

export type ConversationStatus = 'ia' | 'humano' | 'aguardando';

export type MessageSender = 'client' | 'human' | 'ai' | 'internal_note';

export interface PixChargePayload {
  id: string;
  description: string;
  amount: number;
  status: 'pendente' | 'pago';
  copyPasteCode: string;
  expiresAt: string;
  paidAt?: string;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  senderName: string;
  content: string;
  timestamp: string;
  pix?: PixChargePayload;
}

export interface Conversation {
  id: string;
  contactId: string;
  status: ConversationStatus;
  unreadCount: number;
  channel: 'WhatsApp Oficial';
  lastMessageAt: string;
  aiActive: boolean;
  aiSummary: string;
  messages: ChatMessage[];
}

export type LgpdStatus = 'ativo' | 'opt_out' | 'anonimizado';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  stage: CrmStage;
  tags: string[];
  lgpdStatus: LgpdStatus;
  lgpdVerifiedAt?: string;
  origin: string;
  avatarInitials: string;
}

export interface Deal {
  id: string;
  contactId: string;
  title: string;
  clientName: string;
  value: number;
  stage: CrmStage;
  tags: string[];
  origin: string;
  lastInteraction: string;
}

export type AgentTone = 'Consultivo' | 'Amigável' | 'Direto';

export interface KnowledgeSource {
  id: string;
  type: 'pdf' | 'url';
  title: string;
  sizeOrUrl: string;
  addedAt: string;
  snippet: string;
}

export interface AIAgentConfig {
  name: string;
  roleTitle: string;
  tone: AgentTone;
  systemPrompt: string;
  skills: {
    transcribeAudio: boolean;
    generatePixLink: boolean;
    handoffOnFrustration: boolean;
  };
  knowledgeBase: KnowledgeSource[];
}

export type PlanTier = 'Starter' | 'Growth' | 'Scale';

export interface TenantPlanUsage {
  tier: PlanTier;
  monthlyPrice: number;
  usersUsed: number;
  usersLimit: number;
  whatsappUsed: number;
  whatsappLimit: number;
  aiInteractionsUsed: number;
  aiInteractionsLimit: number;
  renewalDate: string;
}

export interface BillingInvoice {
  id: string;
  date: string;
  description: string;
  type: 'Assinatura SaaS' | 'Pix no Chat';
  clientOrRef: string;
  amount: number;
  status: 'Pago' | 'Pendente';
}

export interface DailyVolumePoint {
  day: string;
  ia: number;
  humano: number;
}

export interface ActivityEvent {
  id: string;
  type: 'pix_confirmed' | 'ai_handoff' | 'deal_won';
  title: string;
  subtitle: string;
  timestamp: string;
  amount?: number;
}

export type TenantStatus = 'Ativo' | 'Trial' | 'Inadimplente';

export interface TenantData {
  id: string;
  name: string;
  segment: string;
  whatsappNumber: string;
  status: TenantStatus;
  mrr: number;
  avgResponseSeconds: number;
  baseChatsToday: number;
  chatsGrowthPct: number;
  baseAiResolvedPct: number;
  dailyVolume: DailyVolumePoint[];
  recentActivity: ActivityEvent[];
  contacts: Contact[];
  conversations: Conversation[];
  deals: Deal[];
  agentConfig: AIAgentConfig;
  billing: TenantPlanUsage;
  invoices: BillingInvoice[];
  quickReplies: { shortcut: string; title: string; text: string }[];
}

export interface AppNotification {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  screen: ScreenId;
}
