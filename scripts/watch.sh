#!/bin/bash
#
# Simple file watcher for Chrome extension development
#
# Usage:
#   ./scripts/watch.sh
#
# This script watches for file changes and uses AppleScript to
# reload the extension in Chrome automatically.
#
# Requirements:
#   - macOS (uses osascript)
#   - fswatch: brew install fswatch
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check for fswatch
if ! command -v fswatch &> /dev/null; then
    echo "❌ fswatch not found. Install it with:"
    echo "   brew install fswatch"
    exit 1
fi

echo "🔄 PII Detector Extension Watcher"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Watching: $PROJECT_DIR"
echo ""
echo "When files change, the extension will reload automatically."
echo "Make sure Chrome has the extension loaded from this directory."
echo ""
echo "Press Ctrl+C to stop."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to reload the extension
reload_extension() {
    echo "🔄 Reloading extension..."

    # AppleScript to reload extensions in Chrome
    osascript <<EOF
tell application "Google Chrome"
    set extPage to "chrome://extensions/"
    set found to false

    -- Look for existing extensions tab
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t starts with "chrome://extensions" then
                set found to true
                set active tab index of w to (index of t)
                tell t to reload
                exit repeat
            end if
        end repeat
        if found then exit repeat
    end repeat

    -- If no extensions tab found, just reload current tab if it's a supported site
    if not found then
        set currentURL to URL of active tab of front window
        if currentURL contains "chatgpt.com" or currentURL contains "gemini.google.com" then
            tell active tab of front window to reload
        end if
    end if
end tell
EOF

    echo "✅ Extension reloaded at $(date '+%H:%M:%S')"
}

# Watch for changes
fswatch -o \
    --exclude '\.git' \
    --exclude 'node_modules' \
    --exclude 'scripts' \
    --exclude '\.DS_Store' \
    --include '\.js$' \
    --include '\.json$' \
    --include '\.html$' \
    --include '\.css$' \
    "$PROJECT_DIR/src" \
    "$PROJECT_DIR/manifest.json" \
    | while read; do
        reload_extension
    done
