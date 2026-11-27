import React from 'react';
import { AppShell } from './components/AppShell';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AIAgentStudioScreen } from './components/screens/AIAgentStudioScreen';
import { BillingScreen } from './components/screens/BillingScreen';
import { ChannelsScreen } from './components/screens/ChannelsScreen';
import { ContactsScreen } from './components/screens/ContactsScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { InboxScreen } from './components/screens/InboxScreen';
import { KanbanScreen } from './components/screens/KanbanScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { SuperAdminScreen } from './components/screens/SuperAdminScreen';
import { FoclientProvider, useFoclient } from './context/FoclientContext';

function ActiveScreenRouter() {
  const { activeScreen } = useFoclient();

  switch (activeScreen) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'inbox':
      return <InboxScreen />;
    case 'kanban':
      return <KanbanScreen />;
    case 'contacts':
      return <ContactsScreen />;
    case 'ai-studio':
      return <AIAgentStudioScreen />;
    case 'channels':
      return <ChannelsScreen />;
    case 'billing':
      return <BillingScreen />;
    case 'super-admin':
      return <SuperAdminScreen />;
    default:
      return <DashboardScreen />;
  }
}

function AuthenticatedAppGate() {
  const { user, authReady } = useFoclient();

  if (!authReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm font-medium">
        Conectando ao FOCLIENT Cloud (Neon PostgreSQL)...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <AppShell>
        <ActiveScreenRouter />
      </AppShell>
      <GlobalSearchModal />
    </>
  );
}

export default function App() {
  return (
    <FoclientProvider>
      <AuthenticatedAppGate />
    </FoclientProvider>
  );
}
