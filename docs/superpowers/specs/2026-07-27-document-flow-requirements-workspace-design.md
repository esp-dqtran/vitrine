# Document Flow requirements workspace design

## Goal

Turn Document Flow from a long rendered Markdown page into a structured requirements workspace that is easy to evaluate as a business analyst and precise enough to hand to a coding agent.

The default view prioritizes capability requirements and their BDD scenarios. The observed journey remains available as supporting evidence, and the stored Feature Document revision remains unchanged.

## Approved direction

Use requirement cards as the primary reading model.

The alternatives considered were:

- A traceability table, which is efficient for audits but difficult to read when behavior and scenarios are longer than one line.
- A split journey/specification view, which makes comparison immediate but is too narrow beside the existing Flow navigation.

Requirement cards provide the clearest balance of scanability, evidence traceability, and implementation detail.

## Audience and primary jobs

### Business analyst

- Understand the capabilities covered by the Flow.
- Distinguish observed behavior from inferred, proposed, or unknown behavior.
- Confirm that every requirement is supported by appropriate evidence.
- Find missing behavior and unanswered questions quickly.

### Coding agent

- Read an unambiguous behavior statement.
- Consume the associated Given/When/Then scenarios.
- Resolve each evidence reference back to its captured screen.
- Identify unsupported assumptions before implementation.

Both audiences use the same document. The design uses progressive disclosure instead of separate BA and developer modes.

## Information architecture

Document Flow contains four layers:

1. **Document summary**
   - Flow goal.
   - Entry point.
   - Completion point.
   - Revision status.
   - Counts for observed steps, requirements, scenarios, and missing-evidence items.
   - Evidence coverage expressed as `requirements with at least one evidence ID / total requirements`, not an opaque quality score.

2. **Section navigation**
   - Requirements.
   - Observed journey.
   - Missing evidence.
   - Requirements is selected by default.

3. **Primary section content**
   - Structured requirement cards.
   - A numbered observed journey.
   - Deduplicated missing states and open questions.

4. **Technical details**
   - A collapsed disclosure below the primary content.
   - Risks and assumptions, edge cases, metrics and analytics, dependencies, evidence sources, prompt version, provider, and revision metadata.

## Requirements section

Render one card per item in `revision.content.requirements`. Preserve the stored order.

Each card contains:

- Requirement ID and priority.
- Behavior statement.
- Claim-status badge: Observed, Inferred, Proposed, or Missing.
- Evidence chips in source order.
- Every associated acceptance criterion rendered as a BDD scenario.
- An `Open in Visual Flow` action when evidence can resolve to a captured step.

All behavior statements and scenarios are visible by default. This avoids hiding the information readers opened Document Flow to inspect. Technical and generation metadata remains collapsed.

### BDD scenario rendering

Render each acceptance criterion as a compact scenario block:

```text
Scenario: AC-01-1
GIVEN   a visitor starts onboarding
WHEN    the visitor chooses a registration method
THEN    registration begins with that method
```

Given, When, and Then use aligned labels rather than paragraph prose. Do not infer happy-path, alternate-path, or error labels unless that classification exists in the stored data.

### Status presentation

Status always includes text and is never communicated by color alone:

- Observed.
- Inferred.
- Proposed.
- Missing.

The UI maps the existing claim kinds to these labels. It does not calculate or persist a new review state.

## Evidence interaction

Evidence chips such as `S01` and `S02` are buttons.

Selecting a chip:

1. Resolves the evidence ID through `revision.evidenceManifest`.
2. Switches the selected Flow representation to Visual Flow.
3. Converts the manifest's zero-based `stepIndex` to the Visual Flow's one-based step number.
4. Opens the corresponding captured step using the existing step-selection contract.

If an evidence ID cannot be resolved, render it as non-interactive text and keep the rest of the card usable. The renderer must not guess a screen.

An `Open in Visual Flow` action uses the first resolvable evidence item for the requirement. Individual chips provide precise navigation when a requirement has several sources.

## Observed journey section

Render the existing observed journey as a numbered list:

- Step number and label.
- Concise observed behavior.
- Claim status.
- Evidence chips.

Selecting a step or its evidence opens the matching Visual Flow step. The journey is secondary navigation, not the default Document Flow content.

## Missing evidence section

Combine:

- `revision.content.flowAnalysis.missingStates`.
- `revision.content.openQuestions`.

Deduplicate items by normalized text while preserving first occurrence. Display the total in the document summary.

An empty state reads `No missing evidence identified in this revision.` This statement describes the revision only and must not imply that the real product has no unobserved behavior.

## Rendering architecture

