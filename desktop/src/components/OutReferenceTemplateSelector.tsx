import { FileText, Check } from 'lucide-react';
import { useState } from 'react';
import type { OutReferenceCategory, FileFormat } from '@/lib/types';

interface Template {
  id: string;
  name: string;
  description: string;
  category: OutReferenceCategory;
  format: FileFormat;
  content: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'pr-template',
    name: 'Pull Request Template',
    description: 'Standard PR template with checklist',
    category: 'templates',
    format: 'markdown',
    content: `## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
<!-- List the specific changes -->
- 

## Testing
- [ ] Tests pass locally
- [ ] New tests added for changes
- [ ] Manual testing completed

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
`,
  },
  {
    id: 'issue-template',
    name: 'Issue Template',
    description: 'Standard issue template for bug reports',
    category: 'templates',
    format: 'markdown',
    content: `## Summary
<!-- One-liner explaining the issue -->

## Context
<!-- Background information and why this matters -->

## Expected Behavior
<!-- What should happen -->

## Actual Behavior
<!-- What actually happens -->

## Steps to Reproduce
1. 
2. 
3. 

## Environment
- OS: 
- Version: 
- Browser (if applicable): 

## Additional Context
<!-- Screenshots, logs, or other relevant information -->
`,
  },
  {
    id: 'commit-guide',
    name: 'Commit Message Guide',
    description: 'Guidelines for writing commit messages',
    category: 'templates',
    format: 'markdown',
    content: `# Commit Message Guidelines

## Format
\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Formatting, missing semicolons, etc.
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests
- **chore**: Maintenance tasks

## Rules
1. Use imperative mood ("add" not "added")
2. Don't capitalize the first letter
3. No period at the end of subject line
4. Limit subject line to 50 characters
5. Wrap body at 72 characters

## Examples
\`\`\`
feat(auth): add OAuth2 support

Implement OAuth2 authentication flow with Google and GitHub providers.

Closes #123
\`\`\`
`,
  },
  {
    id: 'code-review-checklist',
    name: 'Code Review Checklist',
    description: 'Checklist for reviewing pull requests',
    category: 'templates',
    format: 'markdown',
    content: `# Code Review Checklist

## General
- [ ] Code is readable and well-organized
- [ ] No unnecessary complexity
- [ ] DRY principle followed
- [ ] SOLID principles considered

## Functionality
- [ ] Code does what it's supposed to do
- [ ] Edge cases handled
- [ ] Error handling is appropriate
- [ ] No security vulnerabilities

## Style
- [ ] Consistent with project conventions
- [ ] Meaningful variable/function names
- [ ] Comments where necessary
- [ ] No commented-out code

## Testing
- [ ] Adequate test coverage
- [ ] Tests are meaningful
- [ ] Edge cases tested

## Documentation
- [ ] README updated if needed
- [ ] API docs updated
- [ ] Inline comments for complex logic
`,
  },
  {
    id: 'json-schema-example',
    name: 'JSON Schema Example',
    description: 'Basic JSON Schema template',
    category: 'schemas',
    format: 'json',
    content: `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schema.json",
  "title": "Schema Title",
  "description": "Description of what this schema validates",
  "type": "object",
  "required": ["id", "name"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier"
    },
    "name": {
      "type": "string",
      "description": "Display name",
      "minLength": 1,
      "maxLength": 100
    },
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "uniqueItems": true
    }
  },
  "additionalProperties": false
}
`,
  },
  {
    id: 'typescript-example',
    name: 'TypeScript Code Example',
    description: 'Example TypeScript code snippet',
    category: 'examples',
    format: 'markdown',
    content: `# TypeScript Example

## Usage

\`\`\`typescript
import { createClient } from './client';

const client = createClient({
  baseUrl: 'https://api.example.com',
  timeout: 5000,
});

async function fetchData() {
  try {
    const data = await client.get('/users');
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| baseUrl | string | - | Base URL for API |
| timeout | number | 10000 | Request timeout in ms |
| retries | number | 3 | Number of retry attempts |
`,
  },
];

interface OutReferenceTemplateSelectorProps {
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export function OutReferenceTemplateSelector({
  onSelect,
  onCancel,
}: OutReferenceTemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTemplate = DEFAULT_TEMPLATES.find(t => t.id === selectedId);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Choose a Template</h2>
          <p className="text-sm text-slate-600 mt-1">
            Start with a pre-built template to save time
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedId(template.id)}
                className={`text-left p-4 border rounded-lg transition-all ${
                  selectedId === template.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <FileText
                    className={selectedId === template.id ? 'text-blue-500' : 'text-slate-400'}
                    size={20}
                  />
                  {selectedId === template.id && (
                    <Check className="text-blue-500" size={20} />
                  )}
                </div>
                <h3 className="font-medium mt-2">{template.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 text-xs bg-slate-100 rounded">
                    {template.category}
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-slate-100 rounded">
                    {template.format}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <button
            onClick={() => onSelect({ 
              id: '', 
              name: '', 
              description: '', 
              category: 'templates', 
              format: 'markdown', 
              content: '' 
            })}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Start from scratch
          </button>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedTemplate && onSelect(selectedTemplate)}
              disabled={!selectedTemplate}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
