# ============================================================================
# AgentsToolkit Unified Commands Build Script (PowerShell)
# Converts Cursor-format Markdown commands to all agent formats
# ============================================================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"

# Set up paths
$AGENTSMD_DIR = if ($env:AGENTSMD_HOME) { $env:AGENTSMD_HOME } else { "$env:USERPROFILE\.agentsmd" }
$SRC_DIR = Join-Path $AGENTSMD_DIR "commands\src"
$BUILD_DIR = Join-Path $AGENTSMD_DIR "build"

# Colors
function Write-Info { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Warn { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red | Out-String | Write-Host }
function Write-Step { Write-Host "→ $args" -ForegroundColor Blue }

# ============================================================================
# Validation
# ============================================================================

$RESERVED_COMMANDS = @("help", "clear", "model", "quit", "exit", "compact", "init", "review", "plan")

function Test-SourceDir {
    if (-not (Test-Path $SRC_DIR)) {
        Write-Error "Source directory not found: $SRC_DIR"
        exit 1
    }
    
    $files = Get-ChildItem -Path $SRC_DIR -Filter "*.md" -File
    if ($files.Count -eq 0) {
        Write-Error "No .md files found in $SRC_DIR"
        exit 1
    }
    
    Write-Info "Found $($files.Count) source commands"
}

function Test-Filename {
    param([string]$FilePath)
    
    $basename = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)
    
    # Check format: lowercase, alphanumeric, hyphens only
    if ($basename -notmatch '^[a-z0-9-]+$') {
        Write-Error "Invalid filename: $basename (use lowercase, numbers, hyphens only)"
        return $false
    }
    
    # Check reserved names
    if ($RESERVED_COMMANDS -contains $basename) {
        Write-Error "Reserved command name: $basename"
        return $false
    }
    
    return $true
}

function Test-All {
    Write-Step "Validating source commands..."
    $errors = 0
    
    Get-ChildItem -Path $SRC_DIR -Filter "*.md" -File | ForEach-Object {
        if (-not (Test-Filename $_.FullName)) {
            $errors++
        }
    }
    
    if ($errors -gt 0) {
        Write-Error "Validation failed with $errors errors"
        exit 1
    }
    
    Write-Info "All commands validated"
}

# ============================================================================
# Conversion Functions
# ============================================================================

function Convert-ToCursor {
    param([string]$SrcFile)
    
    $relPath = $SrcFile.Substring($SRC_DIR.Length + 1)
    $dest = Join-Path $BUILD_DIR "cursor\commands\$relPath"
    $destDir = Split-Path $dest -Parent
    
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item -Path $SrcFile -Destination $dest -Force
}

function Convert-ToClaude {
    param([string]$SrcFile)
    
    $relPath = $SrcFile.Substring($SRC_DIR.Length + 1)
    $dest = Join-Path $BUILD_DIR "claude\commands\$relPath"
    $destDir = Split-Path $dest -Parent
    $basename = [System.IO.Path]::GetFileNameWithoutExtension($SrcFile)
    
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    
    $content = @"
---
description: AgentsToolkit $basename command
---
"@
    $content += "`n" + (Get-Content -Path $SrcFile -Raw)
    Set-Content -Path $dest -Value $content -NoNewline
}

function Convert-ToCodex {
    param([string]$SrcFile)
    
    $relPath = $SrcFile.Substring($SRC_DIR.Length + 1)
    $dest = Join-Path $BUILD_DIR "codex\prompts\$relPath"
    $destDir = Split-Path $dest -Parent
    $basename = [System.IO.Path]::GetFileNameWithoutExtension($SrcFile)
    
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    
    $content = @"
---
description: AgentsToolkit $basename command
---
"@
    $content += "`n" + (Get-Content -Path $SrcFile -Raw)
    Set-Content -Path $dest -Value $content -NoNewline
}

function Convert-ToGemini {
    param([string]$SrcFile)
    
    $relPath = $SrcFile.Substring($SRC_DIR.Length + 1)
    $basename = [System.IO.Path]::GetFileNameWithoutExtension($relPath)
    $dest = Join-Path $BUILD_DIR "gemini\commands\$($relPath -replace '\.md$', '.toml')"
    $destDir = Split-Path $dest -Parent
    
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    
    $content = @"
description = "AgentsToolkit $basename command"
prompt = """
"@
    $content += (Get-Content -Path $SrcFile -Raw)
    $content += '"""'
    Set-Content -Path $dest -Value $content -NoNewline
}

# ============================================================================
# Build
# ============================================================================

