import fs from 'fs';
import path from 'path';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { env } from '../../config/env';
import { encryptSecret } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';
import { emitToTenant } from '../../lib/socket';
import { generateAgentReply } from '../../services/ai.service';
import {
  formatPhoneDisplay,
  normalizePhoneDigits,
  serializeContact,
  serializeConversation,
  serializeMessage,
} from '../../services/serializer.service';
import {
  ConnectionState,
  IWhatsAppProvider,
  SendMessageResult,
  WhatsAppStatusInfo,
} from './IWhatsAppProvider';

interface TenantSessionRuntime {
  sock: WASocket | null;
  status: ConnectionState;
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  sentExternalIds: Set<string>;
  jidByNormalizedPhone: Map<string, string>;
}

const silentLogger = pino({ level: 'silent' });

export class BaileysProvider implements IWhatsAppProvider {
  public readonly providerType = 'BAILEYS' as const;
  private sessions = new Map<string, TenantSessionRuntime>();

  private getSessionDir(tenantId: string): string {
    return path.resolve(process.cwd(), env.WHATSAPP_SESSIONS_DIR, tenantId);
  }

  private getOrCreateRuntime(tenantId: string): TenantSessionRuntime {
    let rt = this.sessions.get(tenantId);
    if (!rt) {
      rt = {
        sock: null,
        status: 'DISCONNECTED',
        qrCodeDataUrl: null,
        phoneNumber: null,
        sentExternalIds: new Set<string>(),
        jidByNormalizedPhone: new Map<string, string>(),
      };
      this.sessions.set(tenantId, rt);
    }
    return rt;
  }

