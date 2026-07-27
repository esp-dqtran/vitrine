# Readable Document Flow design

## Goal

Make every Document Flow understandable on first read without changing or regenerating its stored revision.

## Information hierarchy

The default document contains four sections:

1. **Summary** — user goal, starting point, and ending point.
2. **Observed steps** — one ordered list of the captured journey.
3. **Requirements** — concise requirement text with directly associated acceptance criteria.
4. **Missing evidence** — deduplicated states and questions not answered by the screenshots.

Evidence references remain attached to the claims they support. Repeated actors, visible states, proposed journeys, generic user stories, repeated preconditions, metrics, and the evidence appendix are removed from the default Markdown.

## Technical details

The in-app Document Flow keeps the complete structured revision available in a collapsed **Technical details** disclosure. It contains risks and assumptions, proposed edge cases, metrics and analytics, dependencies, and the evidence manifest. Nothing is deleted from the stored revision.

## Scope

- Change the shared Markdown renderer so existing and future documents receive the concise structure.
- Change the in-app renderer to show complete technical data under progressive disclosure.
- Do not migrate or regenerate the 703 Binance revisions.
- Do not change Feature Document editing, revision history, evidence protection, or source identity.

## Verification

- Test the concise Markdown headings, ordered journey, requirements, deduplicated missing evidence, and removed repetitive sections.
- Test that Technical details is collapsed and still contains structured revision evidence.
- Run focused Feature Document and Flow mode tests, then the production build.

