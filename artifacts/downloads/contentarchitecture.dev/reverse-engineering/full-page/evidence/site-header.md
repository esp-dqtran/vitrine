# Site header evidence

## Downloaded implementation source

- Primary component chunk:
  `../../../2026-08-18T09-36-04-737Z/network-assets/5c2d1f0fb0e0bed6fa3a757c.js`
- Captured rendered document:
  `../../../2026-08-18T09-36-04-737Z/index.source.html`
- Stable root marker: `[data-studio-chrome="showHeader"]`
- Accessible navigation anchor: `nav[aria-label="Primary"]`
- The chunk owns `SiteNav`, its desktop and mobile branches, `DitherFrame`,
  `AnnouncementMarquee`, `OdometerHoverText`, the status pulse, active-section
  observation, mobile click-outside handling, and Escape dismissal.

## Reconstructed React ownership

- `react-demo/src/components/SiteNavigation.jsx`
- `react-demo/src/recovered/menu/DesktopMenuCard.jsx`
- `react-demo/src/recovered/menu/DesktopMenuCard.css`
- `react-demo/src/recovered/menu/MobileMenuCard.jsx`
- `react-demo/src/recovered/menu/MobileMenuCard.css`
- `react-demo/src/recovered/menu/ContentArchitectureLogo.jsx`

`SiteNavigation` owns the fixed page-level shell and the one accessible `nav`.
The responsive menu cards remain separate React branches inside the shared
dither frame because their structure and interaction differ at `1024 px`.

## DOM and responsive structure

The downloaded tree is preserved as:

```text
header[data-studio-chrome="showHeader"]
└── nav[aria-label="Primary"]
    └── shared dither frame
        ├── desktop menu (hidden below 1024px)
        └── mobile menu (hidden at and above 1024px)
```

Desktop contains the home mark, six odometer links, the Pricing pulse, and the
announcement ticker. Mobile contains a linked home mark, the Menu toggle, six
animated links, the same Pricing pulse, and its ticker. The toggle exposes
`aria-expanded`, `Open menu` / `Close menu`, and a controlled collapsible list.

## Exact geometry

Measured after fonts loaded and both documents settled:

| State | Downloaded source | React reconstruction |
|---|---:|---:|
| 1280x720 header root | `1280 x 108` at `(0, 0)` | `1280 x 108` at `(0, 0)` |
| 1280x720 nav/frame | `509.265625 x 76` at `(385.3671875, 16)` | exact |
| desktop link row | `485.265625 x 30` at `(397.3671875, 28)` | exact |
| desktop ticker | `485.265625 x 18` at `(397.3671875, 62)` | exact |
| 390x844 closed frame | `172 x 66` at `(8, 8)` | exact |
| 390x844 opened frame | `172 x 237.140625` at `(8, 8)` | exact |
| mobile toggle | `128 x 24` at `(42, 18)` | exact |
| first mobile link | `57.703125 x 27.0234375` at `(18, 51)` | exact |
| mobile ticker, open | `152 x 18` at `(18, 217.140625)` | exact |

The responsive caption font is the downloaded formula, producing
`13.4776 px / 16.8469 px` at 1280 and `12.0245 px / 15.0306 px` at 390.

## Recovered animation and behavior

- Desktop ticker distance: three `196.8046875 px` announcement items.
- Desktop ticker duration: `14759.765625 ms`, linear, infinite.
- Mobile ticker distance: one `196.8046875 px` item.
- Mobile ticker duration: `4919.921875 ms`, linear, infinite.
- Pricing status pulse: `1800 ms`; opacity `.5` at scale `1`, then opacity `0`
  and scale `2.6` from `75%` through `100%`, with
  `cubic-bezier(0, 0, 0.2, 1)`.
- Mobile collapse and plus-to-minus rotation: `320 ms`,
  `cubic-bezier(.7, 0, .25, 1)`.
- Mobile links: `320 ms`, `x: -8` to `0`, opacity `0` to `1`,
  `cubic-bezier(.23, 1, .32, 1)`, `80 ms` initial delay and `50 ms` stagger.
- Real pointer tests confirmed toggle open/close and outside-pointer dismissal.
- Escape closes the open menu while focus remains on the toggle.
- Selecting an in-page link closes the menu and delegates smooth section
  navigation to `SiteNavigation`.
- Reduced motion shortens collapse motion and removes marquee and pulse loops.

## Focus and asset proof

The focused Menu toggle matches the downloaded inset accent ring:
`inset 0 0 0 2px rgb(255, 145, 0)`. The icon keeps the downloaded 10% white
surface unless a real hover state applies.

The initial reconstruction used a 32px raster copy of the logo. Its root box
matched, but a high-density crop showed blurred diagonal bars. The final React
component now uses the exact `13,370`-character SVG path recovered from the
downloaded `SiteNav` chunk. Source and React vector crops now retain identical
sharp geometry in both the 24px mobile and 30px desktop slots.

## Verification result

The DOM, style, behavior, responsive, asset, accessibility, and assembled-page
gates pass for `site-header`, `desktop-menu`, `mobile-menu`, and
`header-ticker`.
