import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { decryptSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';

export interface KnowledgeDoc {
  id: string;
  type: 'pdf' | 'url';
  title: string;
  sizeOrUrl: string;
  addedAt: string;
  snippet: string;
}

export interface AIReplyResult {
  text: string;
  triggeredHandoff: boolean;
  includedPixOffer: boolean;
  matchedSource?: string;
  provider: 'gemini' | 'smart-rag-simulator';
}

const FRUSTRATION_KEYWORDS = [
  'reclama',
  'absurdo',
  'horrível',
  'horrivel',
  'cancelar',
  'demora',
  'procon',
  'raiva',
  'péssimo',
  'pessimo',
  'falar com humano',
  'atendente',
  'humano',
];

const PIX_KEYWORDS = [
  'pix',
  'pagar',
  'pagamento',
  'boleto',
  'valor',
  'preço',
  'preco',
  'quanto custa',
  'fechar',
];

const AUDIO_KEYWORDS = ['áudio', 'audio', 'voz', 'gravar'];

export async function generateAgentReply(params: {
  tenantId: string;
  userMessage: string;
  conversationHistory?: { sender: string; content: string }[];
  overrideConfig?: {
    name?: string;
    tone?: string;
    systemPrompt?: string;
    skills?: {
      transcribeAudio?: boolean;
      generatePixLink?: boolean;
      handoffOnFrustration?: boolean;
    };
    knowledgeBase?: KnowledgeDoc[];
  };
}): Promise<AIReplyResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    include: { aiAgent: true },
  });

  const tenantName = tenant?.name ?? 'FOCLIENT';
  const dbAgent = tenant?.aiAgent;

  const name = params.overrideConfig?.name ?? dbAgent?.name ?? 'Clara IA';
  const tone = (params.overrideConfig?.tone ?? dbAgent?.tone ?? 'Consultivo') as
    | 'Consultivo'
    | 'Amigável'
    | 'Direto';
  const systemPrompt =
    params.overrideConfig?.systemPrompt ??
    dbAgent?.systemPrompt ??
    `Você é o assistente comercial inteligente da ${tenantName}.`;
  const transcribeAudio =
    params.overrideConfig?.skills?.transcribeAudio ?? dbAgent?.transcribeAudio ?? true;
  const generatePixLink =
    params.overrideConfig?.skills?.generatePixLink ?? dbAgent?.generatePixLink ?? true;
  const handoffOnFrustration =
    params.overrideConfig?.skills?.handoffOnFrustration ?? dbAgent?.handoffOnFrustration ?? true;

  const knowledgeBase: KnowledgeDoc[] =
    params.overrideConfig?.knowledgeBase ??
    (Array.isArray(dbAgent?.knowledgeDocuments)
      ? (dbAgent!.knowledgeDocuments as unknown as KnowledgeDoc[])
      : []);

  const lower = params.userMessage.toLowerCase();
  const isFrustrated = FRUSTRATION_KEYWORDS.some((kw) => lower.includes(kw));
  const wantsPix = PIX_KEYWORDS.some((kw) => lower.includes(kw));
  const mentionsAudio = AUDIO_KEYWORDS.some((kw) => lower.includes(kw));

  const matchedDoc =
    knowledgeBase.find((doc) => {
      const tokens = `${doc.title} ${doc.snippet}`
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      return tokens.some((token) => lower.includes(token));
    }) ?? (wantsPix && knowledgeBase.length > 0 ? knowledgeBase[0] : undefined);

  const greetingByTone: Record<string, string> = {
    Consultivo: `Olá! Aqui é ${name}, especialista digital da ${tenantName}.`,
    Amigável: `Oi! Tudo bem? Sou ${name}, da equipe ${tenantName}.`,
    Direto: `${name} (${tenantName}):`,
  };

  // Immediate deterministic handoff rule if frustration/human requested
  if (isFrustrated && handoffOnFrustration) {
    return {
      text: `${greetingByTone[tone] ?? greetingByTone.Consultivo} Sinto muito pelo transtorno. Identifiquei que seu caso merece atenção imediata e já estou transferindo esta conversa com todo o histórico para um especialista humano da ${tenantName}. Aguarde só um instante.`,
      triggeredHandoff: true,
      includedPixOffer: false,
      provider: 'smart-rag-simulator',
    };
  }

  // Check if tenant or environment has a real Gemini API key
  let apiKey = env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey && dbAgent?.encryptedApiKey) {
    try {
      apiKey = decryptSecret(dbAgent.encryptedApiKey);
    } catch {
      apiKey = '';
    }
  }

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const ragContext =
        knowledgeBase.length > 0
          ? knowledgeBase.map((d) => `- [${d.title}]: ${d.snippet}`).join('\n')
          : 'Nenhum documento adicional.';
      const historyText = (params.conversationHistory ?? [])
        .slice(-8)
        .map((m) => `${m.sender}: ${m.content}`)
        .join('\n');

      const fullPrompt = [
        `Empresa: ${tenantName}`,
        `Nome do Agente: ${name}`,
        `Tom de Voz obrigatório: ${tone}`,
        `Instruções do Sistema: ${systemPrompt}`,
        `Habilidades Ativas: Transcrição de Áudio=${transcribeAudio}, Oferta de Pix=${generatePixLink}, Transbordo Humano=${handoffOnFrustration}`,
        `Base de Conhecimento (RAG):\n${ragContext}`,
        historyText ? `Histórico recente:\n${historyText}` : '',
        `Mensagem atual do cliente no WhatsApp: "${params.userMessage}"`,
        `Responda em português brasileiro de forma concisa (máximo 3 frases), natural para WhatsApp, respeitando estritamente o tom de voz "${tone}".`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: fullPrompt,
      });

      const replyText = response.text?.trim();
      if (replyText) {
        return {
          text: replyText,
          triggeredHandoff: false,
          includedPixOffer: wantsPix && generatePixLink,
          matchedSource: matchedDoc?.title,
          provider: 'gemini',
        };
      }
    } catch (err) {
      console.warn('[AIService] Gemini call failed, falling back to Smart RAG Simulator:', err);
    }
  }

  // Smart Contextual RAG Simulator (works 100% without external API keys)
  const greeting = greetingByTone[tone] ?? greetingByTone.Consultivo;

  if (mentionsAudio && transcribeAudio) {
    return {
      text: `${greeting} Pode mandar seu áudio tranquilamente! Minha transcrição automática está ativa e consigo entender e responder sua dúvida na hora.`,
      triggeredHandoff: false,
      includedPixOffer: false,
      provider: 'smart-rag-simulator',
    };
  }

  if (wantsPix) {
    if (generatePixLink) {
      const closing =
        tone === 'Direto'
          ? 'Posso gerar o QR Code Pix agora mesmo aqui no WhatsApp com confirmação automática.'
          : tone === 'Amigável'
            ? 'Se quiser garantir já, eu gero o link Pix aqui mesmo no chat e a confirmação cai em segundos!'
            : 'Para facilitar sua contratação com segurança, posso emitir o código Pix oficial diretamente neste atendimento com baixa automática.';
      return {
        text: `${greeting} ${matchedDoc ? `Consultei "${matchedDoc.title}": ${matchedDoc.snippet} ` : ''}${closing}`,
        triggeredHandoff: false,
        includedPixOffer: true,
        matchedSource: matchedDoc?.title,
        provider: 'smart-rag-simulator',
      };
    }

    return {
      text: `${greeting} No momento a emissão automática de Pix pelo agente está desativada. Vou registrar seu interesse e um consultor enviará a cobrança oficial em seguida.`,
      triggeredHandoff: false,
      includedPixOffer: false,
      provider: 'smart-rag-simulator',
    };
  }

  if (matchedDoc) {
    const suffix =
      tone === 'Direto'
        ? 'Deseja avançar com o agendamento ou proposta?'
        : tone === 'Amigável'
          ? 'Ficou alguma dúvida ou já quer que eu reserve o melhor horário pra você?'
          : 'Com base nisso, como prefere estruturar o próximo passo para o seu perfil?';
    return {
      text: `${greeting} Encontrei estas informações em nossa base (${matchedDoc.title}): ${matchedDoc.snippet} ${suffix}`,
      triggeredHandoff: false,
      includedPixOffer: false,
      matchedSource: matchedDoc?.title,
      provider: 'smart-rag-simulator',
    };
  }

  const promptHint = systemPrompt.trim().slice(0, 95);
  const bodyByTone: Record<string, string> = {
    Consultivo: `Entendi perfeitamente sua solicitação sobre "${params.userMessage}". Para oferecer a melhor recomendação seguindo nosso protocolo (${promptHint}...), poderia me informar qual é a sua prioridade ou prazo ideal?`,
    Amigável: `Adorei seu contato sobre "${params.userMessage}"! Já vou te ajudar com tudo. Me conta rapidinho qual horário ou opção fica melhor para você?`,
    Direto: `Recebi sua mensagem sobre "${params.userMessage}". Informe seu objetivo principal para eu enviar disponibilidade e valores imediatamente.`,
  };

  return {
    text: `${greeting} ${bodyByTone[tone] ?? bodyByTone.Consultivo}`,
    triggeredHandoff: false,
    includedPixOffer: false,
    provider: 'smart-rag-simulator',
  };
}
