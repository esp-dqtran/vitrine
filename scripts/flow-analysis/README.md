# Distributed Flow analysis

The runner analyzes each pending Flow exactly once and stores artifacts under
`data/feature-descriptions/<app>/`.

Run both website providers in parallel:

```bash
FLOW_APP=stripe \
FLOW_PRODUCT=Stripe \
FLOW_ANALYSIS_PROVIDERS=chatgpt \
npm run flow-analysis
```

To replace previously generated output from other providers without deleting
screenshots or artifacts first:

```bash
FLOW_ANALYSIS_PROVIDERS=chatgpt \
FLOW_REANALYZE_PROVIDERS=gemini \
npm run flow-analysis
```

The provider assignment is deterministic from the Flow identity, so restarting
the same run does not duplicate completed work. Each provider has an independent
worker lane:

- `CHATGPT_CONCURRENCY` defaults to `2`.
- `GEMINI_CONCURRENCY` defaults to `1`.

Legacy single-provider runs remain supported with
`FLOW_ANALYSIS_PROVIDER=chatgpt` or `gemini`.

Every generated JSON artifact records its provider, model label, quality score,
and quality warnings. The quality gate enforces ordered evidence coverage,
rejects foreign evidence IDs, and normalizes Gemini percentage confidence
values to the `0..1` contract.

## Source-attributed application research

Optional public research lives separately from screenshot evidence at:

```text
research/app-knowledge/<app>.json
```

When that file exists, the flow runner selects a small set of relevant claims
and adds them to the prompt as **external documented context**. The prompt
explicitly forbids treating those claims as screenshot observations or assigning
screenshot evidence IDs to them. Generated artifacts record only the selected
research claim and source IDs in `analysis.researchContext`.

Override the default file when necessary:

```bash
FLOW_APP=amazon-shopping \
FLOW_RESEARCH_KNOWLEDGE_PATH=/absolute/path/to/knowledge.json \
npm run flow-analysis
```

After image analysis, build separate reconciliation packets without modifying
the validated JSON or Markdown artifacts:

```bash
npm run flow-analysis:index -- --app amazon-shopping \
  --product "Amazon Shopping"
npm run flow-analysis:research-context -- --app amazon-shopping
```

Packets are written to:

```text
data/feature-descriptions/<app>/research-context/
```

Each packet keeps the visual analysis, documented claims, sources, scope notes,
and unresolved questions separate. A later reviewer classifies each documented
claim as `supports`, `extends`, `conflicts`, or `unrelated`.

Run three read-only Kiro Terra workers to reconcile those packets:

```bash
npm run flow-analysis:kiro-reconcile -- --app amazon-shopping \
  --workers 3 --model gpt-5.6-terra --effort high
```

The controller grants Kiro only `fs_read`, validates every claim, source, and
visual evidence ID, and atomically stores resumable results under:

```text
data/feature-descriptions/<app>/research-reconciliation/
```

Use `--limit 3` for a three-worker pilot. Valid existing outputs are skipped on
restart. Invalid outputs are recorded in `progress.json`; critical, conflicting,
or high-risk flows are written to `sol-review-queue.json` for a later Sol pass.

After the reconciliation queue finishes successfully, apply the database
migration and import every validated result in one transaction:

```bash
npm run db:migrate
npm run flow-analysis:kiro-import -- --app amazon-shopping \
  --product amazon-shopping --apply
```

The importer refuses an incomplete or failed queue, validates every saved
artifact again, and stores immutable, hash-addressed revisions in
`app_flow_reconciliations`. Running the same import again skips unchanged
revisions.

Research rules:

- Prefer first-party help, developer, policy, and app-store sources.
- Record retrieval date, platform, region, and scope for every source.
- Screenshots remain authoritative only for visible captured behavior.
- External documentation remains `documented`, never `observed`.
- Preserve conflicts until direct evidence resolves them.
