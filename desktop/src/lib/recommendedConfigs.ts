import type { CompositionConfig } from '@core/pack-composer-types';

const recommendedConfigs: CompositionConfig[] = [
  {
    packs: ['core', 'github-hygiene'],
    header: 'Standard GitHub workflow configuration',
  },
  {
    packs: ['core', 'azure-devops'],
    header: 'Azure DevOps workflow configuration',
  },
  {
    packs: ['core'],
    header: 'Minimal VCS-agnostic configuration',
  },
];

export function getRecommendedConfigs(): CompositionConfig[] {
  return recommendedConfigs;
}
