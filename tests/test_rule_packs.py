#!/usr/bin/env python3
"""Tests for the rule pack system.

Run with: python3 tests/test_rule_packs.py
"""

import json
import os
import sys
import unittest
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

PACKS_DIR = PROJECT_ROOT / 'rule-packs'
SCHEMA_PATH = PROJECT_ROOT / 'schemas' / 'rule-pack.schema.json'


class TestRulePackSchema(unittest.TestCase):
    """Test pack.json schema validation."""

    def test_schema_exists(self):
        """Schema file should exist."""
        self.assertTrue(SCHEMA_PATH.exists(), f"Schema not found at {SCHEMA_PATH}")

    def test_schema_valid_json(self):
        """Schema should be valid JSON."""
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        self.assertIn('$schema', schema)
        self.assertIn('properties', schema)

    def test_schema_required_fields(self):
        """Schema should define required fields."""
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        required = schema.get('required', [])
        expected = ['id', 'name', 'version', 'description', 'files', 'metadata']
        for field in expected:
            self.assertIn(field, required, f"Missing required field: {field}")


class TestCorePack(unittest.TestCase):
    """Test the core rule pack."""

    def setUp(self):
        self.pack_dir = PACKS_DIR / 'core'
        self.pack_json = self.pack_dir / 'pack.json'

    def test_pack_exists(self):
        """Core pack should exist."""
        self.assertTrue(self.pack_dir.exists())
        self.assertTrue(self.pack_json.exists())

    def test_pack_json_valid(self):
        """pack.json should be valid JSON."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertEqual(pack['id'], 'core')
        self.assertEqual(pack['metadata']['category'], 'universal')

    def test_all_files_exist(self):
        """All referenced files should exist."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        for file in pack['files']:
            file_path = self.pack_dir / file
            self.assertTrue(file_path.exists(), f"Missing file: {file}")

    def test_no_dependencies(self):
        """Core pack should have no dependencies."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertEqual(pack['dependencies'], [])

    def test_targets_all_agents(self):
        """Core pack should target all agents."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertEqual(pack['targetAgents'], ['*'])


class TestGitHubHygienePack(unittest.TestCase):
    """Test the GitHub hygiene rule pack."""

    def setUp(self):
        self.pack_dir = PACKS_DIR / 'github-hygiene'
        self.pack_json = self.pack_dir / 'pack.json'

    def test_pack_exists(self):
        """GitHub hygiene pack should exist."""
        self.assertTrue(self.pack_dir.exists())
        self.assertTrue(self.pack_json.exists())

    def test_pack_json_valid(self):
        """pack.json should be valid JSON."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertEqual(pack['id'], 'github-hygiene')
        self.assertEqual(pack['metadata']['category'], 'vcs')

    def test_all_files_exist(self):
        """All referenced files should exist."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        for file in pack['files']:
            file_path = self.pack_dir / file
            self.assertTrue(file_path.exists(), f"Missing file: {file}")

    def test_depends_on_core(self):
        """GitHub hygiene pack should depend on core."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertIn('core', pack['dependencies'])

    def test_has_github_tag(self):
        """GitHub hygiene pack should have github tag."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertIn('github', pack['metadata']['tags'])


