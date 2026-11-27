# PROMPT MESTRE DE FRONT-END — FOCLIENT (Otimizado para Google AI Studio)

> **Instrução de uso:** Copie todo o conteúdo abaixo da linha divisória e cole diretamente no **Google AI Studio** (modo Build/App ou Chat com Gemini 2.5 Pro / 3.1 Pro) para gerar a aplicação front-end completa e interativa.

---

Atue como um **Engenheiro Front-end Sênior e Product Designer (UI/UX)** especialista em SaaS B2B modernos (estilo Linear, Stripe, Intercom e HubSpot).

Crie uma aplicação web front-end **completa, funcional e interativa** para o **FOCLIENT** — uma plataforma SaaS **Multicliente (Multi-tenant)** de atendimento via WhatsApp, CRM Kanban, Estúdio de Agentes de IA e cobrança Pix no chat.

## 1. Requisitos Técnicos Obrigatórios
- **Stack:** React + TypeScript + Tailwind CSS + ícones `lucide-react` + gráficos com `recharts` (ou SVG limpo e responsivo).
- **Estado e Interatividade:** Toda a interface deve ser **100% interativa em memória** (usando React State/Context e dados mockados realistas em Português do Brasil). O usuário deve conseguir navegar entre todas as telas, trocar de empresa (simulação Multi-tenant), enviar mensagens no chat, alternar IA/Humano, mover cards no Kanban, gerar cobrança Pix simulada e testar o agente de IA.
- **Design System & Estética:**
  - Visual clean, corporativo e moderno, com suporte a **Modo Claro e Modo Escuro** (toggle no topo).
  - Paleta principal: Fundo neutro (`slate-50` / `slate-950`), superfície elevada (`white` / `slate-900`), cor primária **Indigo/Violeta (`indigo-600`)**, cor de destaque para WhatsApp/Sucesso (`emerald-500`) e alertas (`amber-500` / `rose-500`).
  - Tipografia limpa (`Inter`), bordas sutis, sombras suaves, badges de status e micro-interações.
  - Layout totalmente responsivo (sidebar colapsável em telas menores).

---

## 2. Estrutura de Navegação (App Shell)
Crie um layout fixo com:
1. **Sidebar Esquerda:**
   - Logo **FOCLIENT** + **Seletor de Empresa (Tenant Switcher)** no topo (ex.: *Clínica Sorriso Prime*, *Imobiliária Horizonte*, *Advocacia Silva & Costa*) — ao trocar de empresa, os dados do dashboard e chats refletem a empresa selecionada.
   - Menu principal:
     1. **Dashboard** (Visão Geral)
     2. **Inbox Omnichannel** (WhatsApp + IA) com badge de mensagens não lidas
     3. **CRM Kanban** (Funil de Vendas)
     4. **Contatos** (Base & LGPD)
     5. **Agentes de IA** (Estúdio + Simulador)
     6. **Financeiro & Planos** (Assinatura SaaS + Cobranças Pix)
     7. **Super Admin** (Toggle/seção exclusiva para visão global da plataforma)
   - Rodapé da sidebar com avatar do usuário logado, cargo (`Admin da Empresa`) e botão de alternar tema (Claro/Escuro).

2. **Topbar:**
   - Título dinâmico da tela atual, barra de busca global (`Ctrl + K`), status da conexão WhatsApp (bolinha verde pulsante *"WhatsApp Oficial Conectado"*) e sino de notificações.

---

## 3. Detalhamento Obrigatório das Telas

### Tela 1: Dashboard Operacional e Comercial
- **4 Cards de KPI:**
  - *Atendimentos Hoje* (com variação %)
  - *Resolvidos pela IA* (ex.: 68%)
  - *Tempo Médio de Resposta* (ex.: 14s)
  - *Vendas via Pix no Chat* (ex.: R$ 18.450,00)
- **Gráfico de Área/Barras:** Volume de atendimentos (IA vs. Humano) nos últimos 7 dias.
- **Lista de Atividade Recente:** Últimos pagamentos Pix confirmados e transbordos da IA para vendedores.

