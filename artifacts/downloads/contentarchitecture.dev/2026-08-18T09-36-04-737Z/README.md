# Content Architecture homepage mirror

Source: `https://www.contentarchitecture.dev/`

The homepage was captured at desktop and mobile viewports after full-page scrolling. The site's robots policy allows the homepage for search/reference but disallows direct crawler requests to `/_next/`, `/api/`, and studio routes. This project therefore extracts only resources the normal browser loaded into its desktop/mobile MHTML captures; it does not recursively request disallowed paths.

`network-assets/` contains script, font, image, CSS, and RSC response bodies observed during those normal browser page loads. No disallowed route was recursively enumerated or fetched independently.

The default server mode fetches the current homepage document once per server run, then replays it with the captured local scripts, styles, and fonts. This keeps the canvas artwork, scroll animation, navigation, and showcase interactions visually aligned with the live page. The captured images remain included in the project; React may continue to use their original CDN URLs after hydration.

If the source document cannot be reached, the server falls back to the stable browser-captured HTML snapshot. You can force that offline snapshot with `http://127.0.0.1:4180/?mode=static`.

One Sanity CDN image referenced by the snapshot was not present in either browser archive; it was fetched directly from its public CDN URL and recorded in `supplemental-assets-manifest.json`.

## Run

```sh
npm start
```

Then open `http://127.0.0.1:4180/`.

Links to uncaptured pages redirect to the live website.
