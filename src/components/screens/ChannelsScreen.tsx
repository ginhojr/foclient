import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Phone,
  Power,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { api } from '../../services/api';

export function ChannelsScreen() {
  const {
    activeTenant,
    whatsappStatus,
    connectWhatsAppSession,
    disconnectWhatsAppSession,
    refreshWhatsAppStatus,
    sendDirectWhatsAppTest,
  } = useFoclient();

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testText, setTestText] = useState(
    `Olá! Mensagem real enviada pelo painel FOCLIENT (${activeTenant.name}).`
  );
  const [sendingTest, setSendingTest] = useState(false);

  // Meta Cloud API Strategy form (optional cutover)
  const [selectedStrategy, setSelectedStrategy] = useState<'BAILEYS' | 'META_CLOUD_API'>(
    whatsappStatus.provider === 'META_CLOUD_API' ? 'META_CLOUD_API' : 'BAILEYS'
  );
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [metaDisplayPhone, setMetaDisplayPhone] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    refreshWhatsAppStatus();
    setTestText(`Olá! Mensagem real enviada pelo painel FOCLIENT (${activeTenant.name}).`);
  }, [activeTenant.id]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectWhatsAppSession();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectWhatsAppSession();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || !testText.trim()) return;
    setSendingTest(true);
    try {
      await sendDirectWhatsAppTest(testPhone.trim(), testText.trim());
      setTestPhone('');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    try {
      await api.configureWhatsAppProvider({
        provider: selectedStrategy,
        phoneNumberId: metaPhoneId.trim() || undefined,
        accessToken: metaToken.trim() || undefined,
        displayPhoneNumber: metaDisplayPhone.trim() || undefined,
      });
      await refreshWhatsAppStatus();
    } finally {
      setSavingMeta(false);
    }
  };

  const isConnected = whatsappStatus.status === 'CONNECTED';
  const isQrReady = whatsappStatus.status === 'QR_READY' && Boolean(whatsappStatus.qrCode);
  const isConnecting = whatsappStatus.status === 'CONNECTING' || connecting;

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Integrações & Conexão WhatsApp Real
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : isQrReady
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  Conectado ({whatsappStatus.phoneNumber || activeTenant.whatsappNumber})
                </>
              ) : isQrReady ? (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  QR Code Pronto para Leitura
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  Desconectado
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Instância isolada para <strong>{activeTenant.name}</strong> · Motor Multi-Device
            WebSocket em tempo real (sem necessidade de navegador headless) + Adapter Oficial Meta Cloud API.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => refreshWhatsAppStatus()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar Status
          </button>

          {!isConnected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  Conectar WhatsApp (QR Code)
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              {disconnecting ? 'Desconectando...' : 'Desconectar Sessão'}
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: QR Code / Live Status + Real Message Tester */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Real-Time QR Code & Connection Card */}
        <section className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pareamento em Tempo Real (Socket.io)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agente vinculado: <strong>{activeTenant.agentConfig.name}</strong>
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {whatsappStatus.engineName || 'Baileys Multi-Device'}
            </span>
          </div>

          {isConnected ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 flex flex-col sm:flex-row items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5 text-center sm:text-left">
                <h4 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                  WhatsApp Real Conectado e Operacional!
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  Número pareado:{' '}
                  <strong className="font-mono">
                    {whatsappStatus.phoneNumber || activeTenant.whatsappNumber}
                  </strong>
                  . Todas as mensagens enviadas para este número aparecerão instantaneamente na{' '}
                  <strong>Inbox Omnichannel</strong> e, se a conversa estiver no modo{' '}
                  <strong>Com IA</strong>, o agente <strong>{activeTenant.agentConfig.name}</strong>{' '}
                  responderá automaticamente no WhatsApp do cliente!
                </p>
              </div>
            </div>
          ) : isQrReady && whatsappStatus.qrCode ? (
            <div className="flex flex-col md:flex-row items-center gap-6 py-2">
              <div className="p-3 rounded-2xl border-2 border-indigo-500/40 bg-white shadow-md shrink-0">
                <img
                  src={whatsappStatus.qrCode}
                  alt="QR Code de conexão do WhatsApp"
                  className="w-60 h-60 object-contain"
                />
              </div>
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Escaneie agora com seu celular
                </div>
                <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                  <li>
                    Abra o <strong>WhatsApp</strong> no seu celular.
                  </li>
                  <li>
                    Toque em <strong>Mais opções (⋮)</strong> ou <strong>Configurações</strong> e
                    selecione <strong>Aparelhos conectados</strong>.
                  </li>
                  <li>
                    Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para este QR
                    Code.
                  </li>
                  <li>
                    Assim que ler, esta tela mudará automaticamente para{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">Conectado</strong>!
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <QrCode className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Nenhuma sessão ativa para {activeTenant.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Clique no botão verde <strong>"Conectar WhatsApp (QR Code)"</strong> no topo
                  desta tela para iniciar a instância e renderizar o QR Code em tempo real.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right: Direct Test Message + Strategy Adapter Configuration */}
        <div className="xl:col-span-5 space-y-6">
          {/* Test Real Send */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-500" />
                Testar Envio de Mensagem Real
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dispara imediatamente via WhatsApp conectado e cria/atualiza a conversa na Inbox.
              </p>
            </div>

            <form onSubmit={handleSendTest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Número de Destino (com DDD)
                </label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Ex.: 5511999998888"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mensagem
                </label>
                <textarea
                  rows={3}
                  required
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingTest ? 'Enviando...' : 'Enviar Mensagem Agora'}
              </button>
            </form>
          </section>

          {/* Adapter Pattern Switcher (Baileys <-> Meta Cloud API) */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Padrão Adapter (Provider WhatsApp)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Migre para a API Oficial da Meta sem alterar regras de negócio.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('BAILEYS')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                    selectedStrategy === 'BAILEYS'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div>QR Code Multi-Device</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Baileys WebSocket (Teste Real)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('META_CLOUD_API')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                    selectedStrategy === 'META_CLOUD_API'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div>Meta Cloud API</div>
                  <div className="text-[10px] font-normal opacity-80 mt-0.5">
                    Oficial Graph API (WABA)
                  </div>
                </button>
              </div>

              {selectedStrategy === 'META_CLOUD_API' && (
                <div className="space-y-2.5 pt-1">
                  <input
                    type="text"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value)}
                    placeholder="Meta Phone Number ID"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="password"
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    placeholder="Permanent Access Token (salvo com AES-256)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    value={metaDisplayPhone}
                    onChange={(e) => setMetaDisplayPhone(e.target.value)}
                    placeholder="Número Oficial Exibido (+55...)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={savingMeta}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                {savingMeta ? 'Salvando no Neon...' : 'Salvar Provider da Instância'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