### Tela 2: Inbox Omnichannel (Split-Screen de 3 Colunas)
- **Coluna 1 (Lista de Conversas):**
  - Filtros em abas: *Todos*, *Com IA*, *Humano*, *Aguardando*.
  - Busca por nome/telefone, avatar, prévia da última mensagem, horário, badge de canal (WhatsApp) e indicador se a IA está ativa naquele chat.
- **Coluna 2 (Área de Chat Ativo):**
  - Cabeçalho com nome do cliente, telefone e **botão de destaque: "Assumir da IA" / "Devolver para IA"**.
  - Histórico de mensagens com balões distintos para *Cliente*, *Atendente Humano*, *Agente de IA* (com ícone de brilho/robô) e *Notas Internas* (fundo amarelo claro).
  - Barra inferior com: campo de texto, seletor de modo (*Responder Cliente* vs. *Nota Interna*), botão de **Respostas Rápidas (`/`)**, botão de **Gerar Cobrança Pix** (que abre um mini-modal e envia um card interativo de Pix no chat) e botão de enviar.
- **Coluna 3 (Contexto do Cliente / Mini-CRM):**
  - Dados do contato, seletor para mudar a etapa do funil diretamente ali, tags clicáveis, status de consentimento **LGPD (Opt-in verificado)** e resumo automático gerado pela IA sobre o lead.

### Tela 3: CRM Kanban (Funil de Vendas)
- Colunas: **Novo Lead**, **Qualificado pela IA**, **Proposta Enviada**, **Aguardando Pagamento**, **Ganho**.
- Cada card exibe: Nome do cliente, valor estimado (R$), tags, origem e indicador de última interação.
- **Interatividade:** Botões rápidos ou drag-and-drop para mover cards entre colunas, além de um botão **"+ Novo Negócio"** (modal funcional) e totalizador de R$ no topo de cada coluna.

### Tela 4: Base de Contatos & LGPD
- Tabela completa com busca e filtro por tag.
- Colunas: Nome, WhatsApp, E-mail, Etapa CRM, Status LGPD (*Consentimento Ativo* / *Opt-out*), Ações (abrir no chat ou anonimizar dados LGPD).
- Botão para importar CSV (modal simulado) e exportar lista.

### Tela 5: Estúdio de Agentes de IA
- Layout dividido em 2 painéis:
  - **Esquerda (Configuração):** Nome do agente, tom de voz (*Consultivo*, *Amigável*, *Direto*), caixa de texto para o *Prompt do Sistema*, switches de habilidades (*Transcrever Áudios*, *Gerar Link Pix*, *Transferir para Humano ao detectar frustração*) e área de upload simulado de PDFs/URLs para a Base de Conhecimento (RAG).
  - **Direita (Simulador em Tempo Real):** Um mini-chat funcional *"Testar Agente Agora"* onde o usuário digita uma pergunta e recebe uma resposta simulada instantânea baseada nas configurações escolhidas.

### Tela 6: Financeiro & Planos
- Exibição do plano atual da empresa (*Plano Growth — R$ 397/mês*) com barras de progresso de consumo: *Usuários (6/10)*, *Números WhatsApp (2/2)* e *Interações de IA (3.420/5.000)*.
- Cards comparativos para upgrade (*Starter*, *Growth*, *Scale*).
- Tabela de histórico de faturas e pagamentos Pix recebidos dos clientes.

### Tela 7: Painel Super Admin (Backoffice do SaaS)
- Métricas globais: **MRR Total**, **Empresas Ativas**, **Churn Mensal** e **Consumo Global de IA**.
- Tabela de todos os tenants (empresas) com status (*Ativo*, *Trial*, *Inadimplente*), plano e botão **"Acessar como Empresa"** (que troca o tenant ativo na plataforma).

---

## 4. Diretrizes Finais de Qualidade
- Não deixe telas vazias ou com texto "em construção". Todas as 7 telas devem estar completas, ricas em detalhes e funcionais.
- Use dados realistas do mercado brasileiro (nomes, telefones com DDD, valores em R$, termos comerciais naturais).
- Garanta que não haja erros de TypeScript ou imports quebrados. Entregue o código limpo, modularizado e pronto para rodar.