# FOCLIENT — SaaS Multi-tenant (WhatsApp Real + IA + CRM Kanban + Pix + Neon Cloud DB)

Estrutura completa do projeto **FOCLIENT** dividida em:
- `/backend` — **Node.js + TypeScript + Fastify + Socket.io + Prisma ORM + Neon PostgreSQL + Baileys Multi-Device WhatsApp + Meta Cloud API Adapter + Swagger (`/docs`)**
- `/frontend` — **React 19 + TypeScript + Tailwind CSS v4 + Vite** integrado em tempo real às APIs REST e WebSockets do back-end.

---

## Por que adotamos `@whiskeysockets/baileys` (com Padrão Adapter)?

Em vez do legado `@open-wa/wa-automate` (que exige abrir uma instância pesada do Google Chrome/Puppeteer por cliente, consumindo ~500MB+ de RAM por sessão), adotamos o **`@whiskeysockets/baileys`** dentro do padrão `IWhatsAppProvider`:
- **Zero Chrome / Zero Puppeteer:** conecta via protocolo nativo **WhatsApp Multi-Device WebSockets** (~15MB de RAM por tenant).
- **QR Code instantâneo (< 1s)** emitido em tempo real via Socket.io (`whatsapp:qr`).
- **Pronto para API Oficial da Meta:** basta alternar o provider da instância para `META_CLOUD_API` (`MetaCloudAPIProvider`) sem alterar nenhuma regra de negócio.

---

## Como Rodar em Outra Máquina (Equipe Compartilhando o Banco Neon)

### 1. Instalar dependências
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configurar variáveis de ambiente
- Copie `backend/.env.example` para `backend/.env` e preencha `DATABASE_URL` e `DIRECT_URL` com a string do **Neon PostgreSQL**.
- Copie `frontend/.env.example` para `frontend/.env`.

### 3. Gerar Prisma Client (e opcionalmente sincronizar/popular banco)
```bash
cd backend
npx prisma generate
# Apenas se precisar atualizar tabelas ou recriar dados de seed:
# npm run prisma:push
# npm run prisma:seed
```

### 4. Iniciar Back-end e Front-end
Em dois terminais:
```bash
# Terminal 1 — Back-end (http://localhost:3333 | Docs: http://localhost:3333/docs)
cd backend
npm run dev

# Terminal 2 — Front-end (http://localhost:3000)
cd frontend
npm run dev
```

---

## Credenciais de Acesso Inicial (Seed no Neon)

| Perfil RBAC | E-mail | Senha | Empresa |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@foclient.com.br` | `123456` | Acesso global a todos os tenants |
| **TENANT_ADMIN** | `admin@sorrisoprime.com.br` | `123456` | Clínica Sorriso Prime |
| **AGENT** | `atendente@sorrisoprime.com.br` | `123456` | Clínica Sorriso Prime |
| **TENANT_ADMIN** | `admin@imobiliariahorizonte.com.br` | `123456` | Imobiliária Horizonte |
