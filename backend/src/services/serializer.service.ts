import {
  AIAgent,
  BillingInvoice,
  Contact,
  Conversation,
  Deal,
  Message,
  PixCharge,
  PlanTier,
  Tenant,
  TenantStatus,
  User,
  WhatsAppInstance,
} from '@prisma/client';

export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function formatPhoneDisplay(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 9);
    const p2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 8);
    const p2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  return raw.startsWith('+') ? raw : `+${digits || raw}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatTimeHHMM(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

export function mapPlanToFrontend(plan: PlanTier): 'Starter' | 'Growth' | 'Scale' {
  if (plan === 'STARTER') return 'Starter';
  if (plan === 'SCALE') return 'Scale';
  return 'Growth';
}

export function mapPlanFromFrontend(tier: string): PlanTier {
  const upper = tier.toUpperCase();
  if (upper === 'STARTER') return 'STARTER';
  if (upper === 'SCALE') return 'SCALE';
  return 'GROWTH';
}

export function mapTenantStatusToFrontend(
  status: TenantStatus
): 'Ativo' | 'Trial' | 'Inadimplente' {
  if (status === 'TRIAL') return 'Trial';
  if (status === 'PAST_DUE') return 'Inadimplente';
  return 'Ativo';
}

export function serializeContact(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    stage: contact.stage,
    tags: contact.tags,
    lgpdStatus: contact.lgpdStatus,
    lgpdConsent: contact.lgpdConsent,
    lgpdVerifiedAt: contact.lgpdConsentAt ? formatDateBR(contact.lgpdConsentAt) : undefined,
    origin: contact.origin,
    avatarInitials: contact.lgpdStatus === 'anonimizado' ? 'LG' : getInitials(contact.name),
  };
}

export function serializeMessage(msg: Message & { pixCharge?: PixCharge | null }) {
  const senderMap = {
    CONTACT: 'client',
    AGENT: 'human',
    AI: 'ai',
    INTERNAL_NOTE: 'internal_note',
  } as const;

  return {
    id: msg.id,
    sender: senderMap[msg.senderType],
    senderName: msg.senderName,
    content: msg.content,
    timestamp: formatTimeHHMM(msg.createdAt),
    mediaUrl: msg.mediaUrl ?? undefined,
    mediaType: msg.mediaType ?? undefined,
    externalId: msg.externalId ?? undefined,
    pix: msg.pixCharge
      ? {
          id: msg.pixCharge.id,
          description: msg.pixCharge.description,
          amount: msg.pixCharge.amount,
          status: msg.pixCharge.status === 'PAID' ? ('pago' as const) : ('pendente' as const),
          copyPasteCode: msg.pixCharge.copyPasteCode,
          expiresAt: 'Expira em 24h',
          paidAt: msg.pixCharge.paidAt ? formatTimeHHMM(msg.pixCharge.paidAt) : undefined,
        }
      : undefined,
  };
}

export function serializeConversation(
  conv: Conversation & {
    messages: (Message & { pixCharge?: PixCharge | null })[];
  }
) {
  const statusMap = {
    BOT: 'ia',
    OPEN: 'humano',
    PENDING: 'aguardando',
    CLOSED: 'humano',
  } as const;

  return {
    id: conv.id,
    contactId: conv.contactId,
    status: statusMap[conv.status],
    dbStatus: conv.status,
    unreadCount: conv.unreadCount,
    channel: 'WhatsApp Oficial' as const,
    lastMessageAt: formatTimeHHMM(conv.lastMessageAt),
    aiActive: conv.status === 'BOT',
    aiSummary:
      conv.aiSummary ??
      'Atendimento ativo via WhatsApp sincronizado com o banco PostgreSQL na nuvem (Neon).',
    messages: conv.messages.map(serializeMessage),
  };
}

export function serializeDeal(deal: Deal & { contact?: Contact | null }) {
  return {
    id: deal.id,
    contactId: deal.contactId,
    title: deal.title,
    clientName: deal.contact?.name ?? 'Cliente',
    value: deal.value,
    stage: deal.stage,
    tags: deal.tags,
    origin: deal.origin,
    lastInteraction: formatTimeHHMM(deal.lastInteractionAt),
  };
}

export function serializeAIAgent(agent: AIAgent | null, tenantName: string) {
  if (!agent) {
    return {
      name: 'Clara IA',
      roleTitle: `Especialista Digital — ${tenantName}`,
      tone: 'Consultivo' as const,
      systemPrompt: `Atue como especialista comercial da ${tenantName}. Qualifique o lead com cordialidade, tire dúvidas e ofereça pagamento via Pix quando apropriado.`,
      skills: {
        transcribeAudio: true,
        generatePixLink: true,
        handoffOnFrustration: true,
      },
      knowledgeBase: [],
    };
  }

  return {
    id: agent.id,
    name: agent.name,
    roleTitle: agent.roleTitle,
    tone: agent.tone as 'Consultivo' | 'Amigável' | 'Direto',
    systemPrompt: agent.systemPrompt,
    skills: {
      transcribeAudio: agent.transcribeAudio,
      generatePixLink: agent.generatePixLink,
      handoffOnFrustration: agent.handoffOnFrustration,
    },
    knowledgeBase: Array.isArray(agent.knowledgeDocuments) ? agent.knowledgeDocuments : [],
  };
}

export type FullTenantRecord = Tenant & {
  contacts: Contact[];
  conversations: (Conversation & {
    messages: (Message & { pixCharge?: PixCharge | null })[];
  })[];
  deals: (Deal & { contact?: Contact | null })[];
  aiAgent: AIAgent | null;
  billingInvoices: BillingInvoice[];
  users: Pick<User, 'id'>[];
  whatsappInstances: WhatsAppInstance[];
};

export function serializeFullTenant(tenant: FullTenantRecord) {
  const settings = (tenant.settings ?? {}) as {
    dailyVolume?: { day: string; ia: number; humano: number }[];
    recentActivity?: {
      id: string;
      type: 'pix_confirmed' | 'ai_handoff' | 'deal_won';
      title: string;
      subtitle: string;
      timestamp: string;
      amount?: number;
    }[];
    quickReplies?: { shortcut: string; title: string; text: string }[];
  };

  const connectedWa = tenant.whatsappInstances.find((w) => w.status === 'CONNECTED');

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    segment: tenant.segment,
    whatsappNumber: connectedWa?.phoneNumber ?? tenant.whatsappNumber,
    whatsappStatus: connectedWa ? 'CONNECTED' : (tenant.whatsappInstances[0]?.status ?? 'DISCONNECTED'),
    status: mapTenantStatusToFrontend(tenant.status),
    mrr: tenant.mrr,
    avgResponseSeconds: tenant.avgResponseSeconds,
    baseChatsToday: Math.max(tenant.baseChatsToday, tenant.conversations.length),
    chatsGrowthPct: tenant.chatsGrowthPct,
    baseAiResolvedPct: tenant.baseAiResolvedPct,
    dailyVolume: settings.dailyVolume ?? [
      { day: 'Seg', ia: 64, humano: 28 },
      { day: 'Ter', ia: 78, humano: 31 },
      { day: 'Qua', ia: 92, humano: 35 },
      { day: 'Qui', ia: 85, humano: 29 },
      { day: 'Sex', ia: 110, humano: 42 },
      { day: 'Sáb', ia: 54, humano: 18 },
      { day: 'Dom', ia: 41, humano: 12 },
    ],
    recentActivity: settings.recentActivity ?? [],
    contacts: tenant.contacts.map(serializeContact),
    conversations: tenant.conversations.map(serializeConversation),
    deals: tenant.deals.map(serializeDeal),
    agentConfig: serializeAIAgent(tenant.aiAgent, tenant.name),
    billing: {
      tier: mapPlanToFrontend(tenant.plan),
      monthlyPrice: tenant.mrr,
      usersUsed: Math.max(1, tenant.users.length),
      usersLimit: tenant.usersLimit,
      whatsappUsed: Math.max(1, tenant.whatsappInstances.filter((w) => w.status === 'CONNECTED').length || 1),
      whatsappLimit: tenant.whatsappLimit,
      aiInteractionsUsed: tenant.aiInteractionsUsed,
      aiInteractionsLimit: tenant.aiInteractionsLimit,
      renewalDate: tenant.renewalDate,
    },
    invoices: tenant.billingInvoices.map((inv) => ({
      id: inv.id,
      date: formatDateBR(inv.issuedAt),
      description: inv.description,
      type: inv.type as 'Assinatura SaaS' | 'Pix no Chat',
      clientOrRef: inv.clientOrRef,
      amount: inv.amount,
      status: inv.status as 'Pago' | 'Pendente',
    })),
    quickReplies: settings.quickReplies ?? [
      {
        shortcut: '/boasvindas',
        title: 'Boas-vindas Consultiva',
        text: `Olá! Seja muito bem-vindo(a) à ${tenant.name}. Como posso ajudar você hoje?`,
      },
      {
        shortcut: '/pix',
        title: 'Condição Especial no Pix',
        text: 'Consigo liberar uma condição especial à vista via Pix com confirmação imediata aqui no chat!',
      },
      {
        shortcut: '/retorno',
        title: 'Acompanhamento Comercial',
        text: 'Oi! Passando para saber se conseguiu avaliar nossa proposta ou se ficou alguma dúvida.',
      },
    ],
  };
}
