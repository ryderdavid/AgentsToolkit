"""
Python bridge for the TypeScript agent registry.

Executes the compiled registry to retrieve validated agent definitions for use
in Python tooling (e.g., build_commands.py).

Falls back to bundled JSON if the compiled registry is not available.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
DIST_REGISTRY = REPO_ROOT / "dist" / "core" / "agent-registry.js"
BUNDLED_REGISTRY = REPO_ROOT / "dist" / "core" / "agent-registry.bundled.json"


class AgentRegistryError(RuntimeError):
    """Custom error for registry failures."""


def _load_bundled_registry() -> List[Dict[str, Any]]:
    """Load agent registry from bundled JSON file.
    
    This fallback is used when:
    - The compiled TypeScript registry doesn't exist (fresh install)
    - Node.js is not available on the system
    - The TypeScript build failed
    """
    if not BUNDLED_REGISTRY.exists():
        raise AgentRegistryError(
            f"Neither compiled registry ({DIST_REGISTRY}) nor bundled registry "
            f"({BUNDLED_REGISTRY}) found. Run `npm run build` or ensure the "
            "bundled registry is present."
        )
    
    try:
        with open(BUNDLED_REGISTRY, 'r', encoding='utf-8') as f:
            parsed = json.load(f)
    except json.JSONDecodeError as exc:
        raise AgentRegistryError(
            f"Bundled registry is not valid JSON: {exc}"
        ) from exc
    
    if not isinstance(parsed, list):
        raise AgentRegistryError("Bundled registry is not a list of agents.")
    
    return parsed


def _run_node_export() -> str:
    """Run the compiled registry with --export-json and return stdout."""
    if not DIST_REGISTRY.exists():
        raise AgentRegistryError(
            f"Compiled registry not found at {DIST_REGISTRY}. "
            "Run `npm run build` first."
        )

    try:
        result = subprocess.run(
            ["node", str(DIST_REGISTRY), "--export-json"],
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_ROOT,
            env=os.environ.copy(),
        )
        return result.stdout
    except FileNotFoundError as exc:
        raise AgentRegistryError("Node is not available on PATH.") from exc
    except subprocess.CalledProcessError as exc:
        raise AgentRegistryError(
            f"Failed to execute registry: {exc.stderr or exc.stdout}"
        ) from exc


def load_agent_registry() -> List[Dict[str, Any]]:
    """Load all agent definitions from the registry.
    
    Tries the compiled TypeScript registry first, falls back to bundled JSON
    if the dist is not available or Node.js is not installed.
    """
    # Try compiled registry first
    if DIST_REGISTRY.exists():
        try:
            raw = _run_node_export()
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except AgentRegistryError:
            # Fall through to bundled fallback
            pass
        except json.JSONDecodeError:
            # Fall through to bundled fallback
            pass
    
    # Fall back to bundled registry
    return _load_bundled_registry()


def get_agent_config(agent_id: str) -> Optional[Dict[str, Any]]:
    """Return a single agent definition or None if missing."""
    for agent in load_agent_registry():
        if agent.get("id") == agent_id:
            return agent
    return None


def validate_agent_support(agent_id: str) -> None:
    """Raise if the agent is unknown."""
    if not get_agent_config(agent_id):
        raise AgentRegistryError(f"Unsupported agent: {agent_id}")
