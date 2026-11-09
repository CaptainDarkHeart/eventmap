#!/bin/zsh
# Weekly Search Console health check, launched by launchd (Mondays 09:00).
# Runs `node scripts/gsc-report.mjs check`; on any ALERT it emails Dan via Resend
# (sending-only key at ~/.config/gsc/resend-key, domain techeventsmap.com) and
# raises a macOS notification.
# Needs the service account key at ~/.config/gsc/techeventsmap-key.json.
# `gsc-weekly-cron.sh --test-email` sends a test email only.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/gsc-$(date +%Y-%m-%d).log"
RESEND_KEY_FILE="$HOME/.config/gsc/resend-key"
TO="dantaylormedia@gmail.com"
FROM="Tech Events Map <contact@techeventsmap.com>"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# send_mail SUBJECT BODY_FILE
send_mail() {
  [ -r "$RESEND_KEY_FILE" ] || { echo "no resend key, skipping email" >&2; return 1; }
  local payload
  payload="$(node -e '
    const fs = require("fs");
    process.stdout.write(JSON.stringify({
      from: process.argv[1], to: [process.argv[2]], subject: process.argv[3],
      text: fs.readFileSync(process.argv[4], "utf-8"),
    }));' "$FROM" "$TO" "$1" "$2")"
  curl -sS -o /dev/null -w "resend http %{http_code}\n" https://api.resend.com/emails \
    -H "Authorization: Bearer $(cat "$RESEND_KEY_FILE")" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

if [ "${1:-}" = "--test-email" ]; then
  T="$(mktemp)"; echo "Test from gsc-weekly-cron.sh on $(date). Email alerts for the weekly Search Console check are working." > "$T"
  send_mail "Tech Events Map: GSC alert email test" "$T"; rm -f "$T"; exit 0
fi

cd "$REPO"
node scripts/gsc-report.mjs check > "$LOG_FILE" 2>/dev/null
rc=$?
if [ $rc -eq 2 ]; then
  MSG="$(grep '^ALERT' "$LOG_FILE" | head -3 | tr '\n' ';')"
  osascript -e "display notification \"$MSG\" with title \"Tech Events Map: Search Console alert\""
  send_mail "Tech Events Map: Search Console alert" "$LOG_FILE" >> "$LOG_FILE" 2>&1
elif [ $rc -ne 0 ]; then
  osascript -e 'display notification "GSC check failed, see logs/" with title "Tech Events Map"'
  echo "GSC check failed (rc=$rc) on $(date). Check the Mac and logs/." > "$LOG_FILE.fail"
  send_mail "Tech Events Map: GSC check FAILED" "$LOG_FILE.fail" >> "$LOG_FILE" 2>&1
fi
echo "--- done $(date) rc=$rc" >> "$LOG_FILE"
