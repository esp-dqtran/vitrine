# Astryx Product Designer UI Flow

Status: Approved UI design brief  
Platform: Web  
Primary audience: Product designers  
Example application: Linear  

## 1. Purpose of This Document

Use this document to design the product-designer-facing Astryx web interface.

Astryx should feel as easy to browse as Mobbin, but provide a deeper understanding of each application. It does not stop at screenshots and flows. It reconstructs the complete **observed** design system of an application from captured evidence.

The design should help a product designer move naturally from inspiration to understanding:

1. Discover an application or pattern.
2. Understand the application's overall visual language.
3. Browse real captured screens and flows.
4. Inspect tokens, components, variants, and rules.
5. Verify every finding against source screens.
6. Save or compare useful references.
7. Export editable design assets to Figma.

## 2. Product Vision

> Astryx is Mobbin for complete, evidence-backed application design systems.

The core product promise is:

> Explore real web applications and understand the complete observed design system behind them.

Astryx must never suggest that it knows more than it has captured. It may identify patterns across available screens, but it must not invent missing screens, component variants, interaction states, responsive behavior, or design rules.

For example, if only a desktop default button has been captured, Astryx shows only that desktop default button. It must not generate hover, disabled, mobile, or dark-mode variants.

## 3. Design Principles

### Designers first

Prioritize visual research, inspection, comparison, collection, and Figma handoff. Code exports are useful but secondary.

### Evidence is always reachable

Every token, component, variant, rule, and flow step must link back to one or more captured source screens.

### Clear observed boundaries

Use explicit language such as:

- Observed in 3 screens
- Desktop only
- No additional variants captured
- Smaller breakpoints unavailable
- Last captured July 9, 2026

Avoid language that implies unsupported completeness.

### Progressive depth

The first view should summarize the system. More detailed specifications and evidence should appear as the designer drills down.

### Screens support the system

Screenshots remain important, but the product should not feel like a screenshot gallery with analysis added underneath. The structured design system is a first-class part of the experience.

### Calm, professional interface

The product is a research tool. Use strong hierarchy, generous whitespace, restrained color, readable typography, and predictable navigation. The inspected application's colors should not overpower Astryx's own interface.

## 4. V1 Scope

Design for:

- Web applications only
- Desktop Astryx interface with responsive web behavior
- Product designers as the primary audience
- Internally curated applications
- Application discovery
- Screen and flow browsing
- Evidence-backed design-system inspection
- Cross-application comparison
- Collections and research notes
- Editable Figma export
- Secondary token and code exports

Do not design:

- App submission or URL submission
- Public user-generated applications
- Native iOS or Android catalogs
- AI-generated missing screens or states
- A generic component library unrelated to the selected application
- The internal capture and analysis pipeline as part of the designer experience
- Curator administration controls in the main designer interface

## 5. Primary Information Architecture

The product has four global destinations:

1. **Catalog** — discover applications and design patterns.
2. **Collections** — revisit saved research and notes.
3. **Compare** — compare selected applications or design-system items.
4. **Account** — plan, export usage, and profile controls.

An application page has these primary sections:

1. Overview
2. Screens
3. UI Elements
4. Flows
5. Design System
6. Export

Review and version-management controls are internal curator features and should not appear for product designers.

## 6. End-to-End Product Designer Journey

### Stage 1: Discover

The designer arrives at the catalog and searches for an application, product area, screen type, flow, component, or visual pattern.

Example searches:

- Linear
- AI assistant flows
- Compact sidebar navigation
- Email sign-in screens
- Neutral productivity dashboards
- Rounded outline buttons

The catalog returns grouped results where useful:

- Applications
- Screens
- Flows
- UI elements
- Design tokens and rules

The designer can open a result immediately or save it to a collection.

### Stage 2: Open an application

The designer opens Linear from the catalog.

The application header communicates:

- Application name and icon
- Platform and category
- Total captured screens
- Number of analyzed screens
- Number of reconstructed components
- Number of design tokens
- Number of curated flows
- Capture date and published version
- Save, compare, and export actions

Counts must have precise meanings:

- **Captured screens** means every screenshot currently in this application version.
- **Analyzed screens** means screens with completed structured analysis.
- Never label a paginated or currently visible screen count as the analyzed count.

### Stage 3: Understand the overview

The Overview is an executive summary of the observed system. It should answer, within one scan:

- What does this application feel like?
- What are its dominant foundations?
- Which components define it?
- Which layout patterns repeat?
- How much evidence has been analyzed?
- Where should I inspect next?

The designer can select any summary item to open its detailed Design System or UI Elements view.

