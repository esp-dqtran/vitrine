# Blog index page evidence

## Downloaded source

- URL: `https://www.contentarchitecture.dev/blog`.
- Supplement: `../../../2026-08-20-blog-route/`.
- Raw HTML SHA-256:
  `12a6c014cd97fd9c34a7bda7a0259255d2ab04cee0c9dba93619ffbbc1162a97`.
- The supplement contains the rendered DOM, raw response, response headers,
  page-asset inventory, 158 downloaded network assets, desktop/mobile states,
  menu state, and transition sequences.
- Fonts are the already-local Geist Sans and Geist Mono files shared with the
  home-page reconstruction.

## Component tree

| ID | Source anchor | React target |
| --- | --- | --- |
| `blog-route` | route `/blog` | `BlogPage` |
| `blog-header` | shared `header > nav` | `SiteNavigation` |
| `blog-index` | black `section` under the visible `main` | `BlogPage` section |
| `blog-intro` | `h1` plus two rich-text blocks | private intro child |
| `blog-list` | visible `ul` | private list child |
| `blog-article` | repeated `li.group > a` | `BlogArticle` |
| `blog-read-link` | mono `Read article` action | `ReadArticleLink` |
| `blog-minimap` | fixed `Inspect` overview | shared `StudioChrome` minimap |
| `blog-footer` | sticky shared footer | `SiteFooter` |

## Geometry and styling

- Desktop `1280 x 720`: the section uses `160px 80px` padding and a centered
  `920px` content column. The intro starts at `(180, 160)`, is 239px tall, and
  ends with a 15%-white rule. Article headings start at document y=463 and
  y=684.
- Mobile `390 x 844`: the section uses `100px 16px 72px`; the content width is
  358px. The title starts at y=100 and article headings at y=425 and y=684.
- Typography uses the downloaded fluid slope `(100vw - 375px) / 1225`, Geist
  Sans for body/headings, Geist Mono for metadata/actions, and the exact source
  grey/white opacity hierarchy.
- The footer remains a sticky layer below the black route main and uses the
  shared recovered glyph field, form, links, and reveal behavior.

## Behavior

- Blog is marked current in desktop and mobile navigation.
- Mobile menu open/close, Escape/outside-close behavior, ticker, current link,
  and responsive frame are inherited from the shared menu components.
- Article rows reproduce title, description, date/read time, hover dimming,
  action-color transition, and arrow motion. Article destinations remain the
  original public article URLs because the user requested the Blog index route,
  not the article-detail routes.
- Home, section, footer Blog, and Get access navigation go through the shared
  local route handler where applicable.

## Verification

- Desktop combined comparison:
  `../../../2026-08-20-blog-route/evidence/desktop-blog-source-vs-local.png`.
- Mobile combined comparison:
  `../../../2026-08-20-blog-route/evidence/mobile-blog-source-vs-local.png`.
- Mobile menu combined comparison:
  `../../../2026-08-20-blog-route/evidence/mobile-menu-source-vs-local.png`.
- Sticky footer combined comparison:
  `../../../2026-08-20-blog-route/evidence/desktop-footer-source-vs-local.png`.
- Local document height at `390 x 844` is 1369px, equal to the source capture.
- Local Blog main landmarks and headings match the source positions at both
  tested widths, with no horizontal overflow.

Status: verified.
