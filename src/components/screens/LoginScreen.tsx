import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useFoclient } from '../../context/FoclientContext';

const DEMO_ACCOUNTS = [
  {
    label: 'Super Admin (Todos os Tenants)',
    name: 'Mariana Costa',
    email: 'superadmin@foclient.com.br',
    roleBadge: 'SUPER_ADMIN',
  },
  {
    label: 'Admin — Clínica Sorriso Prime',
    name: 'Dra. Renata Almeida',
    email: 'admin@sorrisoprime.com.br',
    roleBadge: 'TENANT_ADMIN',
  },
  {
    label: 'Atendente — Clínica Sorriso Prime',
    name: 'Lucas Rocha',
    email: 'atendente@sorrisoprime.com.br',
    roleBadge: 'AGENT',
  },
  {
    label: 'Admin — Imobiliária Horizonte',
    name: 'Roberto Campos',
    email: 'admin@imobiliariahorizonte.com.br',
    roleBadge: 'TENANT_ADMIN',
  },
];

export function LoginScreen() {
  const { login, registerTenant, authLoading } = useFoclient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('superadmin@foclient.com.br');
  const [password, setPassword] = useState('123456');
  const [companyName, setCompanyName] = useState('');
  const [segment, setSegment] = useState('Clínica & Saúde');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await registerTenant({
          companyName: companyName.trim(),
          segment: segment.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível autenticar. Verifique se o back-end está ativo.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-base shadow-md">
              FC
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">FOCLIENT</span>
              <span className="ml-2 px-2 py-0.5 text-[11px] rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                SaaS Multi-tenant
              </span>
            </div>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight max-w-lg">
            Atendimento WhatsApp Real, Agentes de IA, CRM Kanban e Pix no Chat.
          </h1>
          <p className="text-slate-400 text-sm mt-4 max-w-md leading-relaxed">
            Conectado diretamente ao PostgreSQL na nuvem (Neon) com WebSockets em tempo real,
            isolamento multi-tenant, auditoria LGPD e conexão WhatsApp via QR Code.
          </p>

          <div className="mt-8 space-y-3.5 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PostgreSQL Cloud (Neon) compartilhado para toda a equipe</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>WhatsApp Multi-Device Real via QR Code + Adapter Meta Cloud API</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Agentes de IA com Base RAG, Transbordo Humano e Cobrança Pix</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Arquitetura Fastify + Prisma + Socket.io</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            LGPD & RBAC Ativos
          </span>
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center">
              FC
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">FOCLIENT</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' ? 'Acessar Plataforma' : 'Criar Nova Empresa (Tenant)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {mode === 'login'
                ? 'Entre com suas credenciais ou escolha um perfil de demonstração abaixo.'
                : 'Cadastre uma nova empresa isolada no banco Neon PostgreSQL.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Criar Conta SaaS
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome da Empresa
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex.: Clínica Vida Plena"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Seu Nome
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Segmento
                    </label>
                    <input
                      type="text"
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      placeholder="Ex.: Saúde, Varejo..."
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              {authLoading
                ? 'Autenticando no Neon...'
                : mode === 'login'
                  ? 'Entrar no Painel FOCLIENT'
                  : 'Criar Empresa e Acessar'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                <span>Acesso Rápido (Contas Seed do Banco Neon — Senha: 123456)</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('123456');
                      setError(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      email === acc.email
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {acc.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {acc.email}
                      </p>
                    </div>
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {acc.roleBadge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