### Stage 4: Browse real screens

The designer opens Screens to study the application visually.

They can filter by:

- Page type
- Product area
- Layout
- Components present
- Theme
- Viewport
- Visible state
- Flow membership

Opening a screen displays a large screenshot with structured metadata and the design-system observations found in that screen.

### Stage 5: Study a real flow

The designer opens Flows and selects **Ask Linear**.

The flow contains two observed steps:

1. Compose a request.
2. Review the generated response.

Each step shows the source screen, its purpose, and the observed interaction leading to the next step. The flow must not add loading, error, retry, or mobile steps unless they were captured.

### Stage 6: Inspect UI elements

The designer opens UI Elements to see reusable components reconstructed from repeated evidence.

For the Linear example, the component inventory contains:

- Sidebar navigation
- Prompt composer
- Email input
- Outline button

The designer opens a component to inspect its anatomy, observed variants, evidence, related tokens, and occurrences.

### Stage 7: Inspect the design system

The designer opens Design System to study foundations and repeated rules.

For the Linear example, the design system contains:

- Surface color
- Primary text color
- 8px spacing token
- 8px control radius
- Body typography style
- Fixed sidebar shell rule
- Quiet neutral treatment rule
- Desktop-wide layout observation

Every item displays confidence, review status, capture context, and evidence links.

### Stage 8: Save or compare

The designer saves useful screens, components, flows, tokens, or the full application system to a project collection.

They may select another application to compare equivalent items, such as:

- Sidebar systems
- Prompt composers
- Sign-in inputs
- Typography scales
- Spacing systems

Missing comparable data should display **Not observed**, not an empty or generated substitute.

### Stage 9: Export

The designer opens Export and chooses a scope:

- Complete observed design system
- One foundation category
- One component family
- Selected components and screens

The primary action is **Export editable Figma library**.

Secondary actions include:

- JSON tokens
- CSS variables
- Tailwind theme
- Component specifications
- React scaffold

After export, show the generated filename, success status, and short usage instructions.

## 7. Screen Requirements

### 7.1 Catalog

#### Goal

Help designers find relevant applications and patterns quickly without requiring them to know an exact application name.

#### Required regions

- Global navigation
- Prominent natural-language search
- Category and facet filters
- Result count
- Application grid
- Grouped non-application search results when relevant
- Compare selection state
- Collections shortcut

#### Application card

Each card should show:

- Application name and identity
- Category
- A preview from real captured screens
- Captured-screen count
- Analysis coverage when incomplete
- Compare control
- Clear open action

Do not use fabricated placeholder screenshots once real captures are available.

#### States

- Initial catalog
- Search results
- Filtered results
- No results
- Loading
- Failed request
- Locked application for a Free account
- Comparison selection

### 7.2 Application shell

#### Goal

Maintain context while the designer moves among Overview, Screens, UI Elements, Flows, Design System, and Export.

#### Required regions

- Back to catalog
- Application identity and metadata
- Evidence coverage summary
- Version and capture date
- Save, compare, and export actions
- Persistent section navigation

The shell should remain visually stable between tabs.

### 7.3 Overview

#### Goal

Summarize the observed visual language without overwhelming the designer.

#### Required modules

- Observed-system summary
- Primary colors
- Typography preview
- Spacing and radius preview
- Key components
- Main layout and content patterns
- Coverage summary
- Suggested next inspection actions

#### Coverage language

Use a sentence such as:

> Reconstructed from 3 analyzed screens out of 443 captured screens. Uncaptured patterns and states are unavailable, not inferred.

When every captured screen is analyzed, the language may simplify to:

> Reconstructed from 48 analyzed web screens. Uncaptured patterns and states are unavailable, not inferred.

### 7.4 Screens

#### Goal

Provide a fast visual browsing experience while connecting each screenshot to structured system data.

#### Screen grid card

Show:

- Screenshot preview
- Screen name or page type
- Product area
- Viewport
- Visible state
- Flow membership
- Analysis status

#### Screen detail

Show:

- Large source screenshot
- Source URL when available
- Capture date
- Viewport dimensions
- State context
- Visible content summary
- Components detected
- Tokens and layout rules evidenced here
- Previous and next screen navigation
- Save and compare actions

### 7.5 UI Elements

#### Goal

Show the actual reusable interface vocabulary of the selected application.

Group components by observed category, not by a fixed universal checklist.

Possible categories include:

- Navigation
- Inputs
- Actions
- Data display
- Feedback
- Overlays
- Content

#### Component card

Show:

- Component name
- Category
- Number of observed variants
- Short anatomy summary
- Number of occurrences
- Confidence and review status
- Evidence preview

