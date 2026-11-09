#!/bin/zsh
# Weekly Search Console health check, launched by launchd (Mondays 09:00).
# Runs `npm run gsc -- check`; on any ALERT it raises a macOS notification.
# Needs the service account key at ~/.config/gsc/techeventsmap-key.json.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gsc-$(date +%Y-%m-%d).log"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$REPO"
node scripts/gsc-report.mjs check > "$LOG_FILE" 2>/dev/null
rc=$?
if [ $rc -eq 2 ]; then
  MSG="$(grep '^ALERT' "$LOG_FILE" | head -3 | tr '\n' ';')"
  osascript -e "display notification \"$MSG\" with title \"Tech Events Map: Search Console alert\""
elif [ $rc -ne 0 ]; then
  osascript -e 'display notification "GSC check failed, see logs/" with title "Tech Events Map"'
fi
echo "--- done $(date) rc=$rc" >> "$LOG_FILE"
