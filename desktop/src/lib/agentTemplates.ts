// Agent configuration templates for common use cases

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  packIds: string[];
  recommendedFor: string[];
  characterEstimate: number; // Approximate character count
}

/**
 * Predefined configuration templates
 */
export const configurationTemplates: ConfigurationTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Core workflow standards only. Lightweight configuration for basic agent rules.',
    packIds: ['core'],
    recommendedFor: ['Small projects', 'Quick setup', 'Testing'],
    characterEstimate: 2800,
  },
  {
    id: 'github-developer',
    name: 'GitHub Developer',
    description: 'Core standards plus GitHub workflow hygiene. Perfect for GitHub-hosted projects.',
    packIds: ['core', 'github-hygiene'],
    recommendedFor: ['GitHub projects', 'Open source', 'Team collaboration'],
    characterEstimate: 7000,
  },
  {
    id: 'azure-developer',
    name: 'Azure Developer',
    description: 'Core standards plus Azure DevOps workflow. Ideal for Azure DevOps pipelines.',
    packIds: ['core', 'azure-devops'],
    recommendedFor: ['Azure DevOps', 'Enterprise projects', 'Microsoft ecosystem'],
    characterEstimate: 6400,
  },
  {
    id: 'full-stack',
    name: 'Full Stack',
    description: 'All available rule packs enabled. Maximum coverage for comprehensive workflows.',
    packIds: ['core', 'github-hygiene', 'azure-devops'],
    recommendedFor: ['Multi-platform projects', 'Complex workflows', 'Maximum coverage'],
    characterEstimate: 10600,
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): ConfigurationTemplate | undefined {
  return configurationTemplates.find(t => t.id === templateId);
}

/**
 * Get all available templates
 */
export function getAllTemplates(): ConfigurationTemplate[] {
  return configurationTemplates;
}

/**
 * Get templates that fit within a character budget
 */
export function getTemplatesWithinBudget(maxChars: number): ConfigurationTemplate[] {
  return configurationTemplates.filter(t => t.characterEstimate <= maxChars);
}

/**
 * Get recommended template for an agent based on character limit
 */
export function getRecommendedTemplate(
  maxChars: number | undefined,
  preferGitHub: boolean = true
): ConfigurationTemplate {
  if (!maxChars) {
    // No limit, recommend full stack
    return configurationTemplates.find(t => t.id === 'full-stack')!;
  }

  // Filter templates that fit
  const fitting = getTemplatesWithinBudget(maxChars);
  
  if (fitting.length === 0) {
    return configurationTemplates.find(t => t.id === 'minimal')!;
  }

  // Prefer GitHub or Azure based on flag
  const preferred = preferGitHub ? 'github-developer' : 'azure-developer';
  const preferredTemplate = fitting.find(t => t.id === preferred);
  
  if (preferredTemplate) {
    return preferredTemplate;
  }

  // Return the largest fitting template
  return fitting.sort((a, b) => b.characterEstimate - a.characterEstimate)[0];
}

/**
 * Apply a template to get pack IDs
 */
export function applyTemplate(templateId: string): string[] {
  const template = getTemplate(templateId);
  return template?.packIds ?? ['core'];
}

/**
 * Custom template storage key
 */
const CUSTOM_TEMPLATES_KEY = 'agents-toolkit-custom-templates';

/**
 * Save a custom template to local storage
 */
export function saveCustomTemplate(template: ConfigurationTemplate): void {
  const existing = getCustomTemplates();
  const updated = existing.filter(t => t.id !== template.id);
  updated.push(template);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
}

/**
 * Get custom templates from local storage
 */
export function getCustomTemplates(): ConfigurationTemplate[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a custom template
 */
export function deleteCustomTemplate(templateId: string): void {
  const existing = getCustomTemplates();
  const updated = existing.filter(t => t.id !== templateId);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated));
}

/**
 * Get all templates including custom ones
 */
export function getAllTemplatesWithCustom(): ConfigurationTemplate[] {
  return [...configurationTemplates, ...getCustomTemplates()];
}