#### Component detail

Show:

- Reconstructed component preview
- Anatomy
- Observed variants and states
- Associated tokens
- Responsive differences when captured
- Every source-screen occurrence
- Confidence and curator review status
- Export and save actions

If only one variant is observed, say **1 observed variant**. Do not visually reserve empty slots for expected variants.

### 7.6 Flows

#### Goal

Help designers understand real task progression across captured screens.

#### Flow index

Each flow card shows:

- Flow name
- Product area
- Purpose
- Step count
- Small ordered screen previews
- Capture coverage

#### Flow viewer

The selected flow displays:

- Flow title and purpose
- Ordered step navigation
- Large active-step screenshot
- Step name
- Step purpose
- Observed interaction leading forward
- Source-screen evidence
- Previous and next controls

Do not animate or prototype transitions that were not observed. A simple directional connection between real steps is enough.

### 7.7 Design System

#### Goal

Present the application's observed foundations and design rules as a credible research document.

#### Foundation sections

- Colors
- Typography
- Spacing
- Radii
- Borders
- Effects

Only render sections containing observed data. Do not show empty sections merely to resemble a conventional design-system template.

#### Token card

Show:

- Token name
- Exact value
- Observed semantic role
- Evidence count
- Confidence
- Review status
- Capture date and viewport context
- Source-screen links

#### Pattern sections

- Layout patterns
- Responsive behavior
- Content patterns
- Interaction patterns
- Icons and imagery treatment

Each rule includes a plain-language explanation and evidence links.

### 7.8 Export

#### Goal

Turn research into editable design work while preserving traceability.

#### Required regions

- Export scope selector
- Primary Figma export card
- Secondary format actions
- Selected components and screens control
- Export progress
- Success or failure message
- Brief instructions

#### Primary Figma message

Explain that the export contains:

- Variable collections
- Text and effect styles
- Auto-layout components
- Observed variant sets
- Foundation documentation
- Source-reference frames
- Evidence IDs attached to generated items

The export must clearly state that missing states are not generated.

### 7.9 Collections

#### Goal

Let designers organize research around a product or design problem.

A collection may contain:

- Applications
- Screens
- Flows
- Components
- Variants
- Tokens
- Design rules

Each saved item may include a personal research note. Preserve a direct link back to its application context and evidence.

### 7.10 Compare

#### Goal

Make differences between applications easy to scan without pretending the data is symmetrical.

Use aligned comparison rows for equivalent information:

- Foundation values
- Component anatomy
- Variants
- Flow steps
- Layout rules
- Evidence coverage

When one application lacks an observed item, display **Not observed in captured screens**.

## 8. Linear Example Content

The UI agent should use this case to validate the design.

### Coverage

- Application: Linear
- Platform: Web
- Category: Productivity
- Total captured screens: 443
- Analyzed screens in this focused example: 3
- Components: 4
- Tokens: 5
- Flows: 1
- Observed viewport: 1908 × 1278 desktop

### Source screens

#### Screen 424 — Ask Linear home

- Fixed left sidebar
- Centered request composer
- Suggested action cards
- Default sidebar navigation
- Default prompt-composer variant

#### Screen 425 — Ask Linear response

- Selected sidebar navigation
- Generated answer in a conversation column
- Continued reply composer
- Second step of the Ask Linear flow

#### Screen 426 — Email sign-in

- Centered narrow authentication form
- Populated email input
- Rounded outline action button

### Tokens

- Surface — `#F7F7F7`
- Text primary — `#1F2023`
- Space 8 — `8px`
- Control radius — `8px`
- Body — `14px / 1.45`, medium sans-serif

### Components

#### Sidebar navigation

- Default variant — Screen 424
- Selected variant — Screen 425
- Anatomy: workspace switcher, group headings, icon-label rows

#### Prompt composer

- Default variant — Screen 424
- Anatomy: text area, skill selector, attachment, submit action

#### Email input

- Populated variant — Screen 426
- Anatomy: email value and rounded border

#### Outline button

- Default variant — Screen 426
- Anatomy: label and rounded outline

### Flow

#### Ask Linear

Purpose: Start a prompt and review the generated response.

1. **Compose a request** — Screen 424
2. **Review the generated response** — Screen 425

### Observed rules

- Fixed sidebar shell — Screens 424 and 425
- Quiet neutral treatment — Screens 424, 425, and 426
- Desktop-wide layout — Screens 424, 425, and 426
- Smaller breakpoints unavailable

## 9. Interaction and Navigation Guidance

### Deep links

Every application tab, screen, component, flow, token, and rule should have a stable URL so research can be shared.