class TestAzureDevOpsPack(unittest.TestCase):
    """Test the Azure DevOps rule pack."""

    def setUp(self):
        self.pack_dir = PACKS_DIR / 'azure-devops'
        self.pack_json = self.pack_dir / 'pack.json'

    def test_pack_exists(self):
        """Azure DevOps pack should exist."""
        self.assertTrue(self.pack_dir.exists())
        self.assertTrue(self.pack_json.exists())

    def test_pack_json_valid(self):
        """pack.json should be valid JSON."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertEqual(pack['id'], 'azure-devops')
        self.assertEqual(pack['metadata']['category'], 'vcs')

    def test_all_files_exist(self):
        """All referenced files should exist."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        for file in pack['files']:
            file_path = self.pack_dir / file
            self.assertTrue(file_path.exists(), f"Missing file: {file}")

    def test_depends_on_core(self):
        """Azure DevOps pack should depend on core."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertIn('core', pack['dependencies'])

    def test_has_azure_devops_tag(self):
        """Azure DevOps pack should have azure-devops tag."""
        with open(self.pack_json, 'r') as f:
            pack = json.load(f)
        self.assertIn('azure-devops', pack['metadata']['tags'])


class TestDependencyResolution(unittest.TestCase):
    """Test dependency resolution logic."""

    def test_no_circular_dependencies(self):
        """Packs should have no circular dependencies."""
        if not PACKS_DIR.exists():
            self.skipTest("Packs directory not found")

        for pack_dir in PACKS_DIR.iterdir():
            if not pack_dir.is_dir():
                continue
            pack_json = pack_dir / 'pack.json'
            if not pack_json.exists():
                continue

            with open(pack_json, 'r') as f:
                pack = json.load(f)

            # Check each dependency exists and doesn't create a cycle
            visited = set()
            self._check_no_cycle(pack['id'], visited)

    def _check_no_cycle(self, pack_id: str, visited: set, path: list = None):
        """Recursively check for cycles."""
        if path is None:
            path = []

        if pack_id in visited:
            self.fail(f"Circular dependency detected: {' -> '.join(path + [pack_id])}")

        visited.add(pack_id)
        path.append(pack_id)

        pack_json = PACKS_DIR / pack_id / 'pack.json'
        if pack_json.exists():
            with open(pack_json, 'r') as f:
                pack = json.load(f)
            for dep_id in pack.get('dependencies', []):
                self._check_no_cycle(dep_id, visited.copy(), path.copy())


class TestPackContent(unittest.TestCase):
    """Test pack content quality."""

    def test_core_has_prime_directives(self):
        """Core pack should have prime directives."""
        prime_directives = PACKS_DIR / 'core' / 'prime-directives.md'
        self.assertTrue(prime_directives.exists())
        content = prime_directives.read_text()
        self.assertIn('NEVER', content)  # Prime directives use strong language

    def test_github_has_issue_first(self):
        """GitHub hygiene pack should have issue-first rules."""
        issue_first = PACKS_DIR / 'github-hygiene' / 'issue-first.md'
        self.assertTrue(issue_first.exists())
        content = issue_first.read_text()
        self.assertIn('issue', content.lower())

    def test_azure_has_work_item_first(self):
        """Azure DevOps pack should have work-item-first rules."""
        work_item_first = PACKS_DIR / 'azure-devops' / 'work-item-first.md'
        self.assertTrue(work_item_first.exists())
        content = work_item_first.read_text()
        self.assertIn('work item', content.lower())


class TestCharacterCounts(unittest.TestCase):
    """Test character count accuracy."""

    def _get_actual_counts(self, pack_dir: Path) -> tuple:
        """Get actual word and character counts for a pack."""
        pack_json = pack_dir / 'pack.json'
        with open(pack_json, 'r') as f:
            pack = json.load(f)

        total_chars = 0
        total_words = 0

        for file in pack['files']:
            file_path = pack_dir / file
            if file_path.exists():
                content = file_path.read_text()
                total_chars += len(content)
                total_words += len(content.split())

        return total_words, total_chars

    def test_core_counts_reasonable(self):
        """Core pack counts should be within 50% of declared."""
        pack_dir = PACKS_DIR / 'core'
        with open(pack_dir / 'pack.json', 'r') as f:
            pack = json.load(f)

        actual_words, actual_chars = self._get_actual_counts(pack_dir)
        declared_words = pack['metadata']['wordCount']
        declared_chars = pack['metadata']['characterCount']

        # Allow 50% variance
        self.assertLess(abs(actual_words - declared_words), declared_words * 0.5,
                        f"Word count off: actual={actual_words}, declared={declared_words}")
        self.assertLess(abs(actual_chars - declared_chars), declared_chars * 0.5,
                        f"Char count off: actual={actual_chars}, declared={declared_chars}")


class TestSchemaValidation(unittest.TestCase):
    """Test that pack.json files are validated against the JSON schema."""

    def setUp(self):
        """Set up test fixtures."""
        self.invalid_pack_dir = PACKS_DIR / 'test-invalid-schema'
        self._cleanup()

    def tearDown(self):
        """Clean up test fixtures."""
        self._cleanup()

    def _cleanup(self):
        """Remove test pack directory if it exists."""
        import shutil
        if self.invalid_pack_dir.exists():
            shutil.rmtree(self.invalid_pack_dir)

    def _create_invalid_pack(self, pack_data: dict):
        """Create a pack with the given data for testing."""
        self.invalid_pack_dir.mkdir(parents=True, exist_ok=True)
        pack_json = self.invalid_pack_dir / 'pack.json'
        with open(pack_json, 'w') as f:
            json.dump(pack_data, f, indent=2)

    def test_schema_rejects_invalid_id_format(self):
        """Schema should reject IDs that aren't lowercase kebab-case."""
        # This test verifies that the schema pattern ^[a-z][a-z0-9-]*$ is enforced
        invalid_pack = {
            'id': 'UPPERCASE_ID',  # Invalid: uppercase
            'name': 'Test Pack',
            'version': '1.0.0',
            'description': 'Test',
            'dependencies': [],
            'targetAgents': ['*'],
            'files': ['test.md'],
            'metadata': {
                'wordCount': 100,
                'characterCount': 500,
                'category': 'universal',
                'tags': []
            }
        }
        self._create_invalid_pack(invalid_pack)
        
        # The pack should fail validation due to invalid ID format
        # This test documents the expected behavior - actual validation
        # happens in TypeScript via AJV
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        
        id_pattern = schema['properties']['id']['pattern']
        import re
        self.assertIsNone(
            re.match(id_pattern, invalid_pack['id']),
            f"ID '{invalid_pack['id']}' should not match pattern '{id_pattern}'"
        )

    def test_schema_rejects_invalid_version_format(self):
        """Schema should reject versions that aren't semver."""
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        
        version_pattern = schema['properties']['version']['pattern']
        import re
        
        # Valid versions
        self.assertIsNotNone(re.match(version_pattern, '1.0.0'))
        self.assertIsNotNone(re.match(version_pattern, '2.1.0-beta'))
        
        # Invalid versions
        self.assertIsNone(re.match(version_pattern, 'not-semver'))
        self.assertIsNone(re.match(version_pattern, '1.0'))
        self.assertIsNone(re.match(version_pattern, 'v1.0.0'))

    def test_schema_requires_metadata_category(self):
        """Schema should require category in metadata."""
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        
        metadata_required = schema['properties']['metadata']['required']
        self.assertIn('category', metadata_required)

    def test_schema_requires_files_non_empty(self):
        """Schema should require at least one file."""
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        
        files_min_items = schema['properties']['files'].get('minItems', 0)
        self.assertEqual(files_min_items, 1, "Schema should require minItems: 1 for files")

    def test_valid_packs_match_schema_patterns(self):
        """All existing packs should have valid IDs and versions."""
        import re
        
        with open(SCHEMA_PATH, 'r') as f:
            schema = json.load(f)
        
        id_pattern = schema['properties']['id']['pattern']
        version_pattern = schema['properties']['version']['pattern']
        
        for pack_dir in PACKS_DIR.iterdir():
            if not pack_dir.is_dir():
                continue
            pack_json = pack_dir / 'pack.json'
            if not pack_json.exists():
                continue
            
            with open(pack_json, 'r') as f:
                pack = json.load(f)
            
            self.assertIsNotNone(
                re.match(id_pattern, pack['id']),
                f"Pack {pack['id']} has invalid ID format"
            )
            self.assertIsNotNone(
                re.match(version_pattern, pack['version']),
                f"Pack {pack['id']} has invalid version format: {pack['version']}"
            )


if __name__ == '__main__':
    unittest.main(verbosity=2)
