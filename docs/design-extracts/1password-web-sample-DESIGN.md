# 1Password Web — Sample DESIGN.md

> Evidence-backed sample extracted from three captured Web screens in Astryx.
> This is not 1Password's official design system. It describes publicly observed
> visual patterns and intentionally marks uncertain values as inferred.

## Evidence scope

| Evidence | Observed screen | Coverage |
| --- | --- | --- |
| `00acb5c939ecf96f` | Two-factor authentication modal | Modal, dimmed backdrop, destructive action, settings shell |
| `02c3b90f939fd01f` | Sign in to 1Password | Authentication form, QR sign-in, promotional side panel |
| `03abf2ee7646dd27` | My Profile | Header, navigation rail, form fields, cards, primary actions |

Three desktop screenshots are insufficient to prove mobile behavior, hover/focus
states, dark theme, complete typography metrics, or every component variant.

## Visual character

1Password Web uses a restrained productivity-app language: bright white content
surfaces, very light neutral navigation regions, thin cool-gray dividers, compact
controls, and a saturated blue reserved for important actions. Density is moderate:
the interface exposes substantial account information without visually merging
separate tasks.

## Color tokens

The values below are visually estimated from the captured thumbnails. A live DOM/CSS
inspection is required before treating the hex values as implementation constants.

```css
:root {
  --color-canvas: #ffffff;          /* observed, approximate */
  --color-surface-subtle: #f6f7f9; /* observed, approximate */
  --color-surface-tint: #eef3ff;   /* observed community panel */
  --color-text-primary: #1a1d23;   /* observed, approximate */
  --color-text-secondary: #5f6672; /* observed, approximate */
  --color-border: #d9dde5;         /* observed, approximate */
  --color-action-primary: #0875e1; /* observed 1Password blue, approximate */
  --color-action-danger: #c64a42;  /* observed destructive action, approximate */
  --color-backdrop: rgb(0 0 0 / 55%);
}
```

## Typography

- Interface voice: neutral, compact, functional, and low-decoration.
- Likely family: a system sans-serif or product sans. Exact family is not observable
  from the supplied thumbnails.
- Page titles are centered or aligned to the main content header and use medium to
  semibold weight.
- Section headings use stronger weight rather than large size jumps.
- Helper, metadata, and secondary navigation copy use muted gray and smaller sizes.
- Links and actionable inline text use the primary blue.

Suggested provisional scale for reconstruction:

| Token | Approximate value | Confidence |
| --- | --- | --- |
| `text-page-title` | 18–20px / 600 | medium |
| `text-section-title` | 14–16px / 600 | medium |
| `text-body` | 13–14px / 400 | medium |
| `text-supporting` | 11–12px / 400 | low |
| `text-button` | 12–13px / 500 | medium |

## Spacing and shape

Observed spacing appears to follow a compact 4px-derived rhythm:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-control: 4px;
  --radius-card: 6px;
  --radius-modal: 8px;
}
```

- Borders are thin and quiet; surface grouping does more work than shadows.
- Cards and fields use small radii rather than pill shapes.
- Primary buttons are compact and rectangular with lightly rounded corners.
- Large empty margins separate the main workspace from side rails.

## Layout patterns

### Account shell

- Slim global header with the 1Password mark at the left, current page title centered,
  and account identity at the right.
- Main workspace commonly uses three columns: left navigation, central task content,
  and a narrow contextual/account rail.
- The central column owns the strongest hierarchy and widest cards.
- Right-rail promotions use a pale warm or tinted surface distinct from account data.

### Authentication shell

- Brand mark sits near the left boundary of the main authentication column.
- Sign-in content is narrow and vertically centered within generous white space.
- A pale blue contextual panel occupies the right side and carries community content.
- Authentication methods are grouped into bordered cards; email entry is separated by
  a small `OR` divider.

### Modal behavior

- Modal is centered over the current settings page.
- Backdrop substantially dims the application while preserving enough context to show
  where the modal originated.
- Modal header separates title, step counter, and close/cancel action.
- Destructive or security-sensitive copy precedes the primary control.

## Components

### Primary button

- Saturated blue fill with white text.
- Compact height, modest horizontal padding, small radius.
- Used for Continue, Save, Edit Details, and focused task actions.
- Disabled, hover, focus, and loading appearances are not proven by this evidence set.

### Secondary and inline actions

- Secondary actions appear as blue text, subtle outlined buttons, or quiet neutral
  controls depending on importance.
- Destructive actions use red text or a red-accented control and should not share the
  primary blue treatment.

### Field

- White background with a cool-gray 1px border.
- Label sits above or inside the field group with compact supporting copy.
- Secret values support reveal/hide actions positioned at the trailing edge.

### Information card

- White surface with a thin gray border and small radius.
- Title/action row at the top; supporting content is aligned below.
- Cards remain mostly shadowless.

### Navigation rail

- Quiet text links stacked vertically.
- Current location is communicated with blue or stronger text emphasis.
- Related links remain visually subordinate to the central task.

### QR sign-in card

- Bordered instructional panel containing numbered steps and a QR code.
- QR code is visually prominent but does not compete with the page title.

## Do

- Keep content surfaces predominantly white and reserve blue for action and selection.
- Use thin dividers, compact controls, and strong alignment to organize dense settings.
- Separate task content, navigation, and contextual promotion into distinct columns.
- Keep security explanations close to the control they affect.
- Preserve visible evidence references when generating components from these rules.

## Do not

- Do not introduce heavy shadows, glass effects, gradients, or oversized radii.
- Do not use blue decoratively across large backgrounds; it is primarily an action color.
- Do not infer mobile collapse behavior from these desktop-only captures.
- Do not invent hover, focus, loading, validation, or disabled states without additional
  screenshots or live interaction evidence.
- Do not describe provisional token values as the original product's source tokens.

## Reconstruction confidence

| Area | Confidence | Reason |
| --- | --- | --- |
| Overall visual direction | high | Consistent across all three screens |
| Shell and column layout | high | Directly visible in sign-in and profile screens |
| Primary action treatment | high | Repeated blue buttons across captures |
| Field and card anatomy | medium | Visible but derived from thumbnail resolution |
| Exact colors and spacing | low | Estimated from thumbnails, not computed CSS |
| Typography family and metrics | low | Font metadata is unavailable |
| Interaction and responsive behavior | unknown | No live source page or mobile/state captures |

## Next evidence needed

1. One full-resolution profile screen for color, spacing, and typography measurement.
2. One focused or validation-error form state.
3. One mobile-width or narrow-window capture.
4. One navigation interaction and one loading state.
5. A live 1Password page, when permitted, for computed DOM/CSS extraction.