function Build-Commands {
    Write-Step "Building commands from $SRC_DIR"
    
    # Clean previous build
    if (Test-Path $BUILD_DIR) {
        Remove-Item -Path $BUILD_DIR -Recurse -Force
    }
    
    $dirs = @(
        "cursor\commands",
        "claude\commands",
        "codex\prompts",
        "gemini\commands"
    )
    
    foreach ($dir in $dirs) {
        New-Item -ItemType Directory -Force -Path (Join-Path $BUILD_DIR $dir) | Out-Null
    }
    
    $count = 0
    Get-ChildItem -Path $SRC_DIR -Filter "*.md" -File | ForEach-Object {
        $relPath = $_.Name
        Write-Info "Converting: $relPath"
        
        Convert-ToCursor $_.FullName
        Convert-ToClaude $_.FullName
        Convert-ToCodex $_.FullName
        Convert-ToGemini $_.FullName
        
        $count++
    }
    
    Write-Info "Built $count commands for 4 agents"
}

# ============================================================================
# Installation
# ============================================================================

function Install-Symlinks {
    Write-Step "Installing symlinks to agent config directories..."
    
    $targets = @{
        "Cursor" = @{
            "link" = "$env:USERPROFILE\.cursor\commands"
            "target" = "$BUILD_DIR\cursor\commands"
        }
        "Claude Code" = @{
            "link" = "$env:USERPROFILE\.claude\commands"
            "target" = "$BUILD_DIR\claude\commands"
        }
        "Codex CLI" = @{
            "link" = "$env:USERPROFILE\.codex\prompts"
            "target" = "$BUILD_DIR\codex\prompts"
        }
        "Gemini CLI" = @{
            "link" = "$env:USERPROFILE\.gemini\commands"
            "target" = "$BUILD_DIR\gemini\commands"
        }
    }
    
    foreach ($agentName in $targets.Keys) {
        $link = $targets[$agentName].link
        $target = $targets[$agentName].target
        $linkDir = Split-Path $link -Parent
        
        # Ensure parent directory exists
        if (-not (Test-Path $linkDir)) {
            New-Item -ItemType Directory -Force -Path $linkDir | Out-Null
        }
        
        # Remove existing link/directory
        if (Test-Path $link) {
            try {
                $item = Get-Item $link -ErrorAction Stop
                if ($item.LinkType -eq "SymbolicLink") {
                    Remove-Item -Path $link -Force
                } else {
                    Remove-Item -Path $link -Recurse -Force
                }
            } catch {
                # If we can't determine the type, try to remove it anyway
                Remove-Item -Path $link -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        
        # Create symlink
        try {
            New-Item -ItemType SymbolicLink -Path $link -Target $target -Force | Out-Null
            $displayName = $link -replace [regex]::Escape($env:USERPROFILE), "~"
            Write-Info "$agentName: $displayName"
        } catch {
            Write-Warn "Could not create symlink: $link"
        }
    }
}

function Show-Summary {
    Write-Host ""
    Write-Host "======================================"
    Write-Host "  Commands installed successfully!"
    Write-Host "======================================"
    Write-Host ""
    Write-Host "Available commands:"
    Write-Host ""
    Write-Host "  Cursor:      /branch, /issue, /pr, /push, /status, ..."
    Write-Host "  Claude Code: /branch, /issue, /pr, /push, /status, ..."
    Write-Host "  Codex CLI:   /prompts:branch, /prompts:issue, ..."
    Write-Host "  Gemini CLI:  /branch, /issue, /pr, /push, /status, ..."
    Write-Host ""
    Write-Host "Note: Codex uses /prompts: prefix for custom commands."
    Write-Host ""
}

# ============================================================================
# CLI
# ============================================================================

function Show-Usage {
    Write-Host "Usage: $($MyInvocation.ScriptName) {build|install|validate|clean|help}"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build     Build commands for all agents (no install)"
    Write-Host "  install   Build and install symlinks to agent configs"
    Write-Host "  validate  Validate source commands only"
    Write-Host "  clean     Remove build directory"
    Write-Host "  help      Show this help message"
}

# Main execution
switch ($Command.ToLower()) {
    "build" {
        Test-SourceDir
        Test-All
        Build-Commands
    }
    "install" {
        Test-SourceDir
        Test-All
        Build-Commands
        Install-Symlinks
        Show-Summary
    }
    "validate" {
        Test-SourceDir
        Test-All
    }
    "clean" {
        if (Test-Path $BUILD_DIR) {
            Remove-Item -Path $BUILD_DIR -Recurse -Force
            Write-Info "Cleaned build directory"
        } else {
            Write-Info "Build directory does not exist"
        }
    }
    { $_ -in @("help", "-h", "--help", "") } {
        Show-Usage
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Usage
        exit 1
    }
}

