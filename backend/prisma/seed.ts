import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildPixCopyPasteCode } from '../src/services/pix.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seed no banco PostgreSQL na nuvem (Neon)...');

  const existingTenants = await prisma.tenant.count();
  if (existingTenants > 0) {
    console.log(`ℹ️ Banco já possui ${existingTenants} empresas. Limpando para recriar seed limpo...`);
    await prisma.auditLog.deleteMany();
    await prisma.message.deleteMany();
    await prisma.pixCharge.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.deal.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.billingInvoice.deleteMany();
    await prisma.whatsAppInstance.deleteMany();
    await prisma.aIAgent.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
  }

  const passwordHash = await bcrypt.hash('123456', 10);

  // =========================================================================
  // TENANT 1: Clínica Sorriso Prime
  // =========================================================================
  const t1 = await prisma.tenant.create({
    data: {
      slug: 'clinica-sorriso-prime',
      name: 'Clínica Sorriso Prime',
      segment: 'Odontologia Estética',
      whatsappNumber: '+55 (11) 94002-8922',
      plan: 'GROWTH',
      status: 'ACTIVE',
      mrr: 397,
      usersLimit: 10,
      whatsappLimit: 2,
      aiInteractionsUsed: 1842,
      aiInteractionsLimit: 5000,
      renewalDate: '15/12/2026',
      avgResponseSeconds: 14,
      baseChatsToday: 148,
      chatsGrowthPct: 18.4,
      baseAiResolvedPct: 68,
      settings: {
        dailyVolume: [
          { day: 'Seg', ia: 84, humano: 42 },
          { day: 'Ter', ia: 96, humano: 38 },
          { day: 'Qua', ia: 112, humano: 47 },
          { day: 'Qui', ia: 104, humano: 41 },
          { day: 'Sex', ia: 128, humano: 53 },
          { day: 'Sáb', ia: 79, humano: 26 },
          { day: 'Dom', ia: 62, humano: 19 },
        ],
        recentActivity: [
          {
            id: 'act-1',
            type: 'pix_confirmed',
            title: 'Pix confirmado — Fernanda Vasconcelos',
            subtitle: 'Alinhador Invisalign — 1ª Parcela',
            timestamp: 'Há 25 min',
            amount: 3850,
          },
          {
            id: 'act-2',
            type: 'ai_handoff',
            title: 'Transbordo da IA para Dra. Renata',
            subtitle: 'Rafael Mendes solicitou parcelamento para Lentes de Porcelana',
            timestamp: 'Há 48 min',
          },
        ],
        quickReplies: [
          {
            shortcut: '/avaliacao',
            title: 'Agendar Avaliação 3D',
            text: 'Nossa avaliação inclui escaneamento intraoral 3D digital! Qual período (manhã ou tarde) fica melhor para você?',
          },
          {
            shortcut: '/pix10',
            title: 'Desconto 10% no Pix',
            text: 'Para fechamento à vista via Pix consigo aplicar 10% de desconto imediato e reservar sua agenda agora mesmo!',
          },
          {
            shortcut: '/endereco',
            title: 'Localização e Estacionamento',
            text: 'Estamos na Av. Paulista, 1840 — Jardins (SP), com manobrista cortesia para pacientes agendados.',
          },
        ],
      },
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      tenantId: t1.id,
      name: 'Mariana Costa',
      email: 'superadmin@foclient.com.br',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  const t1Admin = await prisma.user.create({
    data: {
      tenantId: t1.id,
      name: 'Dra. Renata Almeida',
      email: 'admin@sorrisoprime.com.br',
      passwordHash,
      role: 'TENANT_ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      tenantId: t1.id,
      name: 'Lucas Rocha',
      email: 'atendente@sorrisoprime.com.br',
      passwordHash,
      role: 'AGENT',
    },
  });

  await prisma.whatsAppInstance.create({
    data: {
      tenantId: t1.id,
      name: 'Canal Principal',
      provider: 'BAILEYS',
      status: 'DISCONNECTED',
      phoneNumber: '+55 (11) 94002-8922',
    },
  });

  await prisma.aIAgent.create({
    data: {
      tenantId: t1.id,
      name: 'Clara IA',
      roleTitle: 'Concierge de Odontologia Estética',
      tone: 'Consultivo',
      systemPrompt:
        'Atue como concierge especialista da Clínica Sorriso Prime. Qualifique o tratamento desejado (Clareamento a Laser, Lentes de Porcelana, Invisalign ou Implantes), destaque o escaneamento 3D e ofereça pagamento do sinal via Pix com 10% de desconto à vista.',
      transcribeAudio: true,
      generatePixLink: true,
      handoffOnFrustration: true,
      knowledgeDocuments: [
        {
          id: 'kb-s1',
          type: 'pdf',
          title: 'Tabela_Tratamentos_SorrisoPrime_2026.pdf',
          sizeOrUrl: '1.8 MB',
          addedAt: '10/11/2026',
          snippet:
            'Clareamento a Laser (2 sessões): R$ 1.290,00 com 10% off no Pix. Lentes de Contato Dental em porcelana: avaliação 3D R$ 250,00 abatidos no tratamento. Invisalign a partir de R$ 3.850,00 entrada.',
        },
        {
          id: 'kb-s2',
          type: 'url',
          title: 'Protocolos de Garantia & Biossegurança',
          sizeOrUrl: 'https://sorrisoprime.com.br/protocolos',
          addedAt: '14/11/2026',
          snippet:
            'Atendimento de segunda a sábado das 08h às 20h na Unidade Jardins com estacionamento gratuito.',
        },
      ],
    },
  });

  const cCamila = await prisma.contact.create({
    data: {
      tenantId: t1.id,
      name: 'Camila Rodrigues',
      phone: '+55 (11) 98841-2210',
      phoneNormalized: '5511988412210',
      email: 'camila.rodrigues@gmail.com',
      stage: 'aguardando_pagamento',
      tags: ['Clareamento', 'VIP'],
      origin: 'Instagram Ads',
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdStatus: 'ativo',
    },
  });

  const cRafael = await prisma.contact.create({
    data: {
      tenantId: t1.id,
      name: 'Rafael Mendes',
      phone: '+55 (11) 97622-9045',
      phoneNormalized: '5511976229045',
      email: 'rafael.mendes@empresa.com.br',
      stage: 'proposta_enviada',
      tags: ['Lentes Porcelana', 'Alta Intenção'],
      origin: 'Google Search',
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdStatus: 'ativo',
    },
  });

  const cFernanda = await prisma.contact.create({
    data: {
      tenantId: t1.id,
      name: 'Fernanda Vasconcelos',
      phone: '+55 (11) 99104-5588',
      phoneNormalized: '5511991045588',
      email: 'fernanda.v@uol.com.br',
      stage: 'ganho',
      tags: ['Invisalign', 'VIP'],
      origin: 'Indicação',
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdStatus: 'ativo',
    },
  });

  const cEduardo = await prisma.contact.create({
    data: {
      tenantId: t1.id,
      name: 'Eduardo Nogueira',
      phone: '+55 (11) 96331-7840',
      phoneNormalized: '5511963317840',
      email: 'eduardo.nogueira@outlook.com',
      stage: 'qualificado_ia',
      tags: ['Implante', 'Urgente'],
      origin: 'WhatsApp Direto',
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdStatus: 'ativo',
    },
  });

  const cBeatriz = await prisma.contact.create({
    data: {
      tenantId: t1.id,
      name: 'Beatriz Oliveira',
      phone: '+55 (11) 98447-3109',
      phoneNormalized: '5511984473109',
      email: 'bia.oliveira@gmail.com',
      stage: 'novo_lead',
      tags: ['Avaliação', 'Clareamento'],
      origin: 'Instagram Ads',
      lgpdConsent: false,
      lgpdStatus: 'opt_out',
    },
  });

  await prisma.deal.createMany({
    data: [
      {
        tenantId: t1.id,
        contactId: cCamila.id,
        title: 'Clareamento a Laser + Profilaxia',
        value: 1290,
        stage: 'aguardando_pagamento',
        tags: ['Clareamento', 'VIP'],
        origin: 'Instagram Ads',
      },
      {
        tenantId: t1.id,
        contactId: cRafael.id,
        title: '10 Lentes de Contato em Porcelana',
        value: 14800,
        stage: 'proposta_enviada',
        tags: ['Lentes Porcelana', 'Alta Intenção'],
        origin: 'Google Search',
      },
      {
        tenantId: t1.id,
        contactId: cFernanda.id,
        title: 'Tratamento Completo Invisalign Full',
        value: 11500,
        stage: 'ganho',
        tags: ['Invisalign', 'VIP'],
        origin: 'Indicação',
      },
      {
        tenantId: t1.id,
        contactId: cEduardo.id,
        title: 'Implante Unitário Carga Imediata',
        value: 4600,
        stage: 'qualificado_ia',
        tags: ['Implante', 'Urgente'],
        origin: 'WhatsApp Direto',
      },
      {
        tenantId: t1.id,
        contactId: cBeatriz.id,
        title: 'Avaliação Estética Digital 3D',
        value: 250,
        stage: 'novo_lead',
        tags: ['Avaliação'],
        origin: 'Instagram Ads',
      },
    ],
  });

  const convCamila = await prisma.conversation.create({
    data: {
      tenantId: t1.id,
      contactId: cCamila.id,
      status: 'BOT',
      unreadCount: 2,
      channel: 'WhatsApp Oficial',
      aiSummary:
        'Lead interessada em clareamento a laser + profilaxia para casamento em dezembro. Já recebeu valores e solicitou Pix do sinal de R$ 450,00.',
    },
  });

  const pixCamila = await prisma.pixCharge.create({
    data: {
      tenantId: t1.id,
      conversationId: convCamila.id,
      contactId: cCamila.id,
      description: 'Sinal de Reserva — Clareamento a Laser',
      amount: 450,
      copyPasteCode: buildPixCopyPasteCode(t1.name, 450, 'SINAL450'),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        tenantId: t1.id,
        conversationId: convCamila.id,
        senderType: 'CONTACT',
        senderName: 'Camila Rodrigues',
        content: 'Oi! Vi o anúncio do clareamento a laser. Vocês têm horário ainda essa semana?',
      },
      {
        tenantId: t1.id,
        conversationId: convCamila.id,
        senderType: 'AI',
        senderName: 'Clara IA',
        content:
          'Olá, Camila! Temos horários disponíveis quinta às 15h30 e sexta às 10h00 na unidade Jardins. O protocolo completo em 2 sessões sai por R$ 1.290,00 com 10% de desconto no Pix.',
      },
      {
        tenantId: t1.id,
        conversationId: convCamila.id,
        senderType: 'INTERNAL_NOTE',
        senderName: 'Mariana Costa (Coord.)',
        content:
          'Paciente já fez profilaxia aqui antes. Pode liberar bônus de escaneamento 3D se fechar hoje.',
      },
      {
        tenantId: t1.id,
        conversationId: convCamila.id,
        senderType: 'CONTACT',
        senderName: 'Camila Rodrigues',
        content: 'Perfeito! Pode reservar quinta às 15h30 e me mandar o Pix do sinal de R$ 450,00?',
      },
    ],
  });

  await prisma.message.create({
    data: {
      tenantId: t1.id,
      conversationId: convCamila.id,
      senderType: 'AI',
      senderName: 'Clara IA',
      content:
        'Horário pré-reservado para quinta às 15h30! Segue a cobrança Pix oficial para confirmação imediata:',
      pixChargeId: pixCamila.id,
    },
  });

  const convRafael = await prisma.conversation.create({
    data: {
      tenantId: t1.id,
      contactId: cRafael.id,
      assignedUserId: t1Admin.id,
      status: 'PENDING',
      unreadCount: 1,
      channel: 'WhatsApp Oficial',
      aiSummary:
        'Lead qualificado pela IA para 10 lentes de porcelana (R$ 14.800). Solicitou condição especial parcelada com humano.',
    },
  });

  await prisma.message.createMany({
    data: [
      {
        tenantId: t1.id,
        conversationId: convRafael.id,
        senderType: 'CONTACT',
        senderName: 'Rafael Mendes',
        content: 'Gostei do orçamento das lentes de porcelana, mas consigo dar entrada no Pix e parcelar o restante?',
      },
      {
        tenantId: t1.id,
        conversationId: convRafael.id,
        senderType: 'AI',
        senderName: 'Clara IA',
        content:
          'Excelente escolha, Rafael! Vou transferir sua conversa agora mesmo para a Dra. Renata aprovar uma condição personalizada de entrada via Pix + parcelamento.',
      },
    ],
  });

  await prisma.billingInvoice.createMany({
    data: [
      {
        tenantId: t1.id,
        description: 'Pix recebido — Alinhador Invisalign (1ª Parcela)',
        type: 'Pix no Chat',
        clientOrRef: 'Fernanda Vasconcelos',
        amount: 3850,
        status: 'Pago',
      },
      {
        tenantId: t1.id,
        description: 'Pix recebido — Escaneamento 3D + Profilaxia',
        type: 'Pix no Chat',
        clientOrRef: 'Eduardo Nogueira',
        amount: 680,
        status: 'Pago',
      },
      {
        tenantId: t1.id,
        description: 'Assinatura FOCLIENT — Plano Growth',
        type: 'Assinatura SaaS',
        clientOrRef: 'NF-2026-1104',
        amount: 397,
        status: 'Pago',
      },
    ],
  });

  // =========================================================================
  // TENANT 2: Imobiliária Horizonte
  // =========================================================================
  const t2 = await prisma.tenant.create({
    data: {
      slug: 'imobiliaria-horizonte',
      name: 'Imobiliária Horizonte',
      segment: 'Mercado Imobiliário & Alto Padrão',
      whatsappNumber: '+55 (21) 99812-4400',
      plan: 'SCALE',
      status: 'ACTIVE',
      mrr: 897,
      usersLimit: 30,
      whatsappLimit: 6,
      aiInteractionsUsed: 6420,
      aiInteractionsLimit: 20000,
      renewalDate: '20/12/2026',
      avgResponseSeconds: 11,
      baseChatsToday: 215,
      chatsGrowthPct: 24.1,
      baseAiResolvedPct: 74,
      settings: {
        dailyVolume: [
          { day: 'Seg', ia: 132, humano: 49 },
          { day: 'Ter', ia: 148, humano: 52 },
          { day: 'Qua', ia: 160, humano: 58 },
          { day: 'Qui', ia: 155, humano: 47 },
          { day: 'Sex', ia: 184, humano: 63 },
          { day: 'Sáb', ia: 140, humano: 51 },
          { day: 'Dom', ia: 98, humano: 34 },
        ],
        recentActivity: [
          {
            id: 'act-h1',
            type: 'pix_confirmed',
            title: 'Pix confirmado — Marcelo Albuquerque',
            subtitle: 'Reserva de Visita Exclusiva + Certidões',
            timestamp: 'Há 18 min',
            amount: 2500,
          },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: t2.id,
      name: 'Roberto Campos',
      email: 'admin@imobiliariahorizonte.com.br',
      passwordHash,
      role: 'TENANT_ADMIN',
    },
  });

  await prisma.whatsAppInstance.create({
    data: {
      tenantId: t2.id,
      name: 'Canal Principal',
      provider: 'BAILEYS',
      status: 'DISCONNECTED',
      phoneNumber: '+55 (21) 99812-4400',
    },
  });

  await prisma.aIAgent.create({
    data: {
      tenantId: t2.id,
      name: 'Helena IA',
      roleTitle: 'Consultora Digital de Imóveis Alto Padrão',
      tone: 'Consultivo',
      systemPrompt:
        'Atue como consultora imobiliária da Imobiliária Horizonte. Qualifique metragem, bairro de preferência, faixa de investimento e disponibilidade para visita guiada.',
      transcribeAudio: true,
      generatePixLink: true,
      handoffOnFrustration: true,
      knowledgeDocuments: [
        {
          id: 'kb-h1',
          type: 'pdf',
          title: 'Book_Lancamentos_ZonaSul_2026.pdf',
          sizeOrUrl: '4.2 MB',
          addedAt: '08/11/2026',
          snippet:
            'Coberturas lineares no Leblon e Ipanema de 180m² a 320m², 3 vagas na escritura. Sinal de reserva técnica de proposta via Pix.',
        },
      ],
    },
  });

  const cMarcelo = await prisma.contact.create({
    data: {
      tenantId: t2.id,
      name: 'Marcelo Albuquerque',
      phone: '+55 (21) 99210-7788',
      phoneNormalized: '5521992107788',
      email: 'marcelo.alb@invest.com.br',
      stage: 'proposta_enviada',
      tags: ['Alto Padrão', 'Cobertura'],
      origin: 'Portal ZAP',
      lgpdConsent: true,
      lgpdConsentAt: new Date(),
      lgpdStatus: 'ativo',
    },
  });

  await prisma.deal.create({
    data: {
      tenantId: t2.id,
      contactId: cMarcelo.id,
      title: 'Cobertura Duplex Ipanema — 240m²',
      value: 4200000,
      stage: 'proposta_enviada',
      tags: ['Alto Padrão', 'Vista Mar'],
      origin: 'Portal ZAP',
    },
  });

  const convMarcelo = await prisma.conversation.create({
    data: {
      tenantId: t2.id,
      contactId: cMarcelo.id,
      status: 'BOT',
      unreadCount: 1,
      channel: 'WhatsApp Oficial',
      aiSummary:
        'Investidor buscando cobertura em Ipanema com 3 suítes. Visita pré-agendada para sábado às 10h.',
    },
  });

  await prisma.message.createMany({
    data: [
      {
        tenantId: t2.id,
        conversationId: convMarcelo.id,
        senderType: 'CONTACT',
        senderName: 'Marcelo Albuquerque',
        content: 'Bom dia! Gostaria de confirmar a visita à cobertura de Ipanema neste sábado às 10h.',
      },
      {
        tenantId: t2.id,
        conversationId: convMarcelo.id,
        senderType: 'AI',
        senderName: 'Helena IA',
        content:
          'Bom dia, Marcelo! Visita confirmada para sábado às 10h00 com nosso diretor comercial Roberto Campos. Enviei a ficha técnica completa no seu e-mail.',
      },
    ],
  });

  await prisma.billingInvoice.createMany({
    data: [
      {
        tenantId: t2.id,
        description: 'Taxa de Reserva Documental via Pix',
        type: 'Pix no Chat',
        clientOrRef: 'Marcelo Albuquerque',
        amount: 2500,
        status: 'Pago',
      },
      {
        tenantId: t2.id,
        description: 'Assinatura FOCLIENT — Plano Scale',
        type: 'Assinatura SaaS',
        clientOrRef: 'NF-2026-1109',
        amount: 897,
        status: 'Pago',
      },
    ],
  });

  // =========================================================================
  // TENANT 3: Advocacia Silva & Costa (Trial)
  // =========================================================================
  const t3 = await prisma.tenant.create({
    data: {
      slug: 'advocacia-silva-costa',
      name: 'Advocacia Silva & Costa',
      segment: 'Direito Empresarial & Tributário',
      whatsappNumber: '+55 (31) 98800-1122',
      plan: 'STARTER',
      status: 'TRIAL',
      mrr: 197,
      usersLimit: 3,
      whatsappLimit: 1,
      aiInteractionsUsed: 310,
      aiInteractionsLimit: 1500,
      renewalDate: '05/12/2026',
      avgResponseSeconds: 18,
      baseChatsToday: 36,
      chatsGrowthPct: 12.5,
      baseAiResolvedPct: 62,
    },
  });

  await prisma.whatsAppInstance.create({
    data: {
      tenantId: t3.id,
      name: 'Canal Principal',
      provider: 'BAILEYS',
      status: 'DISCONNECTED',
      phoneNumber: '+55 (31) 98800-1122',
    },
  });

  await prisma.aIAgent.create({
    data: {
      tenantId: t3.id,
      name: 'Dr. Assistente IA',
      roleTitle: 'Triagem Jurídica Empresarial',
      tone: 'Direto',
      systemPrompt:
        'Realize a triagem inicial de demandas empresariais e tributárias com ética profissional e agende consulta diagnóstica com os sócios.',
      transcribeAudio: true,
      generatePixLink: true,
      handoffOnFrustration: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: t1.id,
      userId: superAdmin.id,
      action: 'DATABASE_SEED_COMPLETED',
      entity: 'system',
      metadata: {
        tenantsCreated: 3,
        cloudProvider: 'Neon PostgreSQL',
      },
    },
  });

  console.log('✅ Seed concluído com sucesso no Neon PostgreSQL!');
  console.log('   🔑 Super Admin: superadmin@foclient.com.br / 123456');
  console.log('   🔑 Admin Sorriso Prime: admin@sorrisoprime.com.br / 123456');
  console.log('   🔑 Atendente Sorriso Prime: atendente@sorrisoprime.com.br / 123456');
  console.log('   🔑 Admin Imobiliária Horizonte: admin@imobiliariahorizonte.com.br / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
