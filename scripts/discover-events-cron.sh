#!/bin/zsh
# Daily headless event-discovery run, launched by launchd.
# Opens a PR, then merges it only if validate-events and tests pass
# (AUTO_MERGE=1, set in the launchd plist). Never pushes to main directly.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/discovery-$(date +%Y-%m-%d).log"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$REPO"
git checkout main >> "$LOG_FILE" 2>&1
git pull --ff-only origin main >> "$LOG_FILE" 2>&1

# Skip if a discovery PR is still open: avoids the concurrent-PR id collision.
OPEN_PR="$(gh pr list --state open --json number,headRefName --jq '[.[] | select(.headRefName | startswith("event-discovery"))] | .[0].number // empty')"
if [ -n "$OPEN_PR" ]; then
  echo "Open discovery PR #$OPEN_PR, skipping run $(date)" >> "$LOG_FILE"
  exit 0
fi

PROMPT="$(cat "$REPO/scripts/discover-events-prompt.txt")"

claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --permission-prompts none \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "WebFetch" "WebSearch" "Bash(git *)" "Bash(gh *)" "Bash(npm *)" "Bash(curl *)" "Bash(date*)" \
  --output-format text \
  >> "$LOG_FILE" 2>&1

if [ "${AUTO_MERGE:-0}" = "1" ]; then
  PR="$(gh pr list --state open --json number,headRefName --jq '[.[] | select(.headRefName | startswith("event-discovery"))] | .[0].number // empty')"
  if [ -n "$PR" ]; then
    gh pr checkout "$PR" >> "$LOG_FILE" 2>&1
    if npm run validate-events >> "$LOG_FILE" 2>&1 && npm test >> "$LOG_FILE" 2>&1; then
      gh pr merge "$PR" --squash --delete-branch >> "$LOG_FILE" 2>&1 \
        && echo "Auto-merged PR #$PR" >> "$LOG_FILE"
    else
      echo "PR #$PR failed validation, left open for manual review" >> "$LOG_FILE"
    fi
    git checkout main >> "$LOG_FILE" 2>&1
  fi
fi

echo "--- done $(date) ---" >> "$LOG_FILE"
