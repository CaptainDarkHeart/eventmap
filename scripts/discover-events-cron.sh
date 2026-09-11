#!/bin/zsh
# Weekly headless event-discovery run, launched by launchd.
# Opens a PR only. Never pushes to main.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/discovery-$(date +%Y-%m-%d).log"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$REPO"
git checkout main >> "$LOG_FILE" 2>&1
git pull --ff-only origin main >> "$LOG_FILE" 2>&1

PROMPT="$(cat "$REPO/scripts/discover-events-prompt.txt")"

claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --permission-prompts none \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "WebFetch" "WebSearch" "Bash(git *)" "Bash(gh *)" "Bash(npm *)" "Bash(curl *)" "Bash(date*)" \
  --output-format text \
  >> "$LOG_FILE" 2>&1

echo "--- done $(date) ---" >> "$LOG_FILE"
