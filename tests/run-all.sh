#!/usr/bin/env bash
# Runs the full automated test suite against a locally-served index.html.
#
# Usage:
#   1. In one terminal, from the repo root:  python3 -m http.server 8000
#   2. In another terminal:                  cd tests && ./run-all.sh
#
# Requires (once): npm install playwright
set -uo pipefail
cd "$(dirname "$0")"

URL="${MB_URL:-http://127.0.0.1:8000/index.html}"
if ! curl -s -o /dev/null --max-time 3 "$URL"; then
  echo "Cannot reach $URL"
  echo "Start a server first, e.g.:  (cd .. && python3 -m http.server 8000)"
  exit 1
fi

FAIL=0
for t in smoke-test engine-test pdf-test qual-test accuracy-test why-test library-test pin-test targets-test batch3-test ledger-test; do
  echo "── $t ──────────────────────────────"
  node "$t.js"
  [ $? -ne 0 ] && FAIL=1
  echo
done

if [ "$FAIL" = "0" ]; then
  echo "ALL TESTS PASSED"
else
  echo "SOME TESTS FAILED — see output above"
fi
exit $FAIL
