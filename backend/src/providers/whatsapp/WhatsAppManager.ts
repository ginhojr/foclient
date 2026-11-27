import { WhatsAppProviderType } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { BaileysProvider } from './BaileysProvider';
import { IWhatsAppProvider } from './IWhatsAppProvider';
import { MetaCloudAPIProvider } from './MetaCloudAPIProvider';

class WhatsAppManagerSingleton {
  private baileys = new BaileysProvider();
  private metaCloud = new MetaCloudAPIProvider();

  /**
   * Resolves the active Strategy/Provider for a given tenant.
   * Both `BAILEYS` and legacy `OPENWA` map to `BaileysProvider` (lightweight Multi-Device WebSocket).
   * `META_CLOUD_API` maps to `MetaCloudAPIProvider`.
   */
  public async getProviderForTenant(tenantId: string): Promise<IWhatsAppProvider> {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    const providerType: WhatsAppProviderType =
      instance?.provider ?? env.WHATSAPP_DEFAULT_PROVIDER;

    if (providerType === 'META_CLOUD_API') {
      return this.metaCloud;
    }

    return this.baileys;
  }
}

export const whatsAppManager = new WhatsAppManagerSingleton();
