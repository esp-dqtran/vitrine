# Mistral homepage offline download

Source: `https://mistral.ai/`

Captured with a real browser at desktop and mobile viewports after scrolling through the complete homepage so lazy-loaded assets could be observed.

## Open the downloaded page

- Open `mistral-homepage-desktop.mhtml` for the desktop page.
- Open `mistral-homepage-mobile.mhtml` for the mobile page.
- Run `npm start`, then open `http://127.0.0.1:4179/` for the local replay server.

The MHTML files are self-contained browser snapshots. The accompanying folders preserve the assets individually for later inspection and component reconstruction.

## Contents

- `mistral-homepage-desktop.mhtml`: self-contained desktop page.
- `mistral-homepage-mobile.mhtml`: self-contained mobile page.
- `desktop-full.png` and `mobile-full.png`: full-page visual evidence.
- `desktop-inventory.json` and `mobile-inventory.json`: URL-level asset inventories.
- `assets-desktop/` and `assets-mobile/`: CSS, fonts, images, and inline SVG exports.
- `first-party-extra/`: first-party JavaScript, WebAssembly, Lottie, and other observed resources.
- `assets-complete/`: complete same-origin DOM asset set, including every responsive `srcset` candidate.
- `supplemental-assets/`: the decorative noise image recovered after browser export omitted its response type.
- `raw.html`: original server response HTML.
- `robots.txt`: crawl policy captured with the download.

Third-party analytics resources are recorded in the inventories but are not copied into the individual-asset folders. They may still be embedded in the self-contained MHTML snapshot when the browser captured them.

This is the public deployed homepage, not Mistral's private source repository or backend.
