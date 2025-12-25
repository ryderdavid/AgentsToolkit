#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# AgentsToolkit Unified Commands Build Script
# Converts Cursor-format Markdown commands to all agent formats
# ============================================================================

AGENTSMD_DIR="${AGENTSMD_HOME:-$HOME/.agentsmd}"
SRC_DIR="$AGENTSMD_DIR/commands/src"
BUILD_DIR="$AGENTSMD_DIR/build"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }
log_step()  { echo -e "${BLUE}→${NC} $1"; }

# ============================================================================
# Validation
# ============================================================================

RESERVED_COMMANDS="help clear model quit exit compact init review plan"

validate_source_dir() {
    if [ ! -d "$SRC_DIR" ]; then
        log_error "Source directory not found: $SRC_DIR"
        exit 1
    fi
    
    local count
    count=$(find "$SRC_DIR" -name '*.md' -type f | wc -l | tr -d ' ')
    if [ "$count" -eq 0 ]; then
        log_error "No .md files found in $SRC_DIR"
        exit 1
    fi
    
    log_info "Found $count source commands"
}

validate_filename() {
    local file="$1"
    local basename
    basename=$(basename "$file" .md)
    
    # Check format: lowercase, alphanumeric, hyphens only
    if [[ ! "$basename" =~ ^[a-z0-9-]+$ ]]; then
        log_error "Invalid filename: $basename (use lowercase, numbers, hyphens only)"
        return 1
    fi
    
    # Check reserved names
    for reserved in $RESERVED_COMMANDS; do
        if [ "$basename" = "$reserved" ]; then
            log_error "Reserved command name: $basename"
            return 1
        fi
    done
    
    return 0
}

validate_all() {
    log_step "Validating source commands..."
    local errors=0
    
    while IFS= read -r -d '' file; do
        validate_filename "$file" || ((errors++))
    done < <(find "$SRC_DIR" -name '*.md' -type f -print0)
    
    if [ "$errors" -gt 0 ]; then
        log_error "Validation failed with $errors errors"
        exit 1
    fi
    
    log_info "All commands validated"
}

# ============================================================================
# Conversion Functions
# ============================================================================

convert_to_cursor() {
    local src="$1"
    local rel_path="${src#$SRC_DIR/}"
    local dest="$BUILD_DIR/cursor/commands/$rel_path"
    
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
}

convert_to_claude() {
    local src="$1"
    local rel_path="${src#$SRC_DIR/}"
    local dest="$BUILD_DIR/claude/commands/$rel_path"
    local basename
    basename=$(basename "$src" .md)
    
    mkdir -p "$(dirname "$dest")"
    
    # Add frontmatter for Claude Code
    {
        echo "---"
        echo "description: AgentsToolkit $basename command"
        echo "---"
        cat "$src"
    } > "$dest"
}

convert_to_codex() {
    local src="$1"
    local rel_path="${src#$SRC_DIR/}"
    local dest="$BUILD_DIR/codex/prompts/$rel_path"
    local basename
    basename=$(basename "$src" .md)
    
    mkdir -p "$(dirname "$dest")"
    
    # Add frontmatter for Codex
    {
        echo "---"
        echo "description: AgentsToolkit $basename command"
        echo "---"
        cat "$src"
    } > "$dest"
}

convert_to_gemini() {
    local src="$1"
    local rel_path="${src#$SRC_DIR/}"
    local basename
    basename=$(basename "$rel_path" .md)
    local dest="$BUILD_DIR/gemini/commands/${rel_path%.md}.toml"
    
    mkdir -p "$(dirname "$dest")"
    
    # Convert to TOML format
    {
        echo "description = \"AgentsToolkit $basename command\""
        echo 'prompt = """'
        cat "$src"
        echo '"""'
    } > "$dest"
}

# ============================================================================
# Build
# ============================================================================

build() {
    log_step "Building commands from $SRC_DIR"
    
    # Clean previous build
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"/{cursor/commands,claude/commands,codex/prompts,gemini/commands}
    
    local count=0
    while IFS= read -r -d '' src_file; do
        local rel_path="${src_file#$SRC_DIR/}"
        log_info "Converting: $rel_path"
        
        convert_to_cursor "$src_file"
        convert_to_claude "$src_file"
        convert_to_codex "$src_file"
        convert_to_gemini "$src_file"
        
        ((count++))
    done < <(find "$SRC_DIR" -name '*.md' -type f -print0)
    
    log_info "Built $count commands for 4 agents"
}

# ============================================================================
# Installation
# ============================================================================

install_symlinks() {
    log_step "Installing symlinks to agent config directories..."
    
    # Cursor
    mkdir -p "$HOME/.cursor"
    rm -rf "$HOME/.cursor/commands"
    ln -sf "$BUILD_DIR/cursor/commands" "$HOME/.cursor/commands"
    log_info "Cursor: ~/.cursor/commands"
    
    # Claude Code
    mkdir -p "$HOME/.claude"
    rm -rf "$HOME/.claude/commands"
    ln -sf "$BUILD_DIR/claude/commands" "$HOME/.claude/commands"
    log_info "Claude Code: ~/.claude/commands"
    
    # Codex CLI
    mkdir -p "$HOME/.codex"
    rm -rf "$HOME/.codex/prompts"
    ln -sf "$BUILD_DIR/codex/prompts" "$HOME/.codex/prompts"
    log_info "Codex CLI: ~/.codex/prompts"
    
    # Gemini CLI
    mkdir -p "$HOME/.gemini"
    rm -rf "$HOME/.gemini/commands"
    ln -sf "$BUILD_DIR/gemini/commands" "$HOME/.gemini/commands"
    log_info "Gemini CLI: ~/.gemini/commands"
}

show_summary() {
    echo ""
    echo "======================================"
    echo "  Commands installed successfully!"
    echo "======================================"
    echo ""
    echo "Available commands:"
    echo ""
    echo "  Cursor:      /branch, /issue, /pr, /push, /status, ..."
    echo "  Claude Code: /branch, /issue, /pr, /push, /status, ..."
    echo "  Codex CLI:   /prompts:branch, /prompts:issue, ..."
    echo "  Gemini CLI:  /branch, /issue, /pr, /push, /status, ..."
    echo ""
    echo "Note: Codex uses /prompts: prefix for custom commands."
    echo ""
}

# ============================================================================
# CLI
# ============================================================================

usage() {
    echo "Usage: $0 {build|install|validate|clean|help}"
    echo ""
    echo "Commands:"
    echo "  build     Build commands for all agents (no install)"
    echo "  install   Build and install symlinks to agent configs"
    echo "  validate  Validate source commands only"
    echo "  clean     Remove build directory"
    echo "  help      Show this help message"
}

case "${1:-}" in
    build)
        validate_source_dir
        validate_all
        build
        ;;
    install)
        validate_source_dir
        validate_all
        build
        install_symlinks
        show_summary
        ;;
    validate)
        validate_source_dir
        validate_all
        ;;
    clean)
        rm -rf "$BUILD_DIR"
        log_info "Cleaned build directory"
        ;;
    -h|--help|"")
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac

