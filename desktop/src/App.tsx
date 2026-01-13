import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { RulePacksView } from './views/RulePacksView';
import { AgentsView } from './views/AgentsView';
import { CommandsView } from './views/CommandsView';
import { SettingsView } from './views/SettingsView';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="rule-packs" element={<RulePacksView />} />
            <Route path="agents" element={<AgentsView />} />
            <Route path="commands" element={<CommandsView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
