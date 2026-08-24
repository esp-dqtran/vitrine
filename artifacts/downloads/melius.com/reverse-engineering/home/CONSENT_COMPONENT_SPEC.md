# Cookie Preferences dialog - downloaded-source component spec

Scope: the dialog opened by the footer's Cookie Preferences control. This is an implementation specification only. It does not replace the site's consent-management service, policies, or legal configuration.

Source of truth: the downloaded Melius capture at ../../2026-08-20-home/, served locally at http://localhost:4186/. All measurements below were taken from that local mirror, not the public site.

## Status and ownership boundary

| Part | Status | Evidence |
| --- | --- | --- |
| Footer trigger | Melius-owned wrapper | network-assets/18496ddd88e776d5853e.js defines ConsentDialogLink, which renders ConsentButton with action open-consent-dialog. |
| Dialog composition and product theme | Melius-owned configuration | network-assets/4318562d0de3211941a6.js supplies copy, three categories, theme tokens, footer layout, and outside-card dismissal. |
| Consent state machine, persistence, focus lock, script gating | Third-party consent runtime | Downloaded bundle contains c15t runtime code, marked with x-c15t-version: 2.2.0. It is initialized with mode hosted and backendURL /api/c15t. |
| Base dialog/switch/button CSS | Third-party runtime, themed by Melius | network-assets/33937522490f8ff3aa27.css contains the c15t classes; Melius augments it with the consent-* rules and theme data. |

Do not treat this as an ordinary visual-only component. A React reconstruction may reproduce the layout and expose onSave, onRejectAll, and onAcceptAll callbacks, but production consent persistence and conditional third-party script loading must remain an integration with the consent provider/API. Do not embed the downloaded tracker IDs, API keys, or remote tracker scripts in the React library.

## Public React contract

Use a controlled overlay component and keep data/persistence outside the presentational layer.

~~~tsx
type ConsentCategoryKey = "necessary" | "measurement" | "marketing"
type ConsentSelection = Record<ConsentCategoryKey, boolean>

type ConsentPreferencesDialogProps = {
  open: boolean
  selection: ConsentSelection
  onOpenChange(open: boolean): void
  onSelectionChange(next: ConsentSelection): void
  onSave(selection: ConsentSelection): void
  onRejectAll(): void
  onAcceptAll(): void
}
~~~

Required behavior:

- necessary always renders checked and disabled. It must never be changed by UI state, Reject all, or Save.
- measurement and marketing are independently switchable while the dialog is open.
- Save settings persists the current custom selection through onSave and closes the dialog.
- Reject all persists necessary=true, measurement=false, marketing=false and closes it.
- Accept all persists all three values as true and closes it.
- Closing by clicking outside the card changes only open; it must not persist the current selection.

## Content

The dialog provides one title, one explanatory sentence, three consent categories, and three actions.

The three labels are Strictly necessary, Analytics, and Marketing.

Strictly necessary: These cover signing in, security, and accessibility, and are always on.

Analytics: These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.

Marketing: These cookies may be set through our site by advertising partners, to build a profile of interests and show relevant ads on other sites.

## Source DOM and state machine

FooterLink: ConsentDialogLink renders ConsentButton with the open-consent-dialog action.

DialogRoot: a native dialog with open, aria-labelledby=consent-dialog-title, tabIndex=-1, and data-testid=consent-dialog-root. It is rendered into document.body with a separate presentation overlay.

Card: one vertical card containing Header, Content, a custom ConsentWidget, and its action footer.

CategoryList: source maps the displayed category array in this order: necessary, measurement, marketing. Each row contains a text block and a small role=switch button.

The source calls setSelectedConsent when a user flips Analytics or Marketing. This only changes the in-memory selection. Save invokes custom-consent; Reject invokes reject-consent; Accept invokes accept-consent.

## Verified interaction behavior

- Analytics and Marketing both expose role=switch, aria-checked, and data-state. Strictly necessary remains aria-checked=true and disabled.
- An on switch has a 28 by 16 track in rgb(119, 137, 88); its 10 by 10 white thumb translates 14px on the x axis. An off switch has track rgb(247, 246, 246) and no thumb translation.
- Track background and thumb transform each transition for 150ms with cubic-bezier(0.4, 0, 0.2, 1).
- Save settings closes the dialog, restores body overflow to visible, and a later opening preserves the saved custom state.
- Reject all closes the dialog and, when reopened, produces necessary=true, measurement=false, marketing=false.
- Accept all closes the dialog and, when reopened, produces all three true.
- Unsaved flips remain visible when the dialog is dismissed and reopened during the same page session, but they revert to the last persisted decision after a page reload. The React adapter should make this distinction explicit.
- Clicking the empty dialog root outside the card closes the dialog without saving. The click handler is in the downloaded Melius component. A direct click on the visual overlay is intercepted by the native full-viewport dialog; test the outside-card root area instead.
- Escape did not close the dialog in the downloaded local build. Do not add Escape dismissal unless the provider policy specifically requires it.
- The c15t dialog defaults trapFocus=true and scrollLock=true. While open, body overflow is hidden; on close it is visible again.

## Measured layout

All values are CSS pixels from the local mirror, at device scale factor 1.

### Desktop: 1280 by 720

