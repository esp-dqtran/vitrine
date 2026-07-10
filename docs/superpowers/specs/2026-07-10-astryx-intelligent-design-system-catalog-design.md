# Astryx Intelligent Design-System Catalog — Product Design

Date: 2026-07-10

Status: Approved conversational design; awaiting written-spec review

## Product Vision

Astryx is an intelligent design-reference catalog for web product designers. Like Mobbin, it lets designers discover real applications, screens, UI patterns, and user flows. Its defining capability is reconstructing the complete **observed** design system behind each cataloged application.

Astryx does not invent missing components, variants, or interaction states. Every published design-system item must be supported by captured evidence from the application.

The product promise is:

> Explore real web applications and understand the complete observed design system behind them.

## V1 Scope

V1 includes:

- Web applications only
- Product designers as the primary audience
- An internally curated public application catalog
- Screen, flow, component, and design-system discovery
- Evidence-backed design-system reconstruction
- Cross-application comparison
- Collections and research notes
- Editable Figma export as the primary export
- Design-token and frontend formats as secondary exports

V1 explicitly excludes:

- User-submitted public or private applications
- Native iOS or Android applications
- Invented component variants or states
- Unsupported design rules inferred without captured evidence

User-submitted application analysis and additional platforms may be introduced in later releases without changing the core evidence model.

## Product Principles

### Evidence first

Every token, component, variant, state, pattern, and flow step links to at least one captured source screen.

### Complete observed system

Astryx describes its result as the complete observed design system reconstructed from a stated number of captured screens. It does not claim to know parts of an application that were not captured.

### Structured product data

Screenshots and generated prose are not the final data model. Foundations, components, variants, occurrences, screens, and flows are stored as connected entities so they can support search, comparison, and export.

### Designers first

The primary experience optimizes research, inspection, comparison, collection, and Figma handoff. Code-oriented outputs exist but remain visually secondary.

### Human-reviewed catalog

Automated analysis accelerates extraction, but internally curated catalog entries are reviewed before publication.

## Information Architecture

### Catalog

The catalog supports discovery across:

- Applications
- Screens
- User flows
- UI components
- Component variants and observed states
- Foundation tokens
- Layout and responsive patterns

Natural-language search examples include:

- Project management dashboards
- Dark tables with bulk actions
- Apps using compact rounded buttons
- Checkout error states
- Typography systems similar to Linear

Filters include app category, page type, product area, layout, component presence, theme, responsive viewport, and visible state.

### Application page

Every application page has five primary sections.

#### Overview

The overview summarizes the application's visual language:

- Primary colors
- Typography preview
- Common spacing and radii
- Key components
- Main layout patterns
- Counts of analyzed screens, flows, and components
- Capture date and analyzed version

#### Screens

Screens are browsable and filterable by:

- Page type
- Product area
- Layout
- Components present
- Light or dark theme
- Responsive viewport
- Visible state, including empty, error, loading, and success when observed

Each screen retains source URL, viewport, capture date, state context, extracted content, and analysis evidence.

#### Flows

Flows are ordered sequences of real captured screens. Example flow types include registration, onboarding, checkout, project creation, teammate invitation, and plan upgrade.

Each flow step references a real source screen and the observed interaction that moves the user to the next step. Generic or placeholder flows are not allowed in published entries.

#### UI Components

The component inventory is extracted from the current application rather than populated from a generic component list. It may include:

- Buttons
- Inputs and selectors
- Navigation
- Cards
- Tables
- Dialogs
- Notifications
- Empty states
- Other observed reusable elements

Each component page includes:

- Anatomy and specification
- Observed variants
- Observed states
- Associated design tokens
- Responsive differences
- Every screen occurrence

#### Design System

The reconstructed design system contains:

- Colors and observed semantic roles
- Typography scale
- Spacing scale
- Grid and layout rules
- Borders, radii, and elevation
- Icons and imagery treatment
- Components and observed variants
- Responsive behavior
- Content patterns
- Interaction patterns

Every rule links to supporting source evidence.

## Intelligent Analysis

Astryx analyzes captured screens across an application to:

- Detect repeated colors and their observed usage roles
- Extract and group typography styles
- Discover spacing, radius, border, shadow, and layout patterns
- Recognize repeated components across screens
- Merge visually identical component occurrences
- Separate genuinely observed variants
- Record visible states without generating missing ones
- Identify possible inconsistencies for curator review
- Connect every result to source screenshots and screen regions
- Support natural-language questions over the structured system

Examples of supported questions include:

- Where does this app use destructive buttons?
- Show every table empty state.
- Which screens use the compact navigation variant?
- Where is this spacing token used?

## Core User Journey

### Discover

The designer searches or filters the catalog for an application, pattern, screen, flow, component, or design-system characteristic.

### Explore

The designer opens an application and uses its overview to understand the overall visual language before drilling into screens, flows, components, or foundations.

### Inspect

The designer selects a token or component and sees its specification, observed variants, source screens, related tokens, and responsive behavior.

### Compare

The designer compares the same component, flow, or foundation across applications. Examples include table systems, navigation patterns, upgrade dialogs, or typography scales.

### Collect

