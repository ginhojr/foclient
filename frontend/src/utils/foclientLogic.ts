import {
  AIAgentConfig,
  Contact,
  Conversation,
  CrmStage,
  CRM_STAGES,
  Deal,
  TenantData,
} from '../types/foclient';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getStageLabel(stage: CrmStage): string {
  return CRM_STAGES.find((s) => s.id === stage)?.label ?? 'Novo Lead';
}

export function calculateTenantMetrics(tenant: TenantData) {
  const paidPixTotal = tenant.invoices
    .filter((inv) => inv.type === 'Pix no Chat' && inv.status === 'Pago')
    .reduce((acc, inv) => acc + inv.amount, 0);

  const totalConversations = tenant.conversations.length;
  const aiConversations = tenant.conversations.filter((c) => c.aiActive).length;
  const unreadTotal = tenant.conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Blend realistic daily baseline with live in-memory state updates
  const aiResolvedPct =
    totalConversations > 0
      ? Math.min(
          98,
          Math.max(
            20,
            Math.round(tenant.baseAiResolvedPct * 0.75 + (aiConversations / totalConversations) * 100 * 0.25)
          )
        )
      : tenant.baseAiResolvedPct;

  return {
    chatsToday: tenant.baseChatsToday,
    chatsGrowthPct: tenant.chatsGrowthPct,
    aiResolvedPct,
    avgResponseSeconds: tenant.avgResponseSeconds,
    pixSalesTotal: paidPixTotal,
    unreadTotal,
  };
}

export function calculateColumnTotals(deals: Deal[]): Record<CrmStage, { count: number; total: number }> {
  const totals: Record<CrmStage, { count: number; total: number }> = {
    novo_lead: { count: 0, total: 0 },
    qualificado_ia: { count: 0, total: 0 },
    proposta_enviada: { count: 0, total: 0 },
    aguardando_pagamento: { count: 0, total: 0 },
    ganho: { count: 0, total: 0 },
  };

  for (const deal of deals) {
    totals[deal.stage].count += 1;
    totals[deal.stage].total += deal.value;
  }

  return totals;
}

export function moveDealToStage(deals: Deal[], dealId: string, nextStage: CrmStage): Deal[] {
  return deals.map((deal) =>
    deal.id === dealId
      ? {
          ...deal,
          stage: nextStage,
          lastInteraction: 'Agora mesmo',
        }
      : deal
  );
}

export function getAdjacentStage(stage: CrmStage, direction: 'prev' | 'next'): CrmStage | null {
  const index = CRM_STAGES.findIndex((s) => s.id === stage);
  if (index === -1) return null;
  const target = direction === 'next' ? index + 1 : index - 1;
  if (target < 0 || target >= CRM_STAGES.length) return null;
  return CRM_STAGES[target].id;
}

export function filterConversations(
  conversations: Conversation[],
  contacts: Contact[],
  tab: 'todos' | 'ia' | 'humano' | 'aguardando',
  query: string
): Conversation[] {
  const normalized = query.trim().toLowerCase();
  return conversations.filter((conv) => {
    if (tab === 'ia' && conv.status !== 'ia') return false;
    if (tab === 'humano' && conv.status !== 'humano') return false;
    if (tab === 'aguardando' && conv.status !== 'aguardando') return false;

    if (!normalized) return true;
    const contact = contacts.find((c) => c.id === conv.contactId);
    const lastMsg = conv.messages[conv.messages.length - 1]?.content ?? '';
    return (
      (contact?.name.toLowerCase().includes(normalized) ?? false) ||
      (contact?.phone.toLowerCase().includes(normalized) ?? false) ||
      lastMsg.toLowerCase().includes(normalized)
    );
  });
}

