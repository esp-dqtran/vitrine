# Full-page assembly evidence

## React composition

`react-demo/src/App.jsx` is now a 94-line assembly root. It owns only shared
Studio state and composes the recovered components in downloaded source order:

```text
SiteNavigation
StudioChrome
main.page-main
├── HeroSection
├── ProblemSection
├── FeaturesSection
├── RepoExplorer section
├── ShowcaseSection
├── ReviewsSection
├── PricingSection
├── FaqSection
└── ClosingSection
SiteFooter
LearnMoreDrawer
```

The footer remains a sibling of the positioned main element, preserving the
downloaded sticky reveal and stacking context. Header, minimap, Studio panel,
and drawer remain fixed/portal chrome rather than layout children.

## Equal-viewport boundary verification

The current live reference and React reconstruction were reloaded and settled
at all four required viewports. Every boundary through the end of Pricing
matched; Closing also matched after accounting for the documented FAQ content
drift.

| Viewport | Last exact boundary before FAQ | React captured FAQ height | React closing height | React document height |
|---|---:|---:|---:|---:|
| 390 x 844 | Pricing bottom `10273.84375` | `1752.1640625` | `297.359375` | `12759.03125` |
| 1024 x 768 | Pricing bottom `10192.4140625` | `1640.015625` | `450.734375` | `12694` |
| 1159 x 863 | Pricing bottom `10346.296875` | `1615.515625` | `486.65625` | `12861` |
| 1280 x 720 | Pricing bottom `10089.6484375` | `1596.75` | `518.796875` | `12619.765625` |

The 1024 and 1159 Showcase boundaries differ from the final live compositor by
only `0.046875 px`; all child grid and card measurements match. At 1280, the
Showcase root, intro, copy, grid, and all cards are exact after removing one
stale local paragraph selector.

## Live-only FAQ drift

The immutable capture and `content.json` contain 16 FAQ items. The final live
reference now contains 17. The newly inserted live item is:

`Q.005 / Can I buy both editions?`

It adds exactly `73 px` to the FAQ and every later boundary at all four
viewports. The reconstruction intentionally retains the downloaded 16-item
identity and height rather than silently changing source snapshots during final
QA. This is a `live-only` content drift, not a React layout failure.

## Assembly result

- Section source order and page-builder markers match.
- Main-section boundaries match the downloaded component contracts at mobile,
  breakpoint, tall desktop, and wide desktop.
- Fixed header and minimap remain outside intrinsic page height.
- Sticky footer is a main sibling and accounts for the final document height.
- Drawer and Studio panel do not affect normal-flow geometry.
- All section implementations are dedicated React components; `App` is no
  longer a monolithic page implementation.

The assembly is complete. The complex Studio field paths and shared
SplitButton have also passed their page-level verification; details are
recorded in `studio-chrome.md`.
