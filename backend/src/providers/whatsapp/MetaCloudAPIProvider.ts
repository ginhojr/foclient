import { env } from '../../config/env';
import { decryptSecret } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';
import { normalizePhoneDigits } from '../../services/serializer.service';
import {
  IWhatsAppProvider,
  SendMessageResult,
  WhatsAppStatusInfo,
} from './IWhatsAppProvider';

interface MetaStoredCredentials {
  phoneNumberId: string;
  accessToken: string;
  displayPhoneNumber?: string;
}

/**
 * Official Meta WhatsApp Cloud API Provider (Adapter Pattern).
 * Ready for production cutover by storing AES-256 encrypted `phoneNumberId` + `accessToken`
 * in `whatsapp_instances` and switching the tenant's provider to `META_CLOUD_API`.
 */
export class MetaCloudAPIProvider implements IWhatsAppProvider {
  public readonly providerType = 'META_CLOUD_API' as const;

  private async getCredentials(tenantId: string): Promise<MetaStoredCredentials | null> {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId, provider: 'META_CLOUD_API' },
    });
    if (!instance?.encryptedSession) return null;

    try {
      const json = decryptSecret(instance.encryptedSession);
      const parsed = JSON.parse(json) as MetaStoredCredentials;
      if (parsed.phoneNumberId && parsed.accessToken) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async connect(tenantId: string): Promise<WhatsAppStatusInfo> {
    const creds = await this.getCredentials(tenantId);
    if (!creds) {
      return {
        provider: 'META_CLOUD_API',
        engineName: 'Meta WhatsApp Cloud API Oficial',
        status: 'DISCONNECTED',
        qrCode: null,
        phoneNumber: null,
      };
    }

    await prisma.whatsAppInstance.updateMany({
      where: { tenantId, provider: 'META_CLOUD_API' },
      data: { status: 'CONNECTED', lastConnectedAt: new Date() },
    });

    return {
      provider: 'META_CLOUD_API',
      engineName: 'Meta WhatsApp Cloud API Oficial',
      status: 'CONNECTED',
      qrCode: null,
      phoneNumber: creds.displayPhoneNumber ?? null,
    };
  }

  public async disconnect(tenantId: string): Promise<void> {
    await prisma.whatsAppInstance.updateMany({
      where: { tenantId, provider: 'META_CLOUD_API' },
      data: { status: 'DISCONNECTED' },
    });
  }

  public async sendText(
    tenantId: string,
    toPhone: string,
    text: string
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(tenantId);
    if (!creds) {
      return {
        externalId: `meta-stub-${Date.now()}`,
        deliveredVia: 'meta-cloud-api-stub (configure phoneNumberId e accessToken)',
      };
    }

    const to = normalizePhoneDigits(toPhone);
    const url = `https://graph.facebook.com/${env.META_API_VERSION}/${creds.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Meta Cloud API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as { messages?: { id: string }[] };
    return {
      externalId: data.messages?.[0]?.id ?? `wamid.${Date.now()}`,
      deliveredVia: 'meta-cloud-api-official',
    };
  }

  public async sendMedia(
    tenantId: string,
    toPhone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'document' | 'audio' = 'image'
  ): Promise<SendMessageResult> {
    const creds = await this.getCredentials(tenantId);
    if (!creds) {
      return {
        externalId: `meta-media-stub-${Date.now()}`,
        deliveredVia: 'meta-cloud-api-stub',
      };
    }

    const to = normalizePhoneDigits(toPhone);
    const url = `https://graph.facebook.com/${env.META_API_VERSION}/${creds.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          ...(mediaType !== 'audio' && caption ? { caption } : {}),
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Meta Cloud API media error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as { messages?: { id: string }[] };
    return {
      externalId: data.messages?.[0]?.id ?? `wamid.media.${Date.now()}`,
      deliveredVia: 'meta-cloud-api-official',
    };
  }

  public async getStatus(tenantId: string): Promise<WhatsAppStatusInfo> {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId, provider: 'META_CLOUD_API' },
    });

    return {
      provider: 'META_CLOUD_API',
      engineName: 'Meta WhatsApp Cloud API Oficial',
      status: (instance?.status as WhatsAppStatusInfo['status']) ?? 'DISCONNECTED',
      qrCode: null,
      phoneNumber: instance?.phoneNumber ?? null,
      lastConnectedAt: instance?.lastConnectedAt?.toISOString() ?? null,
    };
  }
}