- Overlay and native dialog root: viewport-sized 1280 by 720, fixed, z-index 1000000000. Overlay is rgba(0, 0, 0, 0.5). Root is flex-centered with 10px padding.
- Card: 448 by 320.945, centered at x=416 and y=199.523. It has a white surface, 1px rgb(217, 217, 217) border, 6px radius, and 0 1px 2px rgb(0 0 0 / 0.05) shadow.
- Header: 446 by 49.5 with 10px padding. Title is 600 12px/12px with -0.3px letter spacing. Description is 400 10px/13.5px, rgb(103, 103, 103), 2px top margin.
- Content: 446 by 269.445 with 0 10px 10px padding and vertical auto overflow.
- Category rows: 426px wide, 7px padding, 10px column gap, two columns of 372px and 28px. Their heights are 45.148, 59.648, and 74.148 respectively, separated by 8px.
- Footer: 426 by 40.5, top margin 24px and 10px top padding. Save settings is left aligned; Reject all and Accept all are right aligned as a pair with 16px gap.
- Desktop actions: Save 89.07 by 29.5; Reject 69.20 by 29.5; Accept 72.97 by 29.5.

### Mobile: 390 by 844

- Overlay and root remain viewport sized. Root has 7px padding.
- Card: 376 by 395.445, centered at x=7 and y=224.273.
- Header is 374 by 49.5. Content is 374 by 343.945 with the same 10px horizontal content padding.
- Category rows are 354px wide, use grid columns of 300px and 28px, and measure 59.648, 59.648, and 88.648 high. The narrower copy width accounts for the different wraps.
- Footer is 354 by 86 and stacks into two action groups. Save settings spans the whole 354px width. Reject all and Accept all form a second row with 169px equal-width buttons and 16px gap.

### Breakpoint: 640 by 844

At exactly 640px, the desktop arrangement applies: root padding 10px, card 448 by 320.945, horizontal 40.5px footer, and fixed-width action buttons. Implement the responsive switch at min-width: 640px.

## Visual tokens

- Font family: easeStandard, easeStandard Fallback, system-ui, sans-serif.
- Text: rgb(26, 22, 22). Muted text: rgb(103, 103, 103). Surface: rgb(255, 255, 255). Border: rgb(217, 217, 217).
- Primary hover: rgb(48, 42, 42). Surface hover/off switch: rgb(247, 246, 246). Active switch: rgb(119, 137, 88). White switch thumb and primary-button text: rgb(255, 255, 255).
- Typography scale: small 10px; base 11px; large 12px. Category title is 500 11px/12.65px. Category copy is 400 10px/14.5px.
- Spacing scale: 2px, 3px, 7px, 10px, 12px. Radius scale: 3px, 4px, 6px, and full pill.
- Dialog max width: 28rem. Dialog animation: opacity 150ms ease-out. Respect prefers-reduced-motion by removing those transitions.

## Suggested component hierarchy

~~~text
ConsentPreferencesDialog
  ConsentDialogOverlay
  native dialog root
    ConsentDialogCard
      ConsentDialogHeader
        ConsentDialogTitle
        ConsentDialogDescription
      ConsentCategoryList
        ConsentCategoryRow x 3
          ConsentCategoryCopy
          ConsentSwitch
      ConsentActionFooter
        Save settings
        Reject all
        Accept all
~~~

The footer control remains a separate, tiny component:

~~~text
ConsentDialogLink
  button action=open-consent-dialog
~~~

Keep focus locking, body scroll locking, persisted state, and conditional tracker loading in a ConsentProvider adapter. The presentational dialog only receives controlled props and reports events.

## Third-party integration requirements

The downloaded runtime names three categories: necessary, measurement, and marketing. It configures the local consent backend at /api/c15t and uses consent decisions to gate analytics and marketing vendor scripts. That production behavior is not reconstructable as a static React component alone.

Before production use, the integration owner must:

1. Confirm the approved consent provider and jurisdiction-specific policy.
2. Configure provider-side storage, expiration, and audit behavior.
3. Map the three UI categories to approved scripts and server-side services.
4. Ensure rejected or revoked categories actually stop future script loading and apply any provider-supported revocation mechanism.
5. Verify privacy and accessibility review, including native dialog semantics and keyboard navigation.

The source bundle shows outbound marketing vendors behind the consent layer, including Apollo, Clay, Unify, Snitcher, and RB2B. They are source evidence only; they must not be copied into a reconstructed component.

## Reconstruction verification checklist

- [ ] Footer Cookie Preferences opens the controlled dialog without changing the page URL.
- [ ] Desktop at 1280 by 720 matches the measured 448px card, centered geometry, row heights, and horizontal footer.
- [ ] Mobile at 390 by 844 matches the measured 376px card, 354px content width, and stacked action layout.
- [ ] 640px uses the desktop layout; widths below 640px use the mobile layout.
- [ ] Necessary is checked, disabled, visibly lower-opacity, and cannot be toggled.
- [ ] Analytics and Marketing each update aria-checked and switch visuals, including the 150ms track/thumb motion.
- [ ] Save persists a custom selection; Reject all persists only Necessary; Accept all persists all categories.
- [ ] Outside-card click closes without persisting; Escape has no close effect unless the approved consent-provider behavior says otherwise.
- [ ] Focus remains trapped while open, body scrolling is locked, and focus returns to the triggering footer button on close.
- [ ] Reduced-motion mode removes overlay/dialog and switch transitions.
- [ ] No marketing or analytics script is loaded merely because the visual dialog was rendered; script decisions come from the approved consent integration.

## Evidence index

- Downloaded implementation and Melius config: ../../2026-08-20-home/network-assets/4318562d0de3211941a6.js
- Consent action wrapper and footer trigger: ../../2026-08-20-home/network-assets/18496ddd88e776d5853e.js
- ConsentButton action dispatch: ../../2026-08-20-home/network-assets/5daf1accf809fa83e8a5.js
- Base c15t and Melius consent CSS: ../../2026-08-20-home/network-assets/33937522490f8ff3aa27.css
- Runtime validation surface: local downloaded mirror at http://localhost:4186/
