#!/usr/bin/env bash
# run_crawl.sh <cfg.json>  — run crawl_model.js inside ego-browser with the given config.
# The Node runtime does not receive environment variables, so the config is prepended as a constant.
# Progress lines go to stderr and to <out>_log.txt; rows are appended to <out>_rows.tsv as they are read.
set -euo pipefail
CFG_FILE="${1:?usage: run_crawl.sh cfg.json}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$CFG_FILE"   # fail fast on bad JSON
{ printf 'const CFG = %s;\n' "$(cat "$CFG_FILE")"; cat "$DIR/crawl_lib.js" "$DIR/crawl_model.js"; } | ego-browser nodejs
