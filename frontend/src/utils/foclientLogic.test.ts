import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anonymizeContactRecord,
  buildPixCopyPasteCode,
  calculateColumnTotals,
  calculateGlobalSuperAdminMetrics,
  exportContactsToCSV,
  filterContacts,
  formatBRL,
  generateSimulatedAgentReply,
  getAdjacentStage,
  moveDealToStage,
} from './foclientLogic';
import { AIAgentConfig, Contact, Deal, TenantData } from '../types/foclient';

test('formatBRL formats Brazilian currency correctly', () => {
  const formatted = formatBRL(18450);
  assert.match(formatted, /18\.450,00/);
  assert.match(formatted, /R\$/);
});

test('calculateColumnTotals sums deals accurately per funnel stage', () => {
  const deals: Deal[] = [
    {
      id: 'd1',
      contactId: 'c1',
      title: 'Clareamento',
      clientName: 'Ana',
      value: 1200,
      stage: 'novo_lead',
      tags: [],
      origin: 'WhatsApp',
      lastInteraction: '10m',
    },
    {
      id: 'd2',
      contactId: 'c2',
      title: 'Implante',
      clientName: 'Bruno',
      value: 4500,
      stage: 'novo_lead',
      tags: [],
      origin: 'Instagram',
      lastInteraction: '15m',
    },
    {
      id: 'd3',
      contactId: 'c3',
      title: 'Invisalign',
      clientName: 'Carla',
      value: 9800,
      stage: 'ganho',
      tags: [],
      origin: 'Indicação',
      lastInteraction: '1h',
    },
  ];

  const totals = calculateColumnTotals(deals);
  assert.equal(totals.novo_lead.count, 2);
  assert.equal(totals.novo_lead.total, 5700);
  assert.equal(totals.ganho.count, 1);
  assert.equal(totals.ganho.total, 9800);
  assert.equal(totals.proposta_enviada.count, 0);
});

test('moveDealToStage and getAdjacentStage transition stages safely', () => {
  assert.equal(getAdjacentStage('novo_lead', 'prev'), null);
  assert.equal(getAdjacentStage('novo_lead', 'next'), 'qualificado_ia');
  assert.equal(getAdjacentStage('ganho', 'next'), null);

  const deals: Deal[] = [
    {
      id: 'd1',
      contactId: 'c1',
      title: 'Consulta',
      clientName: 'Mariana',
      value: 350,
      stage: 'novo_lead',
      tags: [],
      origin: 'WhatsApp',
      lastInteraction: '2h',
    },
  ];
  const updated = moveDealToStage(deals, 'd1', 'proposta_enviada');
  assert.equal(updated[0].stage, 'proposta_enviada');
  assert.equal(updated[0].lastInteraction, 'Agora mesmo');
});

test('anonymizeContactRecord strips personal data and marks LGPD status', () => {
  const contact: Contact = {
    id: 'cnt-9942',
    name: 'Mariana Alencar',
    phone: '+55 (11) 98765-4321',
    email: 'mariana@exemplo.com.br',
    stage: 'proposta_enviada',
    tags: ['VIP', 'Implante'],
    lgpdStatus: 'ativo',
    origin: 'WhatsApp',
    avatarInitials: 'MA',
  };

  const anon = anonymizeContactRecord(contact);
  assert.equal(anon.lgpdStatus, 'anonimizado');
  assert.equal(anon.name.includes('Mariana'), false);
  assert.equal(anon.email.includes('mariana'), false);
  assert.equal(anon.phone, '+55 (00) 00000-0000');
  assert.deepEqual(anon.tags, ['LGPD Anonimizado']);
});

