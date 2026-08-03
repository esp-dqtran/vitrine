# Refero Design System import

Vitrines imports the public Refero Styles sitemap into a resumable local archive, then can apply that archive to a specifically confirmed PostgreSQL target.

## Archive every public style

```bash
node --import tsx scripts/import-refero-design-systems.ts \
  --archive-dir .codex-artifacts/refero-styles \
  --concurrency 6 \
  --delay-ms 150
```

The archive contains:

- `manifest.json`: sitemap reconciliation and per-style status.
- `records/<refero-id>.json`: Refero's structured extraction result, JSON-LD, normalized Vitrines snapshot, provenance, and content hash.
- `refero-styles.ndjson.gz`: one complete archive record per line.

Runs resume from records whose sitemap `lastmod` value has not changed. Use `--force` to refetch every page.

## Apply an archive

Database writes require both `--apply` and an exact database-host confirmation:

```bash
DATABASE_URL='postgresql://...' node --import tsx scripts/import-refero-design-systems.ts \
  --archive-dir .codex-artifacts/refero-styles \
  --apply \
  --confirm-database-host example.supabase.co \
  --concurrency 1 \
  --delay-ms 0
```

Migration `0066_refero_design_systems.sql` preserves every provider record in `external_design_systems`. Records sharing an original source domain link to the same app. A Refero snapshot fills the app's primary web Design System only when that slot is empty or already contains an older Refero import; it never replaces Vitrines-observed, automatic, or GetDesign data.

Refero pages remain attributed and linked to their source. Imported component guidance is marked `external_import`, not observed evidence.