### Evidence opening

Selecting an evidence reference should open the related screen without losing the current context. Prefer a side panel or overlay with a clear path to the full screen detail.

### Cross-linking

Connect related information:

- Screen → detected components and tokens
- Component → variants, tokens, and occurrences
- Token → all evidence screens
- Flow step → source screen
- Rule → supporting screens

### Selection

Use consistent selection behavior for compare, collection, and export. Avoid placing several visually equal actions on every card; keep the primary open action obvious and secondary actions quieter.

### Feedback

Use non-blocking status messages for save and export success. Preserve blocking dialogs for destructive or quota-related decisions only.

## 10. Responsive Astryx Behavior

Astryx itself must work responsively even when an inspected application was captured only on desktop.

### Wide desktop

- Persistent global navigation
- Dense application grids
- Application tabs remain visible
- Side-by-side evidence and specification where helpful

### Narrow desktop or tablet

- Reduce grid columns
- Allow tab navigation to scroll horizontally
- Stack specification and evidence panels
- Preserve major actions without crowding the application header

### Mobile web

- Use a compact global navigation drawer
- Stack all content
- Keep search and filters accessible
- Present large screenshots with pan or zoom
- Use a compact tab selector
- Preserve evidence links and exact metadata

Responsive Astryx layout must not be confused with responsive evidence from the inspected application.

## 11. Product States

### Loading

Use stable skeletons matching the final layout. Avoid large layout shifts.

### No captured data

> No captured evidence is available for this section.

### Captured but not analyzed

> 440 captured screens are awaiting analysis. The published observed system currently uses 3 analyzed screens.

### Not observed

> This variant was not observed in the captured screens.

### Missing responsive evidence

> Observed at 1908 × 1278 desktop only. Smaller breakpoints are unavailable.

### Failed media

Keep screen metadata visible and provide a retry action. Do not silently replace evidence with decorative placeholders.

### Failed export

Show the server error in plain language, preserve the selected scope, and provide a retry action.

### Locked content

Show enough structured preview to explain the value of unlocking the application. Do not expose protected full-resolution evidence in the locked state.

## 12. Accessibility Requirements

- All navigation, tabs, cards, filters, dialogs, and evidence links must be keyboard accessible.
- Use semantic buttons and links instead of clickable generic containers.
- Provide visible focus indicators.
- Maintain WCAG AA text contrast.
- Do not communicate confidence, status, or selection using color alone.
- Provide meaningful screenshot alt text based on screen purpose.
- Announce asynchronous save and export results with accessible status regions.
- Preserve logical heading order across application tabs.
- Support browser zoom without clipping primary actions or evidence metadata.

## 13. Content Style

Use concise, factual language.

Prefer:

- 3 source screens
- 2 observed variants
- Reviewed · 94% confidence
- Desktop only
- Not observed

Avoid:

- AI magic
- Complete design system, without the word observed or a coverage statement
- We think this probably uses…
- Placeholder names such as Component 1
- Claims about hover, mobile, dark mode, or errors without evidence

## 14. Acceptance Criteria for the UI Design

The proposed UI is successful when:

1. A product designer can move from catalog discovery to an application overview without explanation.
2. The application page makes the structured design system as prominent as the screenshots.
3. Captured-screen and analyzed-screen counts are clearly different.
4. Every displayed token, component variant, rule, and flow step has reachable evidence.
5. Missing states and responsive variants are clearly marked as unavailable instead of generated.
6. The Linear example can be represented with exactly 3 analyzed screens, 5 tokens, 4 components, and 1 two-step flow.
7. The designer can save and compare any meaningful observed item.
8. Editable Figma export is the visually dominant export action.
9. Secondary token and code formats remain available without distracting from Figma.
10. Empty, loading, incomplete-analysis, failed-media, and failed-export states are designed.
11. The complete journey is keyboard accessible.
12. The interface works at wide desktop, narrow desktop or tablet, and mobile web widths.

## 15. Instructions for the UI Design Agent

Design the complete product-designer-facing web experience described above.

Start with these priority screens:

1. Catalog
2. Linear application Overview
3. Linear Screens grid and screen detail
4. Linear UI Elements inventory and component detail
5. Ask Linear flow viewer
6. Linear Design System document
7. Export panel
8. Collections
9. Compare

Use the Linear example as the first complete prototype path. Keep the product evidence-led, calm, and professional. Do not introduce application submission, curator administration, invented states, or unsupported responsive behavior.

The final design should make this distinction immediately understandable:

> Mobbin shows designers what an application looks like. Astryx also explains the observed system that makes it look and behave that way.