test('filterContacts filters by search term and tag', () => {
  const contacts: Contact[] = [
    {
      id: 'c1',
      name: 'Lucas Ferreira',
      phone: '+55 (11) 91234-0001',
      email: 'lucas@mail.com',
      stage: 'novo_lead',
      tags: ['VIP', 'Implante'],
      lgpdStatus: 'ativo',
      origin: 'Instagram',
      avatarInitials: 'LF',
    },
    {
      id: 'c2',
      name: 'Patrícia Gomes',
      phone: '+55 (21) 99988-7766',
      email: 'patricia@mail.com',
      stage: 'ganho',
      tags: ['Ortodontia'],
      lgpdStatus: 'opt_out',
      origin: 'Google',
      avatarInitials: 'PG',
    },
  ];

  assert.equal(filterContacts(contacts, 'lucas', 'todas').length, 1);
  assert.equal(filterContacts(contacts, '', 'Ortodontia').length, 1);
  assert.equal(filterContacts(contacts, 'lucas', 'Ortodontia').length, 0);
});

test('generateSimulatedAgentReply honors skills, frustration handoff, and RAG knowledge base', () => {
  const config: AIAgentConfig = {
    name: 'Clara IA',
    roleTitle: 'Concierge Comercial',
    tone: 'Consultivo',
    systemPrompt: 'Atenda leads odontológicos com foco em agendamento.',
    skills: {
      transcribeAudio: true,
      generatePixLink: true,
      handoffOnFrustration: true,
    },
    knowledgeBase: [
      {
        id: 'kb1',
        type: 'pdf',
        title: 'Tabela Clareamento Laser 2026',
        sizeOrUrl: '1.4 MB',
        addedAt: 'Hoje',
        snippet: 'Clareamento a laser em 2 sessões por R$ 1.290,00 com 10% off no Pix.',
      },
    ],
  };

  const handoff = generateSimulatedAgentReply(
    'Isso é um absurdo, quero falar com humano!',
    config,
    'Clínica Sorriso Prime'
  );
  assert.equal(handoff.triggeredHandoff, true);

  const pixReply = generateSimulatedAgentReply(
    'Qual o valor para pagar no pix o clareamento?',
    config,
    'Clínica Sorriso Prime'
  );
  assert.equal(pixReply.includedPixOffer, true);
  assert.equal(pixReply.matchedSource, 'Tabela Clareamento Laser 2026');

  const noPixReply = generateSimulatedAgentReply(
    'Quero pagar via pix',
    { ...config, skills: { ...config.skills, generatePixLink: false } },
    'Clínica Sorriso Prime'
  );
  assert.equal(noPixReply.includedPixOffer, false);
});

test('buildPixCopyPasteCode and exportContactsToCSV return valid payloads', () => {
  const code = buildPixCopyPasteCode('Clínica Sorriso Prime', 450, 'pix-123456');
  assert.equal(code.startsWith('000201'), true);
  assert.equal(code.includes('045000'), true);

  const csv = exportContactsToCSV([
    {
      id: 'c1',
      name: 'João Silva',
      phone: '+55 (11) 98888-1111',
      email: 'joao@teste.com',
      stage: 'ganho',
      tags: ['VIP'],
      lgpdStatus: 'ativo',
      origin: 'WhatsApp',
      avatarInitials: 'JS',
    },
  ]);
  assert.match(csv, /^Nome,WhatsApp,E-mail,Etapa CRM,Status LGPD,Tags/);
  assert.match(csv, /"João Silva"/);
  assert.match(csv, /"Consentimento Ativo"/);
});

test('calculateGlobalSuperAdminMetrics aggregates MRR and AI consumption across tenants', () => {
  const mockTenants = [
    { status: 'Ativo', mrr: 397, billing: { aiInteractionsUsed: 3420 } },
    { status: 'Ativo', mrr: 897, billing: { aiInteractionsUsed: 8100 } },
    { status: 'Inadimplente', mrr: 197, billing: { aiInteractionsUsed: 500 } },
  ] as unknown as TenantData[];

  const metrics = calculateGlobalSuperAdminMetrics(mockTenants);
  assert.equal(metrics.mrrTotal, 1294);
  assert.equal(metrics.activeCount, 2);
  assert.equal(metrics.totalAiInteractions, 12020);
});
