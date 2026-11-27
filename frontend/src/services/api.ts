const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || 'http://localhost:3333/api';

const ACCESS_TOKEN_KEY = 'foclient_access_token';
const REFRESH_TOKEN_KEY = 'foclient_refresh_token';
const ACTIVE_TENANT_KEY = 'foclient_active_tenant_id';

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken?: string, tenantId?: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (tenantId) localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

export function setStoredTenantId(tenantId: string) {
  localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACTIVE_TENANT_KEY);
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getStoredAccessToken();
  const tenantId = getStoredTenantId();

  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && !endpoint.startsWith('/auth/login')) {
    const renewed = await tryRefreshAccessToken();
    if (renewed) {
      return apiRequest<T>(endpoint, options, false);
    }
    clearAuthTokens();
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    let errMsg = `Erro HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) errMsg = body.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return (await res.text()) as unknown as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth & Tenants
  login: (email: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    companyName: string;
    segment: string;
    name: string;
    email: string;
    password: string;
  }) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => apiRequest('/auth/me'),
  getTenants: () => apiRequest('/tenants'),
  switchTenant: (tenantId: string) =>
    apiRequest('/tenants/switch', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }),

  // Dashboard
  getDashboardMetrics: () => apiRequest('/dashboard/metrics'),

  // Inbox & Conversations
  getConversations: () => apiRequest('/conversations'),
  openConversationForContact: (contactId: string) =>
    apiRequest('/conversations/open', {
      method: 'POST',
      body: JSON.stringify({ contactId }),
    }),
  getMessages: (conversationId: string) =>
    apiRequest(`/conversations/${conversationId}/messages`),
  sendMessage: (
    conversationId: string,
    content: string,
    mode: 'client_reply' | 'internal_note'
  ) =>
    apiRequest(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, mode }),
    }),
  toggleHandoff: (conversationId: string, aiActive?: boolean) =>
    apiRequest(`/conversations/${conversationId}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ aiActive }),
    }),

  // WhatsApp Real Engine (Baileys Multi-Device / Meta Cloud API Strategy)
  getWhatsAppStatus: () => apiRequest('/whatsapp/status'),
  connectWhatsApp: () => apiRequest('/whatsapp/connect', { method: 'POST' }),
  disconnectWhatsApp: () => apiRequest('/whatsapp/disconnect', { method: 'POST' }),
  sendDirectWhatsApp: (to: string, text: string) =>
    apiRequest('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  configureWhatsAppProvider: (payload: {
    provider: 'BAILEYS' | 'META_CLOUD_API';
    phoneNumberId?: string;
    accessToken?: string;
    displayPhoneNumber?: string;
  }) =>
    apiRequest('/whatsapp/provider', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // CRM Kanban
  getDeals: () => apiRequest('/deals'),
  createDeal: (payload: {
    title: string;
    clientName: string;
    phone: string;
    value: number;
    stage: string;
    origin: string;
    tags: string[];
  }) =>
    apiRequest('/deals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  moveDealStage: (dealId: string, stage: string) =>
    apiRequest(`/deals/${dealId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    }),

  // Contacts & LGPD
  getContacts: (params?: { q?: string; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.tag) qs.set('tag', params.tag);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/contacts${suffix}`);
  },
  patchContact: (contactId: string, patch: Record<string, unknown>) =>
    apiRequest(`/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  importContacts: (rows: { name: string; phone: string; email: string; tag: string }[]) =>
    apiRequest('/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  anonymizeContact: (contactId: string) =>
    apiRequest(`/contacts/${contactId}/anonymize`, {
      method: 'POST',
    }),
  exportContactsCsv: () => apiRequest<string>('/contacts/export'),

  // AI Agents Studio
  getAIAgent: () => apiRequest('/ai-agents'),
  updateAIAgent: (payload: Record<string, unknown>) =>
    apiRequest('/ai-agents', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  addKnowledgeSource: (payload: {
    type: 'pdf' | 'url';
    title: string;
    sizeOrUrl: string;
    snippet: string;
  }) =>
    apiRequest('/ai-agents/knowledge', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeKnowledgeSource: (sourceId: string) =>
    apiRequest(`/ai-agents/knowledge/${sourceId}`, {
      method: 'DELETE',
    }),
  simulateAIAgent: (message: string, config?: Record<string, unknown>) =>
    apiRequest('/ai-agents/simulate', {
      method: 'POST',
      body: JSON.stringify({ message, config }),
    }),

  // Billing & Pix
  getSubscription: () => apiRequest('/billing/subscription'),
  updateSubscription: (tier: 'Starter' | 'Growth' | 'Scale') =>
    apiRequest('/billing/subscription', {
      method: 'PATCH',
      body: JSON.stringify({ tier }),
    }),
  generatePix: (conversationId: string, description: string, amount: number) =>
    apiRequest('/pix/generate', {
      method: 'POST',
      body: JSON.stringify({ conversationId, description, amount }),
    }),
  confirmPixWebhook: (payload: {
    pixChargeId?: string;
    messageId?: string;
    conversationId?: string;
  }) =>
    apiRequest('/pix/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
