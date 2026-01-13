import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import { RulePacksView } from '../RulePacksView';
import { usePackStore } from '@/stores/packStore';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const basePacks = [
  {
    id: 'core',
    name: 'Core Rules',
    version: '1.0.0',
    description: 'Core rule set',
    dependencies: [] as string[],
    targetAgents: ['*'],
    files: ['core.md'],
    metadata: { wordCount: 100, characterCount: 500, category: 'universal', tags: ['core'] },
  },
  {
    id: 'github-hygiene',
    name: 'GitHub Hygiene',
    version: '1.0.0',
    description: 'GitHub workflow standards',
    dependencies: [] as string[],
    targetAgents: ['*'],
    files: ['github.md'],
    metadata: { wordCount: 150, characterCount: 800, category: 'workflow', tags: ['github'] },
  },
  {
    id: 'addon',
    name: 'Addon Pack',
    version: '1.0.0',
    description: 'Addon requiring core',
    dependencies: ['core'],
    targetAgents: ['*'],
    files: ['addon.md'],
    metadata: { wordCount: 180, characterCount: 900, category: 'workflow', tags: ['addon'] },
  },
  {
    id: 'oversized',
    name: 'Oversized Pack',
    version: '1.0.0',
    description: 'Large content pack',
    dependencies: [] as string[],
    targetAgents: ['*'],
    files: ['big.md'],
    metadata: { wordCount: 900, characterCount: 5000, category: 'workflow', tags: ['budget'] },
  },
];

const loadedPack = (packId: string) => {
  const meta = basePacks.find(p => p.id === packId)!;
  return {
    id: meta.id,
    name: meta.name,
    version: meta.version,
    description: meta.description,
    dependencies: meta.dependencies,
    targetAgents: meta.targetAgents,
    files: meta.files,
    metadata: meta.metadata,
    path: `/rule-packs/${meta.id}`,
    content: `# ${meta.name}`,
    actualWordCount: meta.metadata.wordCount,
    actualCharacterCount: meta.metadata.characterCount,
  };
};

const agentDefinition = {
  id: 'cursor',
  name: 'Cursor',
  config_paths: ['~/.config/cursor'],
  agents_md_support: 'native',
  command_format: 'slash',
  character_limits: { max_chars: 1000, supports_out_references: false },
  deployment_strategy: 'symlink',
  build_output: '',
  file_format: 'markdown',
  requires_frontmatter: false,
  sandbox_script_path: null,
  notes: null,
};

const renderView = (user = userEvent.setup()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    user,
    ...render(
      <QueryClientProvider client={client}>
        <RulePacksView />
      </QueryClientProvider>
    ),
  };
};

const budgetFor = (packIds: string[], agentId?: string | null) => {
  const ids = [...new Set(packIds)];
  const totalChars = ids.reduce((sum, id) => {
    const meta = basePacks.find(p => p.id === id);
    return sum + (meta?.metadata.characterCount ?? 0);
  }, 0);
  const maxChars = agentId ? 1000 : null;
  const percentage = maxChars ? Math.round((totalChars / maxChars) * 100) : null;
  return {
    totalChars,
    maxChars,
    percentage,
    withinLimit: maxChars ? totalChars <= maxChars : true,
    packBreakdown: ids.map(id => {
      const meta = basePacks.find(p => p.id === id)!;
      return {
        packId: id,
        chars: meta.metadata.characterCount,
        words: meta.metadata.wordCount,
        percentageOfTotal: totalChars > 0 ? Math.round((meta.metadata.characterCount / totalChars) * 100) : 0,
      };
    }),
  };
};

