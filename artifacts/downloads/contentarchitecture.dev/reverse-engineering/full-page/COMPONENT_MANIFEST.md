# Content Architecture page component manifest

Primary evidence:

- `../../2026-08-18T09-36-04-737Z/raw.html`
- `../../2026-08-18T09-36-04-737Z/index.source.html`
- `../../2026-08-18T09-36-04-737Z/network-assets/`
- `../../2026-08-18T09-36-04-737Z/network-assets-manifest.json`
- `../../2026-08-18T09-36-04-737Z/desktop-inventory.json`
- `../../2026-08-18T09-36-04-737Z/mobile-inventory.json`
- `../../2026-08-20-blog-route/raw.html`
- `../../2026-08-20-blog-route/page-assets-inventory.json`
- `../../2026-08-20-blog-route/network-assets/`

Reconstruction: `react-demo/`

Status values follow `../../REVERSE_ENGINEERING_RULES.md`.

## Page tree

| ID | Parent | Downloaded source marker or anchor | Multiplicity | React target | Status |
|---|---|---|---:|---|---|
| `page` | — | document body | 1 | `App` | assembled; four-viewport section boundaries verified, current live FAQ drift documented |
| `site-header` | `page` | `data-studio-chrome="showHeader"` | 1 | `SiteNavigation` | verified; shared semantic shell, responsive frame, focus, and exact vector asset |
| `desktop-menu` | `site-header` | `nav[aria-label="Primary"]`, desktop branch | 1 | `DesktopMenuCard` | verified |
| `mobile-menu` | `site-header` | `button[aria-label="Open menu"]` | 1 | `MobileMenuCard` | verified |
| `header-ticker` | `site-header` | text `NOW AVAILABLE WITH ASTRO` | 1 | owned by menu cards | verified; source item widths, repetition count, distance, duration, and reduced motion |
| `page-minimap` | `page` | page config `showMinimap`, button `Inspect this page in Studio mode` | 1 | `StudioMinimap` in `StudioChrome` | verified; live DOM-scale canvas renderer and desktop activation gate |
| `studio-field-overlay` | `page-minimap` | buttons labeled `Edit FIELD`, sourced from `[data-studio-field]` | repeated | private child of `StudioChrome` | verified; geometry, selection, scroll/resize lifecycle, inert filtering |
| `studio-panel` | `page-minimap` | minimap action / Studio presentation state | 1 | `StudioPanel` in `StudioChrome` | verified; shell geometry, drag, focus return, Escape, tabs, and chrome switches |
| `studio-section-editor` | `studio-panel` | selected section manifest and field-type controls | 1 | `StudioSectionEditor` and private field children | verified; downloaded manifest, editable text/rich text, media/image, link, radio, boolean, arrays, and real item reordering |
| `main-hero` | `page` | `data-page-builder-section="mainHeroSection"` | 1 | `HeroSection` | verified |
| `hero-copy` | `main-hero` | eyebrow, `h1`, lede | 1 | `AnimatedText` children of `HeroSection` | verified, including font-ready responsive resplitting |
| `split-button` | repeated | links labeled `Get access` | repeated | `SplitButton` | verified; exact child geometry, accessible name, pulse, and nine-track hover odometer |
| `spiral-scene` | `main-hero` | hero visual canvas | 1 | `SpiralScene` | verified |
| `hero-stats` | `main-hero` | `NEXT 16.X`, `ASTRO 7.X`, `SANITY V6` | 1 | private child of `HeroSection` | verified |
| `hero-scroll-cue` | `main-hero` | `aria-label="Scroll to the next section"` | 1 | private child of `HeroSection` | verified; one viewport, 1.2s cubic scroll and reduced-motion branch reconstructed |
| `problems-section` | `page` | `data-page-builder-section="textTerminalSection"` | 1 | `ProblemSection` | verified |
| `problems-terminal` | `problems-section` | header `COMMON PROBLEMS` | 1 | `Terminal` inside `ProblemSection` | verified |
| `problem-row` | `problems-terminal` | numbered rows `001`–`011` | 11 | repeated row owned by `Terminal` | verified |
| `problems-copy` | `problems-section` | heading `The page builder alone costs you days` | 1 | private child of `ProblemSection` | verified |
| `features-section` | `page` | `data-page-builder-section="benefitsSection"` | 1 | `FeaturesSection` | verified |
| `glyph-field` | `features-section` | full-section animated field | 1 | `GlyphField` | verified, including atlas orientation, entrance, hover, ripple, and reduced-motion states |
| `glyph-field-backdrop` | `faq-section`, `site-footer` | non-interactive full-surface glyph canvases | 2 | `GlyphFieldBackdrop` | verified from downloaded shader, data, lifecycle, and render checks |
| `features-intro` | `features-section` | heading `Every decision already made` | 1 | private child of `FeaturesSection` | verified |
| `feature-item` | `features-section` | `data-studio-item="items.N"` | 9 | repeated feature item | verified |
| `repository-section` | `page` | `data-page-builder-section="ideSection"` | 1 | `RepoExplorer` | verified; Astro uses separately dated lazy-state supplement |
| `edition-tabs` | `repository-section` | `Open the Next.js repository`, `Open the Astro repository` | 2 | owned by `RepoExplorer` | verified; both variants reconstructed |
| `file-explorer` | `repository-section` | `aria-label="File explorer"` | 1 | owned by `RepoExplorer` | verified |
| `file-tree-item` | `file-explorer` | tree rows | repeated | owned by `RepoExplorer` | verified |
| `code-editor` | `repository-section` | `README.md contents` | 1 | owned by `RepoExplorer` | verified |
| `editor-minimap` | `code-editor` | `aria-label="Scroll via minimap"` | 1 | owned by `RepoExplorer` | verified; intentionally hidden below 640px |
| `repository-terminal` | `repository-section` | `aria-label="Terminal"` | 1 | owned by `RepoExplorer` | verified |
| `repository-resizers` | `repository-section` | three resize labels | 3 | owned by `RepoExplorer` | verified; pointer and keyboard |
| `repository-status` | `repository-section` | bottom IDE status strip | 1 | owned by `RepoExplorer` | verified; captured-era Next.js count retained |
| `showcase-section` | `page` | `data-page-builder-section="showcaseSection"` | 1 | `ShowcaseSection` | verified; intrinsic responsive layout and WebGL backdrop restored |
| `ascii-reveal-card` | `showcase-section` | showcase links with accessible project names | 11 | `AsciiShowcaseCard` | verified |
| `testimonials-section` | `page` | `data-page-builder-section="testimonialsSection"` | 1 | `ReviewsSection` | verified; intrinsic native scroll-snap carousel |
| `testimonial-card` | `testimonials-section` | `aria-label="N of 3: NAME"` | 3 | repeated review card | verified |
| `testimonial-controls` | `testimonials-section` | `Previous slide`, `Next slide` | 1 | owned by `ReviewsSection` | verified; buttons, manual scroll, disabled states, and live status |
| `pricing-section` | `page` | `data-page-builder-section="pricingSection"` | 1 | `PricingSection` | verified; intrinsic responsive layout and entry odometers |
| `trusted-row` | `pricing-section` | text `TRUSTED BY 30+ ENGINEERS` | 1 | private child of `PricingSection` | verified; local avatars and hover transition |
| `pricing-card` | `pricing-section` | Next.js and Astro editions | 2 | repeated pricing card | verified; shared markup, source-matched status/odometer states, and checkout links |
| `included-features` | `pricing-section` | heading `EVERY EDITION INCLUDES` | 1 | private child of `PricingSection` | verified; one mobile column and two desktop columns |
| `faq-section` | `page` | `data-page-builder-section="faqSection"` | 1 | `FaqSection` | verified |
| `faq-item` | `faq-section` | `data-studio-item="items.N"` | 16 | repeated FAQ item | verified |
| `closing-section` | `page` | `data-page-builder-section="calloutSection"` | 1 | `ClosingSection` | verified |
| `pull-window` | `closing-section` | draggable terminal wrapper and handle | 1 | `PullWindow` | verified; header-only pointer drag, elastic displacement, boundary state, and spring return |
| `closing-ascii-card` | `closing-section` | `pre[aria-label="The next 3 days are yours."]` | 1 | private child of `ClosingSection` | verified |
| `site-footer` | `page` | `data-studio-chrome="showFooter"` | 1 | `SiteFooter` | verified; geometry, reveal, stacking, navigation, backdrop, and newsletter client states |
| `newsletter-form` | `site-footer` | email input and submit control | 1 | private `NewsletterForm` child | verified client behavior; live server-list mutation replaced by documented deterministic local adapter |
| `footer-navigation` | `site-footer` | footer links | 1 | private child of `SiteFooter` | verified |
| `learn-more-drawer` | `page` | `data-studio-chrome="showDrawer"`, `role="dialog"` | 1 | `LearnMoreDrawer` | verified; portal dialog, measured navigation labels, local author media, focus trap/return, section scrolling, and responsive layout |
| `ascii-page-transition` | `page` | `canvas[data-ascii-curtain]` | 1 | `AsciiPageTransition` | verified; exact downloaded grid, noise, atlas, glyphs, 720ms cover/reveal, route commit, resize, cleanup, and reduced-motion fade |
| `blog-page` | `page` | route `/blog`, visible black `main` | 1 | `BlogPage` | verified; desktop/mobile equal-viewport geometry, shared chrome, sticky footer, and direct-route render |
| `blog-intro` | `blog-page` | `h1` and intro rich text | 1 | private child of `BlogPage` | verified |
| `blog-article-list` | `blog-page` | `section ul` | 1 | private list child of `BlogPage` | verified |
| `blog-article` | `blog-article-list` | `li.group > a` | 2 | repeated `BlogArticle` | verified; exact content, typography, rules, hover, metadata, and read action |

## Remaining evidence-driven correction

No required component gaps remain in the immutable home-page capture or the
separately dated Blog-route supplement. The current live page's additional FAQ
item remains documented as post-capture `live-only` content drift. Article
detail routes are explicitly outside the current Blog-index scope.
