# Distributed Flow analysis

The runner analyzes each pending Flow exactly once and stores artifacts under
`data/feature-descriptions/<app>/`.

Run all three website providers in parallel:

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
FLOW_REANALYZE_PROVIDERS=gemini,antigravity \
npm run flow-analysis
```

The provider assignment is deterministic from the Flow identity, so restarting
the same run does not duplicate completed work. Each provider has an independent
worker lane:

- `CHATGPT_CONCURRENCY` defaults to `2`.
- Antigravity uses one shared CDP conversation.
- `GEMINI_CONCURRENCY` defaults to `1`.

Legacy single-provider runs remain supported with
`FLOW_ANALYSIS_PROVIDER=chatgpt`, `antigravity`, or `gemini`.

Every generated JSON artifact records its provider, model label, quality score,
and quality warnings. The quality gate enforces ordered evidence coverage,
rejects foreign evidence IDs, and normalizes Gemini percentage confidence
values to the `0..1` contract.