beforeEach(() => {
  localStorage.clear();
  usePackStore.setState({ enabledPackIds: [], selectedAgentId: 'cursor' });
  invokeMock.mockImplementation((cmd: string, args: any) => {
    switch (cmd) {
      case 'list_available_packs':
        return Promise.resolve(basePacks.map(p => ({ ...p, targetAgents: p.targetAgents, metadata: p.metadata })));
      case 'resolve_dependencies': {
        const packId = args?.packId ?? args?.pack_id;
        if (packId === 'addon') {
          return Promise.resolve({ order: ['core', 'addon'], success: true, error: null, circularPath: null });
        }
        if (packId === 'core' || packId === 'github-hygiene' || packId === 'oversized') {
          return Promise.resolve({ order: [packId], success: true, error: null, circularPath: null });
        }
        return Promise.resolve({ order: [], success: false, error: 'Unknown pack', circularPath: null });
      }
      case 'load_pack_full': {
        const packId = args?.packId ?? args?.pack_id;
        return Promise.resolve(loadedPack(packId));
      }
      case 'load_pack_file': {
        const packId = args?.packId ?? args?.pack_id;
        const file = args?.file;
        return Promise.resolve(`# ${packId}/${file}`);
      }
      case 'get_all_agents':
        return Promise.resolve([agentDefinition]);
      case 'calculate_budget': {
        const packIds = args?.packIds ?? args?.pack_ids ?? [];
        const agentId = args?.agentId ?? args?.agent_id ?? null;
        const budget = budgetFor(packIds, agentId);
        // Convert to camelCase keys expected by front end
        return Promise.resolve({
          totalChars: budget.totalChars,
          maxChars: budget.maxChars,
          percentage: budget.percentage,
          withinLimit: budget.withinLimit,
          packBreakdown: budget.packBreakdown,
        });
      }
      case 'validate_composition': {
        const packIds: string[] = args?.packIds ?? args?.pack_ids ?? [];
        if (packIds.includes('oversized')) {
          return Promise.resolve({
            valid: false,
            errors: ['Composition exceeds cursor character limit'],
            warnings: [],
          });
        }
        return Promise.resolve({ valid: true, errors: [], warnings: [] });
      }
      case 'generate_agents_md':
        return Promise.resolve({
          success: true,
          content: '# Generated',
          error: null,
          budget: {
            totalChars: 0,
            maxChars: null,
            percentage: null,
            withinLimit: true,
            packBreakdown: [],
          },
        });
      default:
        return Promise.resolve(null);
    }
  });
});

afterEach(() => {
  invokeMock.mockReset();
});

describe('RulePacksView', () => {
  it('enables a pack with dependencies and allows disabling it', async () => {
    const { user } = renderView();

    await waitFor(() => {
      expect(screen.getByText('Addon Pack')).toBeInTheDocument();
    });

    const addonCard =
      screen.getByText('Addon Pack').closest('div.border') ??
      screen.getByText('Addon Pack').parentElement?.closest('div.border');
    expect(addonCard).toBeTruthy();
    const enableButton = addonCard ? within(addonCard).getByRole('button', { name: /enable/i }) : null;
    if (!enableButton) throw new Error('Enable button not found');

    await user.click(enableButton);

    await waitFor(() => {
      expect(screen.getByText(/Resolve dependencies/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Enable All/i }));

    await waitFor(() => {
      expect(usePackStore.getState().enabledPackIds).toContain('addon');
      expect(usePackStore.getState().enabledPackIds).toContain('core');
    });

    const disableButton = addonCard ? within(addonCard).getByRole('button', { name: /Disable/i }) : null;
    if (!disableButton) throw new Error('Disable button not found');
    await user.click(disableButton);

    await waitFor(() => {
      expect(usePackStore.getState().enabledPackIds).not.toContain('addon');
    });
  });

  it('shows validation alerts when budget validation fails', async () => {
    usePackStore.setState({ enabledPackIds: ['oversized'], selectedAgentId: 'cursor' });
    renderView();

    await waitFor(() => {
      const errors = screen.getAllByText(/Validation error/i);
      expect(errors.length).toBeGreaterThan(0);
      const messages = screen.getAllByText(/exceeds cursor character limit/i);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  it('loads presets and updates the enabled pack list', async () => {
    const { user } = renderView();

    const presetSelect =
      (await screen.findAllByRole('combobox')).find(select =>
        within(select).queryByText('Load Preset')
      ) ?? (await screen.findAllByRole('combobox'))[0];
    await user.selectOptions(presetSelect, 'GitHub Standard');

    await waitFor(() => {
      const enabled = usePackStore.getState().enabledPackIds;
      expect(enabled).toContain('core');
      expect(enabled).toContain('github-hygiene');
    });

    await waitFor(() => {
      expect(screen.getByText(/2 pack\(s\) enabled/i)).toBeInTheDocument();
    });
  });

  it('filters packs based on search input', async () => {
    const user = userEvent.setup();
    renderView(user);

    await waitFor(() => {
      expect(screen.getByText('Addon Pack')).toBeInTheDocument();
      expect(screen.getByText('Core Rules')).toBeInTheDocument();
    });

    const search = await screen.findByPlaceholderText(/Search by name/i);
    await user.type(search, 'addon');
    await new Promise(res => setTimeout(res, 400));

    await waitFor(() => {
      expect(screen.getByText('Addon Pack')).toBeInTheDocument();
      expect(screen.queryByText('Core Rules')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
