# FOCLIENT — Plataforma SaaS Multicliente de Atendimento WhatsApp, CRM & Agentes de IA

O **FOCLIENT** é uma aplicação web front-end interativa para operação comercial e atendimento omnichannel B2B/B2C, reunindo **WhatsApp Oficial**, **Agentes de IA com Base RAG**, **CRM Kanban**, **Conformidade LGPD**, **Cobrança Pix nativa no chat**, **Gestão de Planos** e **Painel Super Admin multicliente**.

Toda a aplicação funciona **100% em memória** (React Context + estado sincronizado entre telas) com dados realistas do mercado brasileiro, permitindo testar jornadas completas de ponta a ponta sem necessidade de backend externo.

---

## Sumário

- [Visão Geral & Arquitetura de Navegação](#visão-geral--arquitetura-de-navegação)
- [Detalhamento das Funcionalidades (7 Telas)](#detalhamento-das-funcionalidades-7-telas)
  1. [Dashboard Operacional e Comercial](#1-dashboard-operacional-e-comercial)
  2. [Inbox Omnichannel (WhatsApp + IA + Pix)](#2-inbox-omnichannel-whatsapp--ia--pix)
  3. [CRM Kanban (Funil de Vendas)](#3-crm-kanban-funil-de-vendas)
  4. [Base de Contatos & LGPD](#4-base-de-contatos--lgpd)
  5. [Estúdio de Agentes de IA & Simulador](#5-estúdio-de-agentes-de-ia--simulador)
  6. [Financeiro & Planos](#6-financeiro--planos)
  7. [Painel Super Admin (Backoffice SaaS)](#7-painel-super-admin-backoffice-saas)
- [Empresas de Demonstração (Multi-tenant)](#empresas-de-demonstração-multi-tenant)
- [Stack Tecnológica & Estrutura do Projeto](#stack-tecnológica--estrutura-do-projeto)
- [Como Executar e Testar](#como-executar-e-testar)

---

## Visão Geral & Arquitetura de Navegação

### App Shell Responsivo
- **Sidebar Esquerda (fixa no desktop e gaveta colapsável no mobile):**
  - Marca **FOCLIENT** e **Seletor de Empresa (Tenant Switcher)** para alternar instantaneamente entre empresas clientes, atualizando dashboards, conversas, funil Kanban, contatos, agente de IA e financeiro.
  - Menu com acesso direto às 7 telas e **badge dinâmico de mensagens não lidas** no Inbox Omnichannel.
  - Rodapé com perfil do usuário logado (`Mariana Costa — Admin da Empresa`) e botão de alternância de tema.
- **Topbar Contextual:**
  - Título e subtítulo dinâmicos conforme a tela e a empresa ativa.
  - **Busca Global (`Ctrl + K` / `Cmd + K`):** modal de pesquisa rápida que encontra contatos, negócios do funil e telas do sistema com navegação direta.
  - **Status WhatsApp Oficial Conectado:** indicador clicável que exibe os dados da conexão WhatsApp Cloud API (número oficial e agente de IA vinculado à empresa).
  - **Alternância Modo Claro / Modo Escuro:** tema dual completo com contraste ajustado em todos os componentes e gráficos.
  - **Central de Notificações:** popover com alertas filtrados pela empresa ativa, clique direto para a tela correspondente e opção *"Marcar lidas"*.

---

## Detalhamento das Funcionalidades (7 Telas)

### 1. Dashboard Operacional e Comercial
Visão consolidada do desempenho de atendimento e conversão comercial da empresa selecionada:
- **4 Cards de KPI com tipografia tabular:**
  - *Atendimentos Hoje* (com variação percentual comparativa).
  - *Resolvidos pela IA* (taxa dinâmica influenciada pelas conversas sob gestão da IA).
  - *Tempo Médio de Resposta* (em segundos, com referência de SLA).
  - *Vendas via Pix no Chat* (valor total em `R$` atualizado automaticamente quando cobranças Pix são confirmadas no Inbox).
- **Gráfico de Volume (7 dias — IA vs. Humano):** construído com `Recharts`, com seletor interativo para alternar entre visualização em **Área** e **Barras**.
- **Atividade Recente:** linha do tempo em tempo real dos últimos pagamentos Pix confirmados e transbordos realizados pela IA para atendentes humanos, com atalho para o extrato financeiro.

### 2. Inbox Omnichannel (WhatsApp + IA + Pix)
Workspace em **split-screen de 3 colunas** (com alternador de painéis em telas menores):
- **Coluna 1 — Lista de Conversas:**
  - Busca instantânea por nome, telefone ou conteúdo da última mensagem.
  - Abas de filtro: *Todos*, *Com IA*, *Humano* e *Aguardando*.
  - Exibição de avatar, prévia, horário, canal (`WhatsApp`), indicador visual de IA ativa e contador de não lidas.
- **Coluna 2 — Área de Chat Ativo:**
  - Cabeçalho com identificação do contato e botão de destaque **"Assumir da IA" / "Devolver para IA"**, registrando nota automática de controle de atendimento.
  - Balões diferenciados para **Cliente**, **Atendente Humano**, **Agente de IA** (com destaque visual e ícone dedicado) e **Notas Internas** (cartão amarelo exclusivo para a equipe).
  - **Compositor avançado:**
    - Seletor de modo: *Responder Cliente* vs. *Nota Interna*.
    - **Respostas Rápidas (`/`):** menu acionável via botão ou digitando `/` no campo de mensagem, com atalhos específicos por segmento da empresa.
    - **Gerar Cobrança Pix:** modal validado para informar descrição e valor (`R$`), inserindo um **Cartão Pix Interativo** diretamente na conversa com código *Copia e Cola* e botão **"Simular Pagamento Confirmado"**.
    - Ao confirmar o Pix, o cartão muda para *Pago*, o contato/negócio avança automaticamente para **Ganho** no CRM e o valor passa a compor os totais do **Dashboard** e **Financeiro**.
- **Coluna 3 — Contexto do Cliente (Mini-CRM):**
  - Dados do contato (e-mail, WhatsApp, origem).
  - Seletor para alterar a **Etapa do Funil CRM** sincronizado com o Kanban.
  - **Tags clicáveis** (ativar/desativar sugestões ou criar tags personalizadas).
  - Bloco de **Conformidade LGPD** (*Opt-in Verificado*, *Opt-out* ou *Anonimizado*).
  - **Resumo Automático da IA** sintetizando o contexto comercial do lead.

### 3. CRM Kanban (Funil de Vendas)
Gestão visual das oportunidades em **5 colunas fixas**:
1. **Novo Lead**
2. **Qualificado pela IA**
3. **Proposta Enviada**
4. **Aguardando Pagamento**
5. **Ganho**

Funcionalidades incluídas:
- **Totalizador em `R$` e contador de negócios** no topo de cada coluna e no resumo geral do pipeline.
- **Cards completos:** nome do cliente, título da oportunidade, valor estimado, origem, tags e última interação.
- **Movimentação fluida:** suporte a **Drag-and-Drop** entre colunas e botões rápidos (`←` / `→`) em cada card, mantendo a etapa do contato sincronizada com o Inbox e a Base de Contatos.
- **Atalho para o WhatsApp:** botão em cada card para abrir diretamente a conversa do cliente no Inbox.
- **Modal "+ Novo Negócio":** criação validada de nova oportunidade (cliente, título, valor, WhatsApp, etapa inicial, origem e tags) adicionada imediatamente ao funil e à base de contatos.

### 4. Base de Contatos & LGPD
Tabela gerencial de leads e clientes com governança de privacidade:
- **Busca em tempo real** (nome, WhatsApp ou e-mail) e **filtro dinâmico por tag**.
- Colunas: *Nome (+ tags)*, *WhatsApp*, *E-mail*, *Etapa CRM*, *Status LGPD* (*Consentimento Ativo*, *Opt-out* ou *Anonimizado LGPD*) e *Ações*.
- **Abrir no chat:** leva o usuário direto para a conversa do contato no Inbox (ou inicia um novo atendimento caso ainda não exista).
- **Anonimização LGPD:** modal de confirmação (Art. 18 da LGPD) que substitui nome, telefone e e-mail por identificadores anônimos, preservando métricas sem expor dados pessoais.
- **Importar CSV:** modal interativo simulado com pré-visualização de registros que adiciona novos contatos reais ao estado da empresa ativa.
- **Exportar Lista:** gera e faz download de arquivo `.csv` real com os contatos filtrados.

### 5. Estúdio de Agentes de IA & Simulador
Ambiente em 2 painéis para treinamento e validação imediata do assistente virtual de cada empresa:
- **Painel Esquerdo — Configuração:**
  - Edição do **Nome do Agente** e seletor de **Tom de Voz** (*Consultivo*, *Amigável*, *Direto*).
  - Editor do **Prompt do Sistema** com instruções comerciais.
  - Switches de **Habilidades Ativas**:
    - *Transcrever Áudios do WhatsApp*
    - *Gerar Link Pix no Chat*
    - *Transferir para Humano ao detectar frustração*
  - **Base de Conhecimento (RAG):** upload simulado de arquivos PDF, cadastro de URLs e remoção de fontes indexadas.
- **Painel Direito — Simulador em Tempo Real ("Testar Agente Agora"):**
  - Mini-chat funcional com sugestões rápidas de teste e reinício de sessão.
  - Motor de simulação reativo às configurações atuais: altera saudação conforme o tom de voz, cita documentos da base RAG, aciona oferta de Pix quando a habilidade está ligada, responde sobre envio de áudio e executa alerta de transbordo humano ao detectar sinais de frustração.

### 6. Financeiro & Planos
Controle da assinatura SaaS da empresa e conciliação de recebimentos via chat:
- **Resumo do Plano Atual:** exibe tier vigente, valor mensal e data de renovação.
- **Barras de Progresso de Consumo:** monitoramento de *Usuários Ativos*, *Números WhatsApp Oficial* e *Interações de IA no Mês* com alertas visuais por faixa de uso.
- **Comparativo de Planos (*Starter*, *Growth* e *Scale*):** limites explícitos e botão funcional para migração/upgrade imediato de plano (atualizando franquias e MRR no Super Admin).
- **Histórico de Faturas & Pagamentos Pix Recebidos:** tabela filtrável (*Todos*, *Pix no Chat*, *Assinatura SaaS*) refletindo também novos pagamentos Pix confirmados durante a sessão.

### 7. Painel Super Admin (Backoffice SaaS)
Visão global da operação multicliente da plataforma:
- **4 Métricas Globais:** *MRR Total*, *Empresas Ativas*, *Churn Mensal* e *Consumo Global de IA*.
- **Tabela de Tenants:** busca por empresa/segmento/plano e filtro por status (*Todos*, *Ativo*, *Trial*, *Inadimplente*).
- **Botão "Acessar como Empresa" (Impersonation):** alterna instantaneamente o tenant ativo na plataforma e redireciona para o Dashboard da empresa escolhida.

---

## Empresas de Demonstração (Multi-tenant)

O ambiente já vem populado com 5 empresas brasileiras prontas para navegação:
1. **Clínica Sorriso Prime** (*Odontologia Estética* — Plano Growth — Ativo)
2. **Imobiliária Horizonte** (*Mercado Imobiliário & Alto Padrão* — Plano Scale — Ativo)
3. **Advocacia Silva & Costa** (*Direito Empresarial & Tributário* — Plano Growth — Ativo)
4. **Studio Fit Barra** (*Saúde & Bem-estar* — Plano Starter — Trial)
5. **TechLog Transportes** (*Logística & Cargas B2B* — Plano Growth — Inadimplente)

---

## Stack Tecnológica & Estrutura do Projeto

- **Core:** React 19, TypeScript, Vite
- **Estilização:** Tailwind CSS v4 (com suporte a Dark Mode via `@custom-variant dark`)
- **Ícones e Gráficos:** `lucide-react` e `recharts`
- **Testes Unitários:** `node:test` + `tsx` para regras de negócio puras

```text
src/
├── components/
│   ├── AppShell.tsx                  # Sidebar, Tenant Switcher, Topbar, Notificações e Toast
│   ├── GlobalSearchModal.tsx         # Modal de busca global (Ctrl + K)
│   └── screens/
│       ├── DashboardScreen.tsx       # Tela 1: KPIs, Gráfico IA vs. Humano e Atividade Recente
│       ├── InboxScreen.tsx           # Tela 2: Split-screen 3 colunas + Pix + Mini-CRM
│       ├── KanbanScreen.tsx          # Tela 3: Funil CRM 5 colunas + Drag-and-Drop + Novo Negócio
│       ├── ContactsScreen.tsx        # Tela 4: Base de Contatos, LGPD, Import/Export CSV
│       ├── AIAgentStudioScreen.tsx   # Tela 5: Configuração IA, RAG e Simulador ao Vivo
│       ├── BillingScreen.tsx         # Tela 6: Consumo do Plano, Upgrade e Histórico Pix/Faturas
│       └── SuperAdminScreen.tsx      # Tela 7: Métricas Globais SaaS e Impersonation de Tenants
├── context/
│   └── FoclientContext.tsx           # Estado global multicliente sincronizado em memória
├── data/
│   └── mockTenants.ts                # Catálogo de planos e dados mockados em PT-BR
├── types/
│   └── foclient.ts                   # Tipos TypeScript de todo o domínio
└── utils/
    ├── foclientLogic.ts              # Cálculos, filtros, LGPD, CSV, Pix e motor do Simulador IA
    └── foclientLogic.test.ts         # Suíte de testes unitários da lógica de domínio
```

---

## Como Executar e Testar

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 3000)
npm run dev

# Verificar tipagem TypeScript
npm run lint

# Gerar build de produção
npm run build

# Executar testes unitários da lógica de negócio
npx tsx --test src/utils/foclientLogic.test.ts
```
