import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandCard } from '@/components/CommandCard';
import { CommandBrowser } from '@/components/CommandBrowser';
import { CommandDetailModal } from '@/components/CommandDetailModal';
import { ActiveCommandsPanel } from '@/components/ActiveCommandsPanel';
import type { CommandMetadata } from '@/lib/commands';

// Mock the tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'list_available_commands') {
      return Promise.resolve(mockCommands);
    }
    if (cmd === 'get_command_by_id') {
      return Promise.resolve(mockCommands[0]);
    }
    if (cmd === 'load_command_content') {
      return Promise.resolve('Mock command content');
    }
    if (cmd === 'get_all_agents') {
      return Promise.resolve([
        { id: 'cursor', name: 'Cursor', commandFormat: 'slash' },
        { id: 'claude', name: 'Claude', commandFormat: 'slash' },
      ]);
    }
    return Promise.resolve(null);
  }),
}));

// Mock zustand store
vi.mock('@/stores/deploymentConfigStore', () => ({
  useDeploymentConfigStore: () => ({
    enabledCommandIds: [],
    enableCommand: vi.fn(),
    disableCommand: vi.fn(),
  }),
}));

const mockCommands: CommandMetadata[] = [
  {
    id: 'issue',
    name: 'Issue',
    description: 'Create a GitHub issue',
    scriptPath: '~/.agentsmd/scripts/issue.py',
    agentCompatibility: [],
    requiresGitHub: true,
    outReferences: ['rule-packs/github-hygiene/issue-first.md'],
    category: 'workflow',
    characterCount: 1500,
    wordCount: 300,
    sourcePath: 'commands/src/issue.md',
  },
  {
    id: 'status',
    name: 'Status',
    description: 'Show workflow status',
    scriptPath: '~/.agentsmd/scripts/status.py',
    agentCompatibility: [],
    requiresGitHub: false,
    outReferences: [],
    category: 'git',
    characterCount: 500,
    wordCount: 100,
    sourcePath: 'commands/src/status.md',
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('CommandCard', () => {
  const mockCommand = mockCommands[0];

  it('renders command name and description', () => {
    render(
      <CommandCard command={mockCommand} />,
      { wrapper }
    );

    expect(screen.getByText('Issue')).toBeInTheDocument();
    expect(screen.getByText('Create a GitHub issue')).toBeInTheDocument();
  });

  it('shows category badge', () => {
    render(
      <CommandCard command={mockCommand} />,
      { wrapper }
    );

    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  it('shows GitHub indicator when requiresGitHub is true', () => {
    render(
      <CommandCard command={mockCommand} />,
      { wrapper }
    );

    // The GitHub icon should be present (with title attribute)
    const githubIcon = document.querySelector('[title="Requires GitHub CLI"]');
    expect(githubIcon).toBeInTheDocument();
  });

  it('calls onToggle when toggle button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <CommandCard 
        command={mockCommand} 
        isEnabled={false}
        onToggle={handleToggle} 
      />,
      { wrapper }
    );

    const enableButton = screen.getByText('Enable');
    fireEvent.click(enableButton);
    expect(handleToggle).toHaveBeenCalled();
  });

  it('shows enabled status correctly', () => {
    render(
      <CommandCard 
        command={mockCommand} 
        isEnabled={true}
      />,
      { wrapper }
    );

    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <CommandCard 
        command={mockCommand} 
        onSelect={handleSelect} 
      />,
      { wrapper }
    );

    const card = screen.getByText('Issue').closest('div');
    if (card) {
      fireEvent.click(card);
      expect(handleSelect).toHaveBeenCalled();
    }
  });
});

describe('CommandBrowser', () => {
  it('renders loading state initially', async () => {
    render(
      <CommandBrowser onSelectCommand={vi.fn()} />,
      { wrapper }
    );

    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders commands after loading', async () => {
    render(
      <CommandBrowser onSelectCommand={vi.fn()} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Issue')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('filters commands by search query', async () => {
    render(
      <CommandBrowser onSelectCommand={vi.fn()} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Issue')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search commands/i);
    fireEvent.change(searchInput, { target: { value: 'issue' } });

    await waitFor(() => {
      expect(screen.getByText('Issue')).toBeInTheDocument();
      expect(screen.queryByText('Status')).not.toBeInTheDocument();
    });
  });

  it('filters commands by category', async () => {
    render(
      <CommandBrowser onSelectCommand={vi.fn()} />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Issue')).toBeInTheDocument();
    });

    const gitTab = screen.getByText('Git');
    fireEvent.click(gitTab);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.queryByText('Issue')).not.toBeInTheDocument();
    });
  });
});

describe('ActiveCommandsPanel', () => {
  it('shows empty state when no commands enabled', () => {
    render(
      <ActiveCommandsPanel />,
      { wrapper }
    );

    expect(screen.getByText('No commands enabled')).toBeInTheDocument();
  });
});

describe('Command integration flow', () => {
  it('enables and disables commands', async () => {
    const handleToggle = vi.fn();
    const { rerender } = render(
      <CommandCard 
        command={mockCommands[0]} 
        isEnabled={false}
        onToggle={handleToggle} 
      />,
      { wrapper }
    );

    // Enable command
    fireEvent.click(screen.getByText('Enable'));
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Rerender with enabled state
    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <CommandCard 
          command={mockCommands[0]} 
          isEnabled={true}
          onToggle={handleToggle} 
        />
      </QueryClientProvider>
    );

    // Should now show Disable button
    expect(screen.getByText('Disable')).toBeInTheDocument();
  });
});
