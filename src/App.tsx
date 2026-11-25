import React from 'react';
import { AppShell } from './components/AppShell';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AIAgentStudioScreen } from './components/screens/AIAgentStudioScreen';
import { BillingScreen } from './components/screens/BillingScreen';
import { ContactsScreen } from './components/screens/ContactsScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { InboxScreen } from './components/screens/InboxScreen';
import { KanbanScreen } from './components/screens/KanbanScreen';
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
    case 'billing':
      return <BillingScreen />;
    case 'super-admin':
      return <SuperAdminScreen />;
    default:
      return <DashboardScreen />;
  }
}

export default function App() {
  return (
    <FoclientProvider>
      <AppShell>
        <ActiveScreenRouter />
      </AppShell>
      <GlobalSearchModal />
    </FoclientProvider>
  );
}
