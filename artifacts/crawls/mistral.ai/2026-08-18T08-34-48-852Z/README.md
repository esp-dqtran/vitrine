# Mistral homepage crawl

Captured from `https://mistral.ai/` on 2026-08-18.

This package contains the publicly deployed homepage artifacts observed by the browser. It is not Mistral's original source repository and does not contain private source files, build configuration, or backend services.

## Contents

- `raw.html`: server-delivered homepage HTML.
- `rendered.html`: hydrated browser DOM.
- `desktop.dom.txt` and `mobile.dom.txt`: browser DOM snapshots.
- `desktop-1440x900.png` and `mobile-390x844.png`: full-page captures.
- `desktop-assets.json` and `mobile-assets.json`: observed asset inventories.
- `assets-desktop/` and `assets-mobile/`: downloaded CSS, fonts, images, and inline SVG exports.
- `scripts-first-party/`: downloaded first-party JavaScript bundles.
- `supplemental-assets/`: assets recovered separately when browser export metadata was incomplete.
- `crawl-manifest.json`: capture metadata.
- `checksums.sha256`: integrity hashes for primary evidence files.

Some document URLs remain absolute and can contact the live website if opened in a browser.
