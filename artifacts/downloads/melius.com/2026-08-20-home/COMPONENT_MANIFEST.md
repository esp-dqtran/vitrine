# Melius homepage component manifest

This manifest is derived from the immutable `raw.html`, downloaded CSS/JS/media,
and live interaction checks made on 2026-08-20. It describes a frontend-only
React reconstruction; it does not reproduce Melius authentication, billing, or
server-side newsletter submission.

| Component | Evidence | Required local behavior |
| --- | --- | --- |
| `AnnouncementBar` | SSR DOM | Links the Seedance announcement to sign-up. |
| `SiteHeader` | SSR DOM + downloaded navigation chunk | Logo, desktop links, mobile Menu toggle, Sign In and Start for Free CTAs. |
| `HeroSection` | SSR DOM | Two-line headline and creative-director copy. |
| `CanvasShowcase` | SSR data payload + live check | Five selectable outcomes: Advertising, E-commerce, Filmmaking, Fashion, Branding. Changing a tab swaps the prompt, background, and positioned node graph. |
| `CanvasNode` | SSR data payload | Displays local image/video output with title, model, and media-type label. |
| `PersonaCarousel` | SSR DOM + live controls | Five personas with previous/next controls and persona buttons. |
| `ModelMarquee` | SSR DOM | Continuous list of available model providers. |
| `PricingSection` | SSR data payload + live check | Monthly/annual billing control changes the displayed plan prices. |
| `PricingCard` | SSR data payload | Creator, Growth, Professional and Enterprise plans with credits, feature list and CTA. |
| `FaqSection` | SSR data payload + live controls | Single expandable FAQ answer at a time. |
| `NewsletterFooter` | SSR DOM | Email field, local validation/success state, three link columns and legal/status content. |
| `FloatingSignupButton` | SSR DOM | Fixed bottom-right sign-up CTA. |

## Recovered visual foundations

- `Ease Standard`, `FG Futurist`, and `Reckless Standard` fonts are captured in
  `network-assets/` with the raw source stylesheets.
- The source page uses a dark, near-black surface with white editorial display
  typography and saturated orange call-to-action accents.
- The downloaded media includes the canvas output images, background videos,
  persona media and Melius coin imagery needed for the reconstructed homepage.

## Capture inventory

- `raw.html`: server-rendered Next.js page and React Flight data.
- `network-assets/`: 197 first-party resources: downloaded JavaScript chunks,
  stylesheets, fonts, hero/media images, and WebM videos.
- `capture-manifest.json`: source URLs, local asset paths, SHA-256 digests, byte
  counts, and content types.