The in-app workspace renders from `FeatureDocumentRevisionView.content` and `evidenceManifest` directly. It no longer uses generated Markdown as its primary UI.

Markdown remains available as:

- An export format.
- A shareable text representation.
- A fallback for consumers outside the interactive workspace.

Extend the existing `src/vitrine/documentFlowModel.ts` seam to derive a presentation model containing:

- Summary counts.
- Requirement-card data.
- Evidence-to-step lookup.
- Observed journey items.
- Deduplicated missing evidence.

Keep derivation pure and independent of React. `DocumentFlowPanel` continues to own loading, missing, pending, and error states. `SelectedFlowWorkspace` continues to own Visual Flow versus Document Flow selection.

Suggested UI component boundaries:

- `DocumentFlowSummary`.
- `DocumentFlowSectionNav`.
- `RequirementCard`.
- `BddScenario`.
- `EvidenceChip`.
- `ObservedJourney`.
- `MissingEvidence`.
- Existing `DocumentFlowTechnicalDetails`.

These may remain in `DocumentFlowPanel.tsx` initially if they stay small. Split them only when the file becomes difficult to review.

## State and URL behavior

Requirements is the default section whenever Document Flow is opened.

The inner section does not require a new URL parameter in the first version. Switching to Visual Flow preserves the existing `flow`, `flowView`, and selected-step behavior. Returning to Document Flow resets the inner section to Requirements.

This avoids expanding route state before there is a demonstrated need to deep-link to inner document sections.

## Loading, empty, and error behavior

Retain the existing states:

- Loading Document Flow.
- Document Flow unavailable.
- Generating Document Flow.
- Retryable load error.

A failure to fetch Markdown must no longer block the interactive workspace because the workspace reads the structured revision already returned by the Feature Document endpoint. Markdown export errors are handled only when the user requests an export.

## Responsive behavior

- Use one content column at all supported widths.
- Do not introduce a permanent secondary sidebar inside Document Flow.
- Requirement metadata may wrap, but Behavior, Given, When, and Then remain in reading order.
- Evidence chips wrap onto additional lines.
- At narrow widths, aligned BDD rows become stacked label/value rows.

## Accessibility

- Section navigation uses an accessible tablist or equivalent named controls with visible selection state.
- Each requirement card is a labelled section.
- Evidence chips are real buttons with labels such as `Open evidence S02 in Visual Flow`.
- Status badges include visible text.
- Heading levels remain sequential.
- Keyboard activation of evidence performs the same navigation as pointer activation.
- Focus moves to the selected Visual Flow step or its panel heading after cross-view navigation.

## Data and provider boundaries

This design does not change:

- The Feature Document schema.
- Stored revisions.
- The generation prompt.
- Provider selection.
- Evidence protection.
- Source-flow identity.
- Review or publication state.

It changes only the interactive rendering and presentation-model derivation. Existing Binance Revision 2 can demonstrate the new workspace without regeneration.

## Testing

### Presentation-model tests

- Summary counts use the structured revision.
- Requirement and scenario order is preserved.
- Evidence IDs resolve to the correct Flow steps.
- Unresolvable evidence remains non-interactive.
- Missing evidence is deduplicated.

### Component tests

- Requirements is selected initially.
- All requirement behaviors and BDD scenarios render.
- Given, When, and Then have explicit labels.
- Status is visible as text.
- Evidence activation calls the existing Visual Flow navigation contract with the correct step.
- Observed journey and Missing evidence sections can be selected.
- Technical details is collapsed by default.
- Structured content renders without a Markdown request.

### Browser verification

Using Binance Web Onboarding Revision 2:

- Confirm 14 observed steps, 6 requirements, and 6 scenarios in the summary.
- Confirm all six requirement cards are readable without switching modes.
- Open evidence from a requirement and verify the exact Visual Flow step.
- Return to Document Flow and confirm Requirements is usable.
- Confirm the layout remains a single readable column beside the Flow sidebar.
- Confirm no new console errors.

## Acceptance criteria

- A reader can identify the Flow goal, requirement count, scenario count, evidence coverage, and missing-evidence count without scrolling through the journey.
- Every requirement exposes its behavior, status, evidence, and BDD scenarios in one card.
- Every resolvable evidence reference opens the corresponding Visual Flow step.
- The observed journey and missing evidence are reachable without leaving Document Flow.
- Technical metadata remains available but does not dominate the default reading experience.
- The in-app workspace does not depend on Markdown rendering.
- No document regeneration or data migration is required.

## Non-goals

- Editing requirements inline.
- Adding a new quality-scoring algorithm.
- Adding scenario-type metadata.
- Adding deep links for inner Document Flow sections.
- Changing the generation pipeline.
- Replacing Markdown export.