export function filterContacts(
  contacts: Contact[],
  query: string,
  tagFilter: string
): Contact[] {
  const normalized = query.trim().toLowerCase();
  return contacts.filter((contact) => {
    if (tagFilter !== 'todas' && !contact.tags.includes(tagFilter)) {
      return false;
    }
    if (!normalized) return true;
    return (
      contact.name.toLowerCase().includes(normalized) ||
      contact.phone.toLowerCase().includes(normalized) ||
      contact.email.toLowerCase().includes(normalized)
    );
  });
}

export function anonymizeContactRecord(contact: Contact): Contact {
  const shortCode = contact.id.slice(-4).toUpperCase();
  return {
    ...contact,
    name: `Titular Anonimizado #${shortCode}`,
    phone: '+55 (00) 00000-0000',
    email: `anonimizado.${shortCode.toLowerCase()}@lgpd.foclient.local`,
    lgpdStatus: 'anonimizado',
    tags: ['LGPD Anonimizado'],
    avatarInitials: 'LG',
  };
}

export function buildPixCopyPasteCode(tenantName: string, amount: number, id: string): string {
  const cleanName = tenantName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 14);
  const cents = Math.round(amount * 100)
    .toString()
    .padStart(6, '0');
  return `00020126580014BR.GOV.BCB.PIX0136foclient-${id.slice(-6)}-${cleanName}520400005303986540${cents}5802BR5914${cleanName}6009SAO PAULO6304A9F2`;
}

