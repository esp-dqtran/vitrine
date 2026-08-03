#!/bin/bash
# ponytail: the sweep is resumable, so supervision is just "run it again after a cooldown".
# The circuit breaker aborts on provider outage (usage limit); without this the sweep then
# sits idle until someone notices. Cooldown is 30m because that is roughly a limit window.
cd "$(dirname "$0")/../.." || exit 1
while true; do
  node --env-file=.env --import tsx scripts/flow-analysis/sweep-feature-documents.ts \
    --provider claude --model claude-opus-5 \
    --per-app 999 --workers 1 --shards 1 --shard 0 \
    --max-evidence 40 --order asc --visibility catalog \
    --timeout-ms 1800000 --failure-streak-limit 10 \
    --log-dir data/feature-descriptions/full-app
  echo "{\"event\":\"supervisor-restart\",\"at\":\"$(date -u +%FT%TZ)\"}"
  sleep 1800
done