The designer saves screens, flows, components, tokens, or complete application systems into project collections and adds research notes.

### Export

The designer exports selected items or the complete observed design system to Figma. Secondary formats are available when required.

## Figma Export

Figma is the primary export target for v1. The output must contain editable design assets rather than flattened screenshots.

A full-system export creates:

- Variable collections for colors, spacing, and radii
- Text styles and effect styles
- Auto-layout components
- Component variant sets based only on observed variants
- Responsive layout examples
- Foundations documentation
- Component-library documentation
- Source reference screens placed beside reconstructed assets

Designers can export:

- An entire application design system
- One foundation category
- One component family
- Selected components and screens

## Secondary Exports

Secondary export formats include:

- JSON design tokens
- CSS variables
- Tailwind theme configuration
- Component specifications
- Frontend component code

These outputs do not displace the designer-first Figma workflow in the primary interface.

## Catalog and Analysis Pipeline

### Capture

Internal curators collect real web screens, responsive viewports, visible states, and ordered flows. Each capture stores source URL, viewport, timestamp, and relevant state context.

### Screen analysis

The analysis pipeline extracts visible text, layout regions, colors, typography, spacing, components, icons, imagery, and interaction states.

### Cross-screen reconstruction

The system compares findings across all captured screens from the same application, merges duplicate occurrences, and preserves genuinely different variants.

### Flow reconstruction

Captured screens are organized into real user journeys. Every flow step must retain its source screen and observed transition.

### Evidence validation

Every design-system item must have at least one evidence occurrence. Unsupported results cannot be published.

### Curator review

An internal curator reviews naming, grouping, duplicate resolution, flow order, semantic-role assignment, and visibly incorrect measurements before publication.

## Data Model

### App

Stores application identity, category, website, and branding metadata.

### AppVersion

Represents a dated capture and analysis of an application. Updating an application creates a new version instead of overwriting historical evidence.

### Screen

Stores screenshot, URL, viewport, page type, visible state, capture context, and extracted analysis.

### Flow

Stores an ordered sequence of screens and observed interaction steps.

### FoundationToken

Stores an observed color, typography style, spacing value, radius, border, or effect.

### Component

Stores a reusable UI component identity and anatomy.

### ComponentVariant

Stores an observed variation or state of a component.

### EvidenceOccurrence

Connects a token, component, variant, or rule to a specific region of a source screen.

### Collection

Stores a designer's saved research references and notes.

### Export

Stores export scope, format, status, version, and generated output metadata.

## System Boundaries

### Capture pipeline

Collects and normalizes curated web screens and their context.

### Analysis pipeline

Produces screen-level structured observations.

### System reconstruction

Deduplicates findings across an application and creates evidence relationships.

### Catalog experience

Provides search, browsing, comparison, collections, and documentation.

### Export engine

Produces editable Figma libraries and secondary token or code formats from reviewed structured data.

These subsystems communicate through the structured catalog model. An export does not require reanalyzing source screenshots, and a catalog UI does not parse generated documentation to discover components.

## Accuracy and Review Model

Each published design-system item exposes:

- Supporting source screenshots
- Number of occurrences
- Last captured date
- Measurement confidence
- Review status
- Responsive viewports where it was observed

Low-confidence extraction remains queued for review rather than silently appearing as exact published data.

The UI must use wording such as:

> Complete observed design system reconstructed from 146 captured screens.

## Failure Handling

- Incomplete capture batches remain unpublished.
- Uncertain component matches are queued for curator review.
- Potential duplicate components remain separate until confirmed.
- A published item cannot lose its evidence relationship.
- Failed exports can be retried without rerunning application analysis.
- A new application capture creates a new AppVersion.
- Failed analysis of one screen does not corrupt previously reviewed application data.

## Quality and Testing Strategy

### Evidence invariants

- Every published token, component, variant, state, and rule has an EvidenceOccurrence.
- Every flow step references a captured Screen.
- Every component variant differs by an observed property.

### Extraction regression suite

A stable set of benchmark applications and screens verifies token extraction, component grouping, variant separation, flow reconstruction, and responsive classification after analysis changes.

### Curator workflow tests

Tests cover reviewing, merging, splitting, renaming, rejecting, and publishing extracted entities without losing evidence.

### Export verification

Figma exports are checked for editable variables, auto layout, component properties, variants, and source references. Secondary exports are checked against the same reviewed structured data.

### Catalog behavior tests

Tests cover search, filters, evidence navigation, comparison, collections, version switching, and access to export actions.

## Success Criteria

V1 succeeds when a product designer can:

1. Find a relevant curated web application or design pattern.
2. Understand the application's visual system without manually reviewing every screenshot.
3. Trace every design-system result back to real screens.
4. Compare components, flows, or foundations across applications.
5. Export an editable, evidence-backed Figma library.
6. Trust that Astryx distinguishes observed data from unavailable data.

## Deferred Roadmap

The following remain outside v1:

- Public or private app submission
- Self-service capture
- iOS and Android catalogs
- Automated generation of unobserved variants
- Community-contributed catalog entries

These extensions should reuse AppVersion, Screen, Flow, component, token, evidence, review, and export contracts rather than introduce a parallel product model.