export function exportContactsToCSV(contacts: Contact[]): string {
  const headers = ['Nome', 'WhatsApp', 'E-mail', 'Etapa CRM', 'Status LGPD', 'Tags'];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = contacts.map((c) => [
    escape(c.name),
    escape(c.phone),
    escape(c.email),
    escape(getStageLabel(c.stage)),
    escape(
      c.lgpdStatus === 'ativo'
        ? 'Consentimento Ativo'
        : c.lgpdStatus === 'opt_out'
          ? 'Opt-out'
          : 'Anonimizado'
    ),
    escape(c.tags.join('; ')),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function calculateGlobalSuperAdminMetrics(tenants: TenantData[]) {
  const activeTenants = tenants.filter((t) => t.status === 'Ativo' || t.status === 'Trial');
  const mrrTotal = tenants
    .filter((t) => t.status === 'Ativo')
    .reduce((acc, t) => acc + t.mrr, 0);
  const totalAiInteractions = tenants.reduce(
    (acc, t) => acc + t.billing.aiInteractionsUsed,
    0
  );
  const inadimplentes = tenants.filter((t) => t.status === 'Inadimplente').length;
  const churnRate = tenants.length > 0 ? Number(((inadimplentes / tenants.length) * 12).toFixed(1)) : 0;

  return {
    mrrTotal,
    activeCount: activeTenants.length,
    totalCount: tenants.length,
    churnRate,
    totalAiInteractions,
  };
}

export interface SimulatedReply {
  text: string;
  triggeredHandoff: boolean;
  includedPixOffer: boolean;
  matchedSource?: string;
}

export function generateSimulatedAgentReply(
  userMessage: string,
  config: AIAgentConfig,
  tenantName: string
): SimulatedReply {
  const lower = userMessage.toLowerCase();

  const frustrationKeywords = [
    'reclama',
    'absurdo',
    'horrível',
    'cancelar',
    'demora',
    'procon',
    'raiva',
    'péssimo',
    'falar com humano',
    'atendente',
  ];
  const isFrustrated = frustrationKeywords.some((kw) => lower.includes(kw));

  const pixKeywords = ['pix', 'pagar', 'pagamento', 'boleto', 'valor', 'preço', 'preco', 'quanto custa', 'fechar'];
  const wantsPix = pixKeywords.some((kw) => lower.includes(kw));

  const audioKeywords = ['áudio', 'audio', 'voz', 'gravar'];
  const mentionsAudio = audioKeywords.some((kw) => lower.includes(kw));

  // Search RAG knowledge base for contextual match
  const matchedDoc =
    config.knowledgeBase.find((doc) => {
      const tokens = `${doc.title} ${doc.snippet}`
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      return tokens.some((token) => lower.includes(token));
    }) ?? (wantsPix && config.knowledgeBase.length > 0 ? config.knowledgeBase[0] : undefined);

  const greetingByTone: Record<AIAgentConfig['tone'], string> = {
    Consultivo: `Olá! Aqui é ${config.name}, especialista digital da ${tenantName}.`,
    Amigável: `Oi! Tudo bem? Sou ${config.name}, da equipe ${tenantName}.`,
    Direto: `${config.name} (${tenantName}):`,
  };

  if (isFrustrated && config.skills.handoffOnFrustration) {
    return {
      text: `${greetingByTone[config.tone]} Sinto muito pelo transtorno. Identifiquei que seu caso merece atenção imediata e já estou transferindo esta conversa com todo o histórico para um especialista humano da ${tenantName}. Aguarde só um instante.`,
      triggeredHandoff: true,
      includedPixOffer: false,
    };
  }

  if (mentionsAudio && config.skills.transcribeAudio) {
    return {
      text: `${greetingByTone[config.tone]} Pode mandar seu áudio tranquilamente! Minha transcrição automática está ativa e consigo entender e responder sua dúvida na hora.`,
      triggeredHandoff: false,
      includedPixOffer: false,
    };
  }

  if (wantsPix) {
    if (config.skills.generatePixLink) {
      const closing =
        config.tone === 'Direto'
          ? 'Posso gerar o QR Code Pix agora mesmo aqui no WhatsApp com confirmação automática.'
          : config.tone === 'Amigável'
            ? 'Se quiser garantir já, eu gero o link Pix aqui mesmo no chat e a confirmação cai em segundos!'
            : 'Para facilitar sua contratação com segurança, posso emitir o código Pix oficial diretamente neste atendimento com baixa automática.';
      return {
        text: `${greetingByTone[config.tone]} ${matchedDoc ? `Consultei "${matchedDoc.title}": ${matchedDoc.snippet} ` : ''}${closing}`,
        triggeredHandoff: false,
        includedPixOffer: true,
        matchedSource: matchedDoc?.title,
      };
    }

    return {
      text: `${greetingByTone[config.tone]} No momento a emissão automática de Pix pelo agente está desativada. Vou registrar seu interesse e um consultor enviará a cobrança oficial em seguida.`,
      triggeredHandoff: false,
      includedPixOffer: false,
    };
  }

  if (matchedDoc) {
    const suffix =
      config.tone === 'Direto'
        ? 'Deseja avançar com o agendamento ou proposta?'
        : config.tone === 'Amigável'
          ? 'Ficou alguma dúvida ou já quer que eu reserve o melhor horário pra você?'
          : 'Com base nisso, como prefere estruturar o próximo passo para o seu perfil?';
    return {
      text: `${greetingByTone[config.tone]} Encontrei estas informações em nossa base (${matchedDoc.title}): ${matchedDoc.snippet} ${suffix}`,
      triggeredHandoff: false,
      includedPixOffer: false,
      matchedSource: matchedDoc.title,
    };
  }

  const promptHint = config.systemPrompt.trim().slice(0, 95);
  const bodyByTone: Record<AIAgentConfig['tone'], string> = {
    Consultivo: `Entendi perfeitamente sua solicitação sobre "${userMessage}". Para oferecer a melhor recomendação seguindo nosso protocolo (${promptHint}...), poderia me informar qual é a sua prioridade ou prazo ideal?`,
    Amigável: `Adorei seu contato sobre "${userMessage}"! Já vou te ajudar com tudo. Me conta rapidinho qual horário ou opção fica melhor para você?`,
    Direto: `Recebi sua mensagem sobre "${userMessage}". Informe seu objetivo principal para eu enviar disponibilidade e valores imediatamente.`,
  };

  return {
    text: `${greetingByTone[config.tone]} ${bodyByTone[config.tone]}`,
    triggeredHandoff: false,
    includedPixOffer: false,
  };
}
