import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  FileText,
  Globe,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';
import { AgentTone } from '../../types/foclient';
import { generateSimulatedAgentReply } from '../../utils/foclientLogic';

interface SimMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  meta?: {
    triggeredHandoff?: boolean;
    includedPixOffer?: boolean;
    matchedSource?: string;
  };
}

const TONES: AgentTone[] = ['Consultivo', 'Amigável', 'Direto'];

const QUICK_TESTS = [
  'Qual o valor e posso pagar via Pix?',
  'Posso enviar um áudio explicando?',
  'Estou insatisfeito com a demora, quero falar com humano!',
];

export function AIAgentStudioScreen() {
  const { activeTenant, updateAgentConfig, addKnowledgeSource, removeKnowledgeSource } =
    useFoclient();
  const config = activeTenant.agentConfig;

  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [simInput, setSimInput] = useState('');
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const simScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = simScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [simMessages.length]);

  // Reset simulator greeting whenever active tenant changes
  useEffect(() => {
    setSimMessages([
      {
        id: `welcome-${activeTenant.id}`,
        sender: 'agent',
        text: `Olá! Sou ${activeTenant.agentConfig.name} da ${activeTenant.name}. Estou no modo "${activeTenant.agentConfig.tone}" pronta para simular um atendimento real. Envie uma pergunta abaixo!`,
      },
    ]);
  }, [activeTenant.id, activeTenant.name]);

  const handleSimulatedSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const reply = generateSimulatedAgentReply(trimmed, config, activeTenant.name);
    setSimMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: trimmed },
      {
        id: `a-${Date.now() + 1}`,
        sender: 'agent',
        text: reply.text,
        meta: {
          triggeredHandoff: reply.triggeredHandoff,
          includedPixOffer: reply.includedPixOffer,
          matchedSource: reply.matchedSource,
        },
      },
    ]);
    setSimInput('');
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    addKnowledgeSource({
      type: 'url',
      title: urlTitle.trim() || 'Página Comercial Indexada',
      sizeOrUrl: urlInput.trim(),
      snippet: `Informações oficiais atualizadas de ${activeTenant.name} sobre condições, prazos e atendimento prioritário.`,
    });
    setUrlInput('');
    setUrlTitle('');
  };

  const handleSimulatePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const fileName = file?.name ?? 'Catalogo_Servicos_2026.pdf';
    addKnowledgeSource({
      type: 'pdf',
      title: fileName,
      sizeOrUrl: file ? `${(file.size / 1024 / 1024 || 1.2).toFixed(1)} MB` : '1.4 MB',
      snippet: `Documento "${fileName}" indexado na base RAG de ${activeTenant.name} com tabela de valores e políticas comerciais.`,
    });
    e.target.value = '';
  };

  const skillItems: {
    key: keyof typeof config.skills;
    title: string;
    description: string;
  }[] = [
    {
      key: 'transcribeAudio',
      title: 'Transcrever Áudios do WhatsApp',
      description: 'Converte mensagens de voz recebidas em texto automaticamente antes de responder.',
    },
    {
      key: 'generatePixLink',
      title: 'Gerar Link Pix no Chat',
      description: 'Permite que o agente emita cobranças Pix oficiais quando o cliente pedir para fechar.',
    },
    {
      key: 'handoffOnFrustration',
      title: 'Transferir para Humano ao detectar frustração',
      description: 'Aciona transbordo imediato para a equipe ao identificar insatisfação ou urgência.',
    },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-[1440px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Agent Configuration */}
        <section
          aria-label="Configuração do Agente de IA"
          className="xl:col-span-7 space-y-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Configuração do Agente — {activeTenant.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ajustes refletem imediatamente no simulador ao lado
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Salvo automaticamente
            </span>
          </div>

          {/* Agent Name + Tone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="agent-name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Nome do Agente
              </label>
              <input
                id="agent-name-input"
                type="text"
                value={config.name}
                onChange={(e) => updateAgentConfig({ name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tom de Voz
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateAgentConfig({ tone })}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      config.tone === tone
                        ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label
              htmlFor="agent-prompt-textarea"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Prompt do Sistema (Instruções Comerciais)
            </label>
            <textarea
              id="agent-prompt-textarea"
              rows={4}
              value={config.systemPrompt}
              onChange={(e) => updateAgentConfig({ systemPrompt: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          {/* Skill Switches */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Habilidades Ativas
            </h3>
            <div className="space-y-2.5">
              {skillItems.map((skill) => {
                const enabled = config.skills[skill.key];
                return (
                  <div
                    key={skill.key}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {skill.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {skill.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={skill.title}
                      onClick={() =>
                        updateAgentConfig({
                          skills: {
                            ...config.skills,
                            [skill.key]: !enabled,
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RAG Knowledge Base */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Base de Conhecimento (RAG)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Envie PDFs de tabelas/catálogos ou adicione URLs do seu site
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Enviar PDF</span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleSimulatePdfUpload}
                />
              </label>
            </div>

            <form onSubmit={handleAddUrl} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="Título (ex.: FAQ Preços)"
                aria-label="Título da URL para base RAG"
                className="sm:col-span-4 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://suaempresa.com.br/servicos"
                aria-label="URL para indexar na base RAG"
                className="sm:col-span-6 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>URL</span>
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
              {config.knowledgeBase.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Nenhum documento indexado ainda.
                </p>
              ) : (
                config.knowledgeBase.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        {doc.type === 'pdf' ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {doc.sizeOrUrl} · Adicionado em {doc.addedAt}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeKnowledgeSource(doc.id)}
                      aria-label={`Remover ${doc.title} da base de conhecimento`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Panel: Real-time Simulator */}
        <section
          aria-label="Simulador em tempo real do agente"
          className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[680px] overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Testar Agente Agora
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {config.name} · Tom {config.tone} · {config.knowledgeBase.length} fonte(s) RAG
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSimMessages([
                  {
                    id: `reset-${Date.now()}`,
                    sender: 'agent',
                    text: `Sessão reiniciada! Sou ${config.name} (${config.tone}). Como posso ajudar?`,
                  },
                ])
              }
              aria-label="Reiniciar conversa do simulador"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={simScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 dark:bg-slate-950/60"
          >
            {simMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                  }`}
                >
                  {msg.sender === 'agent' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{config.name}</span>
                    </div>
                  )}
                  <p>{msg.text}</p>

                  {msg.meta &&
                    (msg.meta.triggeredHandoff ||
                      msg.meta.includedPixOffer ||
                      msg.meta.matchedSource) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-[11px]">
                        {msg.meta.matchedSource && (
                          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                            <FileText className="w-3 h-3" />
                            RAG: {msg.meta.matchedSource}
                          </span>
                        )}
                        {msg.meta.includedPixOffer && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <QrCode className="w-3 h-3" />
                            Habilidade Pix ativada
                          </span>
                        )}
                        {msg.meta.triggeredHandoff && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <UserCheck className="w-3 h-3" />
                            Transbordo humano acionado
                          </span>
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Prompt Suggestions + Input */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TESTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSimulatedSend(prompt)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSimulatedSend(simInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                aria-label="Digite uma pergunta para testar o agente de IA"
                placeholder="Digite como um cliente para testar..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
              <button
                type="submit"
                aria-label="Enviar mensagem no simulador"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Testar</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
