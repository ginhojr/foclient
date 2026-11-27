import React, { useState } from 'react';
import {
  Bell,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useFoclient } from '../context/FoclientContext';
import { ScreenId } from '../types/foclient';
import { calculateTenantMetrics, getInitials } from '../utils/foclientLogic';

const SCREEN_META: Record<ScreenId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Operacional',
    subtitle: 'Visão geral em tempo real conectada ao Neon PostgreSQL',
  },
  inbox: {
    title: 'Inbox Omnichannel',
    subtitle: 'WhatsApp Real, transbordo de IA e cobrança Pix no chat',
  },
  kanban: {
    title: 'CRM Kanban',
    subtitle: 'Funil comercial sincronizado com conversas e pagamentos',
  },
  contacts: {
    title: 'Base de Contatos & LGPD',
    subtitle: 'Gestão de opt-in, segmentação por tags e anonimização com Audit Log',
  },
  'ai-studio': {
    title: 'Estúdio de Agentes de IA',
    subtitle: 'Configure persona, habilidades, base RAG e simulador ao vivo',
  },
  channels: {
    title: 'Integrações & WhatsApp Real',
    subtitle: 'Pareamento via QR Code Multi-Device e Adapter Oficial Meta Cloud API',
  },
  billing: {
    title: 'Financeiro & Planos',
    subtitle: 'Consumo da assinatura SaaS e histórico de recebimentos Pix',
  },
  'super-admin': {
    title: 'Painel Super Admin',
    subtitle: 'Governança global da plataforma multicliente FOCLIENT',
  },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin SaaS',
  TENANT_ADMIN: 'Admin da Empresa',
  MANAGER: 'Gestor Comercial',
  AGENT: 'Atendente',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    logout,
    tenants,
    activeTenant,
    activeScreen,
    theme,
    notifications,
    toastMessage,
    whatsappStatus,
    setActiveScreen,
    switchTenant,
    toggleTheme,
    setGlobalSearchOpen,
    markAllNotificationsRead,
    dismissToast,
  } = useFoclient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [waStatusOpen, setWaStatusOpen] = useState(false);

  const metrics = calculateTenantMetrics(activeTenant);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const isWaConnected = whatsappStatus.status === 'CONNECTED';
  const isWaQrReady = whatsappStatus.status === 'QR_READY';

  const navItems: {
    id: ScreenId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'inbox',
      label: 'Inbox Omnichannel',
      icon: MessageSquare,
      badge: metrics.unreadTotal > 0 ? metrics.unreadTotal : undefined,
    },
    { id: 'kanban', label: 'CRM Kanban', icon: Kanban },
    { id: 'contacts', label: 'Contatos & LGPD', icon: Users },
    { id: 'ai-studio', label: 'Agentes de IA', icon: Bot },
    {
      id: 'channels',
      label: 'Integrações / WhatsApp',
      icon: Smartphone,
      badge: isWaConnected ? 'ON' : isWaQrReady ? 'QR' : undefined,
    },
    { id: 'billing', label: 'Financeiro & Planos', icon: CreditCard },
  ];

  const handleNavClick = (id: ScreenId) => {
    setActiveScreen(id);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand + Tenant Switcher */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
              FC
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              FOCLIENT
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu lateral"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-tenant Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTenantMenuOpen((prev) => !prev)}
            aria-expanded={tenantMenuOpen}
            aria-label="Selecionar empresa ativa"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {activeTenant.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Plano {activeTenant.billing.tier} · {activeTenant.segment}
                </p>
              </div>
            </div>
            {tenants.length > 1 && <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>

          {tenantMenuOpen && tenants.length > 1 && (
            <div className="absolute left-0 right-0 mt-1.5 z-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1.5">
              <div className="px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Trocar empresa (Multi-tenant)
              </div>
              {tenants.map((tenant) => {
                const isSelected = tenant.id === activeTenant.id;
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => {
                      switchTenant(tenant.id);
                      setTenantMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate">{tenant.name}</p>
                      <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                        {tenant.segment}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  className={`ml-2 px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-semibold rounded-md ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badge === 'ON'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {user?.role === 'SUPER_ADMIN' && (
          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Governança SaaS
            </div>
            <button
              type="button"
              onClick={() => handleNavClick('super-admin')}
              aria-current={activeScreen === 'super-admin' ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === 'super-admin'
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    activeScreen === 'super-admin' ? 'text-white' : 'text-indigo-500'
                  }`}
                />
                <span className="truncate">Super Admin</span>
              </span>
              <span className="text-[11px] font-mono tabular-nums opacity-75">
                {tenants.length}
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Sidebar Footer: Real User Profile + Theme + Logout */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-semibold shrink-0">
              {getInitials(user?.name || 'FC')}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {ROLE_LABELS[user?.role || 'AGENT'] ?? user?.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={logout}
              aria-label="Sair da conta"
              title="Sair"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-full">{sidebarContent}</aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                {SCREEN_META[activeScreen].title}
              </h1>
              <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
                {activeScreen === 'super-admin'
                  ? SCREEN_META[activeScreen].subtitle
                  : `${activeTenant.name} · ${SCREEN_META[activeScreen].subtitle}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Search Ctrl + K */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              aria-label="Busca global (Ctrl + K)"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-xs"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Buscar clientes, negócios...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400">
                Ctrl K
              </kbd>
            </button>

            {/* Real-Time WhatsApp Connection Status */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setWaStatusOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                aria-expanded={waStatusOpen}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                  isWaConnected
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70'
                    : isWaQrReady
                      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {isWaConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isWaConnected
                        ? 'bg-emerald-500'
                        : isWaQrReady
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                    }`}
                  />
                </span>
                <span>
                  {isWaConnected
                    ? 'WhatsApp Real Conectado'
                    : isWaQrReady
                      ? 'Ler QR Code WhatsApp'
                      : 'Conectar WhatsApp'}
                </span>
              </button>

              {waStatusOpen && (
                <div className="absolute right-0 mt-2 w-80 z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {whatsappStatus.engineName}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        isWaConnected
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isWaConnected ? 'Conectado' : isWaQrReady ? 'QR Pronto' : 'Desconectado'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    Canal da empresa <strong>{activeTenant.name}</strong>.
                  </p>
                  <div className="space-y-1.5 text-xs border-t border-slate-100 dark:border-slate-800 pt-2.5 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Número</span>
                      <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {whatsappStatus.phoneNumber || activeTenant.whatsappNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Agente vinculado</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {activeTenant.agentConfig.name}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWaStatusOpen(false);
                      setActiveScreen('channels');
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {isWaConnected ? 'Gerenciar Conexão WhatsApp' : 'Gerar QR Code WhatsApp'}
                  </button>
                </div>
              )}
            </div>

            {/* Topbar Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setWaStatusOpen(false);
                }}
                aria-label="Notificações"
                aria-expanded={notifOpen}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 z-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Notificações ({activeTenant.name})
                    </span>
                    {unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Marcar lidas
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                        Nenhuma notificação recente para esta empresa.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setActiveScreen(n.screen);
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                            !n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {n.title}
                            </p>
                            <span className="text-[11px] text-slate-400 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {n.description}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
      </div>

      {/* Transient Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg text-xs font-medium max-w-sm"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Fechar aviso"
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