  private async syncInstanceDb(
    tenantId: string,
    status: ConnectionState,
    phoneNumber?: string | null
  ): Promise<void> {
    try {
      const encryptedSession = encryptSecret(
        JSON.stringify({
          engine: 'baileys-multidevice',
          tenantId,
          status,
          phoneNumber: phoneNumber ?? null,
          updatedAt: new Date().toISOString(),
        })
      );

      await prisma.whatsAppInstance.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: 'Canal Principal',
          },
        },
        update: {
          provider: 'BAILEYS',
          status,
          phoneNumber: phoneNumber ?? undefined,
          encryptedSession,
          lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined,
        },
        create: {
          tenantId,
          name: 'Canal Principal',
          provider: 'BAILEYS',
          status,
          phoneNumber: phoneNumber ?? null,
          encryptedSession,
          lastConnectedAt: status === 'CONNECTED' ? new Date() : null,
        },
      });

      if (status === 'CONNECTED' && phoneNumber) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { whatsappNumber: phoneNumber },
        });
      }
    } catch (err) {
      console.error(`[BaileysProvider] Failed to sync DB for tenant ${tenantId}:`, err);
    }
  }

  public async connect(tenantId: string): Promise<WhatsAppStatusInfo> {
    const rt = this.getOrCreateRuntime(tenantId);

    if (rt.sock && (rt.status === 'CONNECTED' || rt.status === 'QR_READY')) {
      return this.getStatus(tenantId);
    }

    // Close stale socket if any
    if (rt.sock) {
      try {
        rt.sock.end(undefined);
      } catch {
        // ignore
      }
      rt.sock = null;
    }

    rt.status = 'CONNECTING';
    rt.qrCodeDataUrl = null;
    await this.syncInstanceDb(tenantId, 'CONNECTING');
    emitToTenant(tenantId, 'whatsapp:status', {
      tenantId,
      status: 'CONNECTING',
      provider: 'BAILEYS',
      engineName: 'Baileys Multi-Device WebSocket',
    });

    const sessionDir = this.getSessionDir(tenantId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    let version: [number, number, number] = [2, 3000, 1017531287];
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
    } catch {
      // Use fallback WA version if offline/rate-limited
    }

    const sock = makeWASocket({
      version,
      auth: state,
      logger: silentLogger as any,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('FOCLIENT SaaS'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    rt.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          rt.status = 'QR_READY';
          rt.qrCodeDataUrl = dataUrl;
          await this.syncInstanceDb(tenantId, 'QR_READY');

          emitToTenant(tenantId, 'whatsapp:qr', {
            tenantId,
            qrCode: dataUrl,
            status: 'QR_READY',
            provider: 'BAILEYS',
          });
          emitToTenant(tenantId, 'whatsapp:status', {
            tenantId,
            status: 'QR_READY',
            qrCode: dataUrl,
            provider: 'BAILEYS',
            engineName: 'Baileys Multi-Device WebSocket',
          });
        } catch (err) {
          console.error('[BaileysProvider] Failed to generate QR DataURL:', err);
        }
      }

      if (connection === 'open') {
        const rawUserId = sock.user?.id ?? '';
        const rawPhone = rawUserId.split(':')[0]?.split('@')[0] ?? '';
        const formattedPhone = rawPhone ? formatPhoneDisplay(rawPhone) : null;

        rt.status = 'CONNECTED';
        rt.qrCodeDataUrl = null;
        rt.phoneNumber = formattedPhone;

        await this.syncInstanceDb(tenantId, 'CONNECTED', formattedPhone);
        emitToTenant(tenantId, 'whatsapp:status', {
          tenantId,
          status: 'CONNECTED',
          phoneNumber: formattedPhone,
          qrCode: null,
          provider: 'BAILEYS',
          engineName: 'Baileys Multi-Device WebSocket',
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        rt.sock = null;
        rt.qrCodeDataUrl = null;

        if (loggedOut) {
          rt.status = 'DISCONNECTED';
          rt.phoneNumber = null;
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch {
            // ignore
          }
          await this.syncInstanceDb(tenantId, 'DISCONNECTED', null);
          emitToTenant(tenantId, 'whatsapp:status', {
            tenantId,
            status: 'DISCONNECTED',
            phoneNumber: null,
            qrCode: null,
            provider: 'BAILEYS',
            engineName: 'Baileys Multi-Device WebSocket',
          });
        } else if (rt.status !== 'DISCONNECTED') {
          // Automatic reconnect on transient disconnect (e.g. right after QR scan pair!)
          setTimeout(() => {
            this.connect(tenantId).catch((err) =>
              console.error('[BaileysProvider] Reconnect error:', err)
            );
          }, 1500);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          if (!msg.message) continue;
          const remoteJid = msg.key.remoteJid ?? '';
          if (
            !remoteJid ||
            remoteJid === 'status@broadcast' ||
            remoteJid.endsWith('@g.us') ||
            remoteJid.endsWith('@newsletter')
          ) {
            continue;
          }

          const externalId = msg.key.id ?? '';
          if (msg.key.fromMe) {
            if (externalId && rt.sentExternalIds.has(externalId)) {
              continue;
            }
            continue;
          }

          const textContent =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            msg.message.documentMessage?.caption ||
            (msg.message.audioMessage ? '[Áudio de voz enviado pelo cliente]' : '');

          if (!textContent.trim()) continue;

          // Resolve phone number from JID (supports @s.whatsapp.net and @lid alt JID)
          const altJid = (msg.key as any).remoteJidAlt as string | undefined;
          const phoneSource =
            remoteJid.endsWith('@s.whatsapp.net')
              ? remoteJid.split('@')[0]
              : altJid?.endsWith('@s.whatsapp.net')
                ? altJid.split('@')[0]
                : remoteJid.split('@')[0];

          const normalizedPhone = normalizePhoneDigits(phoneSource);
          if (!normalizedPhone) continue;

          // Cache exact remoteJid so replies always reach this exact WhatsApp user (even on @lid)
          rt.jidByNormalizedPhone.set(normalizedPhone, remoteJid);

          await this.handleIncomingWhatsAppMessage({
            tenantId,
            remoteJid,
            normalizedPhone,
            pushName: msg.pushName?.trim() || formatPhoneDisplay(normalizedPhone),
            content: textContent.trim(),
            externalId,
          });
        } catch (err) {
          console.error('[BaileysProvider] Error handling incoming WhatsApp message:', err);
        }
      }
    });

    // Wait briefly (up to 2.5s) so if QR generates immediately we return it synchronously too!
    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 200;
        if (rt.status === 'QR_READY' || rt.status === 'CONNECTED' || elapsed >= 2400) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });

    return this.getStatus(tenantId);
  }

  private async handleIncomingWhatsAppMessage(params: {
    tenantId: string;
    remoteJid: string;
    normalizedPhone: string;
    pushName: string;
    content: string;
    externalId: string;
  }): Promise<void> {
    const { tenantId, remoteJid, normalizedPhone, pushName, content, externalId } = params;

    // 1. Find or create Contact in Neon
    const last8Digits = normalizedPhone.slice(-8);
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          { phoneNormalized: normalizedPhone },
          ...(last8Digits.length === 8 ? [{ phoneNormalized: { endsWith: last8Digits } }] : []),
        ],
      },
    });

    let isNewContact = false;
    if (!contact) {
      isNewContact = true;
      contact = await prisma.contact.create({
        data: {
          tenantId,
          name: pushName,
          phone: formatPhoneDisplay(normalizedPhone),
          phoneNormalized: normalizedPhone,
          email: '',
          stage: 'novo_lead',
          tags: ['WhatsApp Real'],
          origin: 'WhatsApp Direto',
          lgpdConsent: true,
          lgpdConsentAt: new Date(),
          lgpdStatus: 'ativo',
        },
      });

      // Also create an initial CRM Kanban Deal for new real leads
      await prisma.deal.create({
        data: {
          tenantId,
          contactId: contact.id,
          title: `Atendimento WhatsApp — ${pushName}`,
          value: 0,
          stage: 'novo_lead',
          tags: ['WhatsApp Real'],
          origin: 'WhatsApp Direto',
          lastInteractionAt: new Date(),
        },
      });
    }

    // Cache remoteJid for contact's stored phone digits as well
    rtCacheJid(this.getOrCreateRuntime(tenantId), contact.phoneNormalized, remoteJid);

    // 2. Find or create Conversation
    let conversation = await prisma.conversation.findFirst({
      where: { tenantId, contactId: contact.id },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          status: 'BOT',
          unreadCount: 1,
          channel: 'WhatsApp Oficial',
          aiSummary: `Lead real conectado via WhatsApp (${contact.phone}).`,
          lastMessageAt: new Date(),
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });
    }

    // 3. Save Contact Message in Neon
    const savedMsg = await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        senderType: 'CONTACT',
        senderName: contact.name,
        content,
        externalId: externalId || undefined,
      },
    });

    const fullConv = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        messages: {
          include: { pixCharge: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // 4. Emit Real-Time WebSocket Events to Inbox
    emitToTenant(tenantId, 'message:new', {
      tenantId,
      conversationId: conversation.id,
      contact: serializeContact(contact),
      isNewContact,
      conversation: fullConv ? serializeConversation(fullConv) : null,
      message: serializeMessage(savedMsg),
    });

    // 5. If Conversation is in BOT mode (IA Active), auto-reply on real WhatsApp!
    if (conversation.status === 'BOT') {
      const history = (fullConv?.messages ?? []).slice(-8).map((m) => ({
        sender: m.senderName,
        content: m.content,
      }));

      const aiResult = await generateAgentReply({
        tenantId,
        userMessage: content,
        conversationHistory: history,
      });

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { aiInteractionsUsed: { increment: 1 } },
        include: { aiAgent: true },
      });

      const agentName = tenant.aiAgent?.name ?? 'Clara IA';

      // Send AI Reply back to real WhatsApp
      let aiExternalId: string | undefined;
      try {
        const sent = await this.sendTextToJid(tenantId, remoteJid, aiResult.text);
        aiExternalId = sent.externalId;
      } catch (err) {
        console.error('[BaileysProvider] Failed to send AI auto-reply on WhatsApp:', err);
      }

      const aiSavedMsg = await prisma.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          senderType: 'AI',
          senderName: agentName,
          content: aiResult.text,
          externalId: aiExternalId,
        },
      });

      if (aiResult.triggeredHandoff) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: 'PENDING',
            lastMessageAt: new Date(),
          },
        });

        await prisma.message.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            senderType: 'INTERNAL_NOTE',
            senderName: 'Controle de Transbordo IA',
            content: `Transbordo automático acionado: ${contact.name} solicitou humano ou demonstrou urgência.`,
          },
        });

        emitToTenant(tenantId, 'conversation:handoff', {
          tenantId,
          conversationId: conversation.id,
          contactName: contact.name,
          reason: content,
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });
      }

      const updatedConv = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          messages: {
            include: { pixCharge: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      emitToTenant(tenantId, 'message:new', {
        tenantId,
        conversationId: conversation.id,
        contact: serializeContact(contact),
        conversation: updatedConv ? serializeConversation(updatedConv) : null,
        message: serializeMessage(aiSavedMsg),
      });
    }
  }

  public async disconnect(tenantId: string): Promise<void> {
    const rt = this.sessions.get(tenantId);
    const sessionDir = this.getSessionDir(tenantId);

    if (rt?.sock) {
      try {
        await rt.sock.logout();
      } catch {
        try {
          rt.sock.end(undefined);
        } catch {
          // ignore
        }
      }
      rt.sock = null;
    }

    if (rt) {
      rt.status = 'DISCONNECTED';
      rt.qrCodeDataUrl = null;
      rt.phoneNumber = null;
    }

    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    await this.syncInstanceDb(tenantId, 'DISCONNECTED', null);
    emitToTenant(tenantId, 'whatsapp:status', {
      tenantId,
      status: 'DISCONNECTED',
      phoneNumber: null,
      qrCode: null,
      provider: 'BAILEYS',
      engineName: 'Baileys Multi-Device WebSocket',
    });
  }

  private async resolveTargetJid(
    rt: TenantSessionRuntime,
    toPhone: string
  ): Promise<string> {
    if (toPhone.includes('@')) return toPhone;
    const digits = normalizePhoneDigits(toPhone);
    if (!digits) {
      throw new Error('Número de telefone inválido para envio no WhatsApp.');
    }

    const cachedJid = rt.jidByNormalizedPhone.get(digits);
    if (cachedJid) return cachedJid;

    if (rt.sock) {
      try {
        const results = await rt.sock.onWhatsApp(digits);
        if (results && results.length > 0 && results[0].exists) {
          rt.jidByNormalizedPhone.set(digits, results[0].jid);
          return results[0].jid;
        }
        // Brazilian 9th digit fallback (DDD >= 30 often omits 9th digit on WhatsApp JID)
        if (digits.startsWith('55') && digits.length === 13 && digits[4] === '9') {
          const without9 = digits.slice(0, 4) + digits.slice(5);
          const altResults = await rt.sock.onWhatsApp(without9);
          if (altResults && altResults.length > 0 && altResults[0].exists) {
            rt.jidByNormalizedPhone.set(digits, altResults[0].jid);
            return altResults[0].jid;
          }
        }
      } catch {
        // Fallback to standard JID construction
      }
    }

    return `${digits}@s.whatsapp.net`;
  }

  private async sendTextToJid(
    tenantId: string,
    jid: string,
    text: string
  ): Promise<SendMessageResult> {
    const rt = this.getOrCreateRuntime(tenantId);
    if (!rt.sock || rt.status !== 'CONNECTED') {
      return {
        externalId: `sim-${Date.now()}`,
        deliveredVia: 'panel-only (WhatsApp desconectado)',
      };
    }

    const sent = await rt.sock.sendMessage(jid, { text });
    const extId = sent?.key?.id ?? `wa-${Date.now()}`;
    rt.sentExternalIds.add(extId);
    if (rt.sentExternalIds.size > 500) {
      const first = rt.sentExternalIds.values().next().value;
      if (first) rt.sentExternalIds.delete(first);
    }

    return {
      externalId: extId,
      deliveredVia: 'baileys-whatsapp-real',
    };
  }

  public async sendText(
    tenantId: string,
    toPhone: string,
    text: string
  ): Promise<SendMessageResult> {
    const rt = this.getOrCreateRuntime(tenantId);
    if (!rt.sock || rt.status !== 'CONNECTED') {
      return {
        externalId: `sim-${Date.now()}`,
        deliveredVia: 'panel-only (WhatsApp desconectado)',
      };
    }

    const jid = await this.resolveTargetJid(rt, toPhone);
    return this.sendTextToJid(tenantId, jid, text);
  }

  public async sendMedia(
    tenantId: string,
    toPhone: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'document' | 'audio' = 'image'
  ): Promise<SendMessageResult> {
    const rt = this.getOrCreateRuntime(tenantId);
    if (!rt.sock || rt.status !== 'CONNECTED') {
      return {
        externalId: `sim-media-${Date.now()}`,
        deliveredVia: 'panel-only (WhatsApp desconectado)',
      };
    }

    const jid = await this.resolveTargetJid(rt, toPhone);
    let sent;
    if (mediaType === 'audio') {
      sent = await rt.sock.sendMessage(jid, {
        audio: { url: mediaUrl },
        mimetype: 'audio/mp4',
      });
    } else if (mediaType === 'document') {
      sent = await rt.sock.sendMessage(jid, {
        document: { url: mediaUrl },
        mimetype: 'application/pdf',
        fileName: caption || 'documento.pdf',
        caption,
      });
    } else {
      sent = await rt.sock.sendMessage(jid, {
        image: { url: mediaUrl },
        caption,
      });
    }

    const extId = sent?.key?.id ?? `wa-media-${Date.now()}`;
    rt.sentExternalIds.add(extId);

    return {
      externalId: extId,
      deliveredVia: 'baileys-whatsapp-real',
    };
  }

  public async getStatus(tenantId: string): Promise<WhatsAppStatusInfo> {
    const rt = this.sessions.get(tenantId);
    const dbInstance = await prisma.whatsAppInstance.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    if (rt && rt.status !== 'DISCONNECTED') {
      return {
        provider: 'BAILEYS',
        engineName: 'Baileys Multi-Device WebSocket',
        status: rt.status,
        qrCode: rt.qrCodeDataUrl,
        phoneNumber: rt.phoneNumber ?? dbInstance?.phoneNumber ?? null,
        lastConnectedAt: dbInstance?.lastConnectedAt?.toISOString() ?? null,
      };
    }

    // Auto-restore persisted session if credentials exist on disk and server restarted
    const credsFile = path.join(this.getSessionDir(tenantId), 'creds.json');
    if (fs.existsSync(credsFile) && (!rt || !rt.sock)) {
      this.connect(tenantId).catch((err) =>
        console.error('[BaileysProvider] Background session restore error:', err)
      );
      return {
        provider: 'BAILEYS',
        engineName: 'Baileys Multi-Device WebSocket',
        status: 'CONNECTING',
        qrCode: null,
        phoneNumber: dbInstance?.phoneNumber ?? null,
        lastConnectedAt: dbInstance?.lastConnectedAt?.toISOString() ?? null,
      };
    }

    return {
      provider: 'BAILEYS',
      engineName: 'Baileys Multi-Device WebSocket',
      status: 'DISCONNECTED',
      qrCode: null,
      phoneNumber: dbInstance?.phoneNumber ?? null,
      lastConnectedAt: dbInstance?.lastConnectedAt?.toISOString() ?? null,
    };
  }
}

function rtCacheJid(rt: TenantSessionRuntime, normalizedPhone: string, jid: string) {
  if (normalizedPhone) {
    rt.jidByNormalizedPhone.set(normalizedPhone, jid);
  }
}
