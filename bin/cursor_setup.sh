#!/bin/bash
# AgentsToolkit - Cursor Setup Helper
# Copies the User Rule to clipboard and optionally opens Cursor settings

RULE_TEXT="Always read and follow ~/.agentsmd/AGENTS.md"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                     CURSOR SETUP                                     ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Detect OS and copy to clipboard
copy_to_clipboard() {
    case "$(uname -s)" in
        Darwin)
            echo -n "$RULE_TEXT" | pbcopy
            return 0
            ;;
        Linux)
            if command -v xclip &> /dev/null; then
                echo -n "$RULE_TEXT" | xclip -selection clipboard
                return 0
            elif command -v xsel &> /dev/null; then
                echo -n "$RULE_TEXT" | xsel --clipboard --input
                return 0
            elif command -v wl-copy &> /dev/null; then
                echo -n "$RULE_TEXT" | wl-copy
                return 0
            fi
            return 1
            ;;
        MINGW*|CYGWIN*|MSYS*)
            echo -n "$RULE_TEXT" | clip
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Try to open Cursor settings
open_cursor_settings() {
    # Method 1: Try the cursor:// URL scheme (may not work for settings)
    # Method 2: Use the cursor CLI to execute a command
    # Method 3: Just open Cursor and let user navigate
    
    case "$(uname -s)" in
        Darwin)
            # Try opening Cursor with a command
            if command -v cursor &> /dev/null; then
                # Open Cursor (if not already open)
                open -a "Cursor" 2>/dev/null
                echo "  ✓ Cursor opened"
                echo ""
                echo "  Navigate to: Cursor → Settings → Cursor Settings → Rules"
                return 0
            elif [ -d "/Applications/Cursor.app" ]; then
                open -a "Cursor" 2>/dev/null
                echo "  ✓ Cursor opened"
                echo ""
                echo "  Navigate to: Cursor → Settings → Cursor Settings → Rules"
                return 0
            fi
            ;;
        Linux)
            if command -v cursor &> /dev/null; then
                cursor &>/dev/null &
                echo "  ✓ Cursor opened"
                echo ""
                echo "  Navigate to: File → Preferences → Cursor Settings → Rules"
                return 0
            fi
            ;;
        MINGW*|CYGWIN*|MSYS*)
            if command -v cursor &> /dev/null; then
                cursor &
                echo "  ✓ Cursor opened"
                echo ""
                echo "  Navigate to: File → Preferences → Cursor Settings → Rules"
                return 0
            fi
            ;;
    esac
    
    echo "  ⚠  Could not auto-open Cursor. Please open it manually."
    return 1
}

# Main flow
if copy_to_clipboard; then
    echo "  ✓ Rule copied to clipboard:"
    echo ""
    echo "    \"$RULE_TEXT\""
    echo ""
else
    echo "  ⚠  Could not copy to clipboard. Please copy manually:"
    echo ""
    echo "    $RULE_TEXT"
    echo ""
fi

echo "───────────────────────────────────────────────────────────────────────"
echo ""
read -p "  Open Cursor now? [Y/n] " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    open_cursor_settings
fi

echo ""
echo "───────────────────────────────────────────────────────────────────────"
echo "  INSTRUCTIONS:"
echo "───────────────────────────────────────────────────────────────────────"
echo ""
echo "  1. In Cursor, go to: Settings → Cursor Settings → Rules"
echo "  2. Under 'User Rules', click '+ Add Rule'"
echo "  3. Paste (Cmd+V / Ctrl+V)"
echo "  4. Done! ✓"
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo ""
