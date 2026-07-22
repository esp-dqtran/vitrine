# GetDesign Native Design-System Import

**Date:** 2026-07-22

## Goal

Import the 44 public GetDesign `DESIGN.md` systems that map to existing Astryx apps, convert them into Astryx's native structured design-system format, replace only those apps' current web snapshots, and render the resulting visual systems in the existing app Design System page.

This is not a Markdown archive or a GetDesign reference surface. Users see native Astryx color, typography, spacing, effect, component, and rule UI. The product UI does not link to or label GetDesign.

## Scope

### Included

- The 44 public systems returned by the current GetDesign CLI catalog that have a validated Astryx app mapping.
- A deterministic `DESIGN.md` parser and normalizer.
- Native `DesignSystemSnapshot` persistence.
- Replacement of the current `web` snapshot for each matched app.
- Creation of a design-system-only `web` platform row when a matched app currently has only mobile platforms.
- Preservation of iOS and Android snapshots.
- Visual rendering in `/apps/:app/design-system` through the existing design-system API and page structure.
- Operational dry-run, apply, reporting, backup, and rollback behavior.
- Tests and live reconciliation for all 44 mappings.

### Excluded

- GetDesign's paid or request-only website catalog.
- Importing website design guidance into iOS or Android snapshots.
- Rendering raw GetDesign Markdown in the product.
- A separate GetDesign page, attribution badge, source link, or source selector.
- Fabricating links between imported claims and Astryx/Mobbin screenshots.
- LLM-based transformation during import.

## Validated app mapping

Most public slugs map directly after punctuation normalization. The importer keeps the mapping explicit and version-controlled so a changed upstream slug cannot silently target a different app.

The seven non-identical mappings are:

| GetDesign slug | Astryx app |
|---|---|
| `bmw` | `my-bmw` |
| `cal` | `cal-com` |
| `linear.app` | `linear` |
| `mistral.ai` | `mistral-ai` |
| `playstation` | `playstation-app` |
| `runwayml` | `runway` |
| `superhuman` | `superhuman-mail` |

The remaining 37 mappings are:

`airbnb`, `airtable`, `apple`, `binance`, `claude`, `clay`, `cohere`, `coinbase`, `cursor`, `discord`, `elevenlabs`, `figma`, `framer`, `intercom`, `kraken`, `lovable`, `mintlify`, `miro`, `nike`, `notion`, `pinterest`, `raycast`, `resend`, `revolut`, `sentry`, `shopify`, `slack`, `spotify`, `starbucks`, `stripe`, `supabase`, `tesla`, `uber`, `vercel`, `webflow`, `wise`, and `zapier`.

## Architecture

```text
GetDesign public catalog
        |
        v
Fetch mapped DESIGN.md files
        |
        v
Deterministic parser and normalizer
        |
        v
Validate native DesignSystemSnapshot
        |
        v
Backup old web snapshot and replace transactionally
        |
        v
Existing design-system API
        |
        v
Astryx visual Design System page
```

The importer lives beside existing catalog-import tooling and uses the repository's PostgreSQL access conventions. It does not introduce a second runtime design-system format.

## Import flow

### Fetch phase

1. Read the version-controlled 44-entry mapping.
2. Confirm every target app exists.
3. Confirm every target's current platforms. Create a `web` platform row during apply for a mapped app that does not already have one; never repurpose or overwrite an iOS or Android platform.
4. Fetch the public `DESIGN.md` content for every mapped GetDesign slug.
5. Record a content hash for reporting and idempotence.

Fetch and parsing happen before any replacement. A network or parser failure cannot remove existing data.

### Parse phase

The parser recognizes structured Markdown sections, tables, lists, code blocks, CSS values, and prose rules. It emits native data as follows:

| GetDesign content | Native Astryx data |
|---|---|
| Palette and semantic colors | `DesignToken` entries with `kind: "color"` |
| Font families, sizes, weights, and line heights | `DesignToken` entries with `kind: "typography"` |
| Spacing scales | `DesignToken` entries with `kind: "spacing"` |
| Corner radii | `DesignToken` entries with `kind: "radius"` |
| Borders | `DesignToken` entries with `kind: "border"` |
| Shadows and visual effects | `DesignToken` entries with `kind: "effect"` |
| Buttons, fields, cards, navigation, and other patterns | `DesignComponent` and `ComponentVariant` entries |
| Layout guidance | `rules` entries with `kind: "layout"` |
| Responsive guidance | `rules` entries with `kind: "responsive"` |
| Imagery and icon guidance | `rules` entries with `kind: "imagery"` or `"icon"` |
| Voice and usage guidance | `rules` entries with `kind: "content"` |
| Motion and state behavior | `rules` entries with `kind: "interaction"` |

IDs are deterministic from normalized section and item names. Reimporting unchanged content produces the same logical snapshot rather than duplicate tokens or variants.

Imported tokens, variants, and rules use empty evidence arrays. They must not be passed through the current evidence-enforcing synthesis parser, which intentionally discards claims without screenshot IDs. A dedicated imported-snapshot validator checks structure without inventing evidence.

### Validation phase

A system is eligible for replacement only when it has:

- A mapped Astryx app. Its `web` platform may already exist or be safely created during apply.
- A non-empty title and generation timestamp.
- At least one valid design token.
- Unique token, component, variant, and rule IDs within their scopes.
- Supported token and rule kinds only.
- Valid component variants when components are present.
- No malformed CSS-like values that the page cannot display safely.

The parser may preserve unrecognized prose as a content or layout rule when its section has a clear semantic heading. It must reject ambiguous structures rather than guessing with an LLM.

## Replacement and recovery

The command has two modes:

- **Dry run:** fetch, parse, validate, and report all 44 mappings without database mutation.
- **Apply:** perform the validated replacements.

For each app, apply mode uses one database transaction:

1. Lock the target app row.
2. Create the app's `web` platform row if it does not exist. This applies to `my-bmw`, `playstation-app`, `raycast`, `starbucks`, and `tesla` in the verified database state.
3. Lock the target app's current web design-system row when one exists.
4. Save the current snapshot to an internal append-only import-history record.
5. Upsert the new native snapshot into `design_systems` for `platform = 'web'`.
6. Commit only after platform creation, backup, and replacement all succeed.

One app's failure does not abort successful replacements for other apps. A failed app retains its previous snapshot. Rollback restores the latest pre-import snapshot for a named app and web platform in another transaction.

Operational history can retain the source slug, content hash, timestamp, run identifier, and old snapshot. This metadata is not returned by the customer-facing design-system API and is not rendered in the UI.

## Design System page

The existing app Design System route remains the user entry point. It loads the replaced web snapshot through the existing endpoint:

`GET /api/design-systems/:app?platform=web`

The page renders the imported system as native visual sections:

1. **Theme summary** — system title and concise visual guidance derived from the document.
2. **Colors** — swatches with token name, value, and semantic role.
3. **Typography** — specimens showing family, weight, size, line height, and hierarchy where available.
4. **Spacing and shape** — spacing scale, corner-radius previews, and border treatments.
5. **Effects** — visible shadow and other effect previews.
6. **Components** — cards for buttons, inputs, navigation, cards, and other parsed patterns, including described variants and states.
7. **Rules** — grouped layout, responsive, imagery, icon, content, and interaction guidance.
8. **Exports** — existing JSON, CSS, Tailwind, component-spec, React, and `DESIGN.md` export actions continue using the native snapshot.

The page never displays raw imported Markdown. It does not display GetDesign attribution or a source link.

### Evidence behavior

GetDesign documents do not cite Astryx screenshot IDs. The UI therefore hides evidence counts, evidence links, confidence controls, and review controls for imported entries whose evidence arrays are empty. It must not show `0 evidence` as if evidence were expected.

Existing evidence-backed snapshots outside the replaced web scope keep their current behavior.

### Page states

- **Complete:** render every available native visual section.
- **Partial:** render valid sections and omit absent optional sections without empty chrome.
- **Unavailable:** explain that the app has no stored web design system.
- **Import failure:** keep the previous page data; expose failure only in the administrative command report.

## Error handling and reporting

The importer produces one final machine-readable and human-readable report containing:

- Expected mapping count.
- Fetch, parse, validation, replacement, and verification totals.
- Per-app outcome and concise error.
- Source content hash.
- Whether a replacement changed data or was already current.
- Rollback-history identifier for applied replacements.

Secrets and database connection strings must never appear in output. Upstream content is treated as untrusted input: Markdown is parsed as data, raw HTML is not executed, and rendered text follows React's normal escaping.

## Verification

### Automated tests

- Parser fixtures covering representative public GetDesign structures.
- Token mapping tests for colors, typography, spacing, radii, borders, and effects.
- Component and rule mapping tests.
- Deterministic-ID and idempotent-reimport tests.
- Imported-snapshot validation tests, including empty evidence arrays.
- UI tests for every visual section and for hidden evidence controls.
- API tests proving web replacement and iOS/Android preservation.
- Store tests proving a missing web platform is created without changing existing mobile platform rows.
- Transaction tests proving backup-before-replace and no partial replacement.
- Rollback tests.
- Import-report tests with redacted errors.

### Full-catalog gate

Before apply mode is used against the live database:

1. Run a complete dry run for all 44 mappings.
2. Require 44 fetches and 44 valid target mappings.
3. Report the five mappings that require a new `web` platform row and reject any unexpected missing platform state.
4. Review any parser failures; do not silently skip them in the acceptance total.
5. Capture pre-import web, iOS, and Android snapshot counts and hashes.

After apply:

1. Re-read all 44 web snapshots through the database and API.
2. Confirm every reported success renders at least one token section.
3. Confirm iOS and Android snapshot hashes are unchanged.
4. Confirm the import-history row exists for every replaced snapshot.
5. Browser-check representative light, dark, typography-heavy, and component-heavy systems.

## Acceptance criteria

- All 44 public mappings are explicit and validated.
- Every successful import is stored as a native Astryx web snapshot.
- The app Design System page visibly renders imported tokens, components, and rules rather than raw Markdown.
- Existing exports operate on imported data.
- No imported item claims Astryx screenshot evidence.
- No iOS or Android design system is changed.
- All 44 apps have a web design-system surface after apply; only the five verified mobile-only apps receive a newly created `web` platform row.
- A failed app retains its previous snapshot.
- Every applied replacement is recoverable through rollback history.
- The product UI contains no GetDesign reference or separate GetDesign surface.
