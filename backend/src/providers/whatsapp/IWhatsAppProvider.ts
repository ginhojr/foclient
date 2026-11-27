export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';

export interface WhatsAppStatusInfo {
  provider: 'BAILEYS' | 'OPENWA' | 'META_CLOUD_API';
  engineName: string;
  status: ConnectionState;
  qrCode: string | null; // Base64 Data URL PNG when status === 'QR_READY'
  phoneNumber: string | null;
  lastConnectedAt?: string | null;
}

export interface SendMessageResult {
  externalId: string;
  deliveredVia: string;
}

/**
 * Strategy / Adapter Interface for Multi-tenant WhatsApp Providers.
 * Allows seamless switching between Baileys Multi-Device (real QR test engine)
 * and Official Meta WhatsApp Cloud API without touching business rules.
 */
export interface IWhatsAppProvider {
  readonly providerType: 'BAILEYS' | 'OPENWA' | 'META_CLOUD_API';
  connect(tenantId: string): Promise<WhatsAppStatusInfo>;
  disconnect(tenantId: string): Promise<void>;
  sendText(tenantId: string, toPhone: string, text: string): Promise<SendMessageResult>;
  sendMedia(
    tenantId: string,
    toPhone: string,
    mediaUrl: string,
    caption?: string,
    mediaType?: 'image' | 'document' | 'audio'
  ): Promise<SendMessageResult>;
  getStatus(tenantId: string): Promise<WhatsAppStatusInfo>;
}
