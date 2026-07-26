# Apps-led Vitrine Design System

## Source of truth

The current Apps discovery screen is the authoritative visual reference for
Vitrine. Sites and other member surfaces should use the same neutral palette,
Figtree typography, component anatomy, spacing rhythm, radii, and interaction
states. This work consolidates existing code; it does not introduce a new
visual direction.

## Foundation

Vitrine continues to use `@astryxdesign/core` and its neutral theme.

### Color

Dark-mode values used by the Apps screen:

| Role | Token | Value |
| --- | --- | --- |
| Page | `--color-background-body` | `#111112` |
| Surface/card | `--color-background-surface` | `#1F1F22` |
| Popover | `--color-background-popover` | `#28292C` |
| Muted | `--color-background-muted` | `#1111127F` |
| Primary text | `--color-text-primary` | `#DFE2E5` |
| Secondary text | `--color-text-secondary` | `#AAAFB5` |
| Disabled text | `--color-text-disabled` | `#6F747C` |
| Border | `--color-border` | `#F2F4F619` |
| Emphasized border | `--color-border-emphasized` | `#494D53` |
| Accent | `--color-accent` | `#2694FE` |

Application UI must use semantic tokens instead of new literal grays. Literal
colors remain allowed inside imported design-system examples and captured
content because those represent external evidence, not Vitrine chrome.

### Typography

- Family: `Figtree`, then system sans-serif.
- Facet heading: `14px / 500`.
- Facet option: `24px / 32px / 600`, `-.025em`; `20px` on compact screens.
- Toolbar/tab: `14px / 500`.
- Card title: `15px / 20px / 600`.
- Card description: `12px / 17px / 400`.
- Card metadata: `10px`, disabled text.
- Navigation identity: `18px / 600`, `-.03em`.

### Geometry and motion

- Global spacing follows the existing 4px Astryx scale.
- Top navigation: `72px`, `32px` horizontal padding.
- Discovery content: `32px` horizontal padding.
- Taxonomy: `29px` top, `73px` bottom, `48px` column gap.
- Ordering toolbar: `64px` high.
- Gallery columns: three desktop, two tablet, one compact.
- Card: `24px` radius.
- Card media: `14px` radius.
- Card logo: `44px`, `12px` radius.
- Active pills: full radius.
- Use the existing `180–260ms` transitions and honor reduced motion.

## Shared components

### Reference discovery navigation

`ReferenceDiscoveryTopNav` owns a stable generic class contract in addition to
the existing page hooks. Apps and Sites use the same three-column desktop
layout, full-width search trigger, identity tabs, account actions, and compact
two-row layout.

### Search trigger

`SearchTrigger` owns its layout class instead of inline width constraints.
Inside a discovery header it fills the center column on both Apps and Sites.

### Taxonomy

A shared `ReferenceDiscoveryFacetGroup` renders the heading and option buttons.
Apps and Sites retain their own data and hover-preview callbacks. The visual
contract is shared: typography, button states, spacing, and responsive sizing.
Sites Sections may keep its two-column item arrangement because it has twice
as many options; this is a content-layout variation, not a separate style.

### Ordering and platform controls

`ReferenceDiscoveryToolbar` remains the shared ordering component. Apps keeps
its Web/iOS/Android leading control; Sites has no platform control. Both use
the same colors, text states, underline motion, height, and overflow behavior.

### Cards and states

`DiscoveryCard` remains the single App/Site card shell. App and Site media may
use different aspect ratios and media behaviors, but identity, copy, metadata,
surface, radius, focus, and hover treatments are shared. Loading and empty
states use the same layout, token colors, and responsive grid.

## Scope for the rest of Vitrine

After Apps and Sites share the new contract, review member-facing Vitrine
surfaces for:

- literal chrome colors that should use semantic tokens;
- local Figtree or system-font declarations that should inherit globally;
- duplicate card, tab, search, empty-state, and navigation styling;
- inconsistent radii and spacing where an Astryx token or shared Vitrine
  primitive already exists.

Do not restyle imported design-system samples, captured screenshots, evidence
visualizations, or third-party brand content.

## Accessibility and failure behavior

- Preserve the current tablist, radio, link, button, and `aria-pressed`
  semantics.
- Preserve visible focus indicators.
- Primary and secondary text continue using the theme’s contrast-tested
  semantic tokens.
- Hover-only preview media remains decorative and hidden from assistive
  technology.
- Loading, error, and empty states retain status or alert roles.
- Compact layouts remain horizontally usable without hiding core controls.

## Verification

- Boundary tests prove Apps and Sites use the generic navigation, taxonomy,
  toolbar, card, and state contracts.
- Existing Apps, Sites, search, and card tests remain green.
- The production build succeeds.
- Same-viewport screenshots of Apps and Sites confirm matching navigation,
  search width, facet typography, toolbar styling, content padding, card
  identity, and responsive behavior.
- A literal-color audit excludes evidence/demo content and reports any
  remaining member-chrome exceptions explicitly.
