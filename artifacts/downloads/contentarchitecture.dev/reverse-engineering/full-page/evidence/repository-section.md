# Repository / IDE section evidence

Component: `repository-section` and its manifested children

Reconstruction:
`react-demo/src/components/RepoExplorer.jsx`

## Downloaded sources

- Captured DOM and initial Next.js state:
  `../../../2026-08-18T09-36-04-737Z/index.source.html`
- Repository loader and shared IDE behavior:
  `../../../2026-08-18T09-36-04-737Z/network-assets/f0f242b634222c280f79339e.js`
- Astro lazy-state supplement:
  `../../../2026-08-20-lazy-variants/network-assets/1dxb-dyj08pik.js`
- Supplement manifest:
  `../../../2026-08-20-lazy-variants/capture-manifest.json`
- Captured styles: files indexed by
  `../../../2026-08-18T09-36-04-737Z/network-assets-manifest.json`

The original capture did not activate the Astro tab. Its loader proves the
missing immutable chunk URL. The separately dated supplement preserves that
59987-byte response with headers and SHA-256
`424df3052a4a667c8cc9e1644aab8ecf7747f37c791c0e3638da3549eaf1e176`.
The original capture was not modified.

## Structure recovered

- dotted outer frame and inset IDE shell;
- Next.js and Astro edition controls;
- scrollable hierarchical file explorer with expandable folders;
- editable syntax-highlighted source area with synchronized line numbers;
- desktop editor minimap and viewport indicator;
- terminal, command history, completion, file links, and commit graph;
- horizontal, vertical, and corner resize controls;
- branch/update/commit status strip;
- file-search dialog and keyboard shortcuts.

The initial Astro README text and the visible Astro tree are taken from the
supplemented downloaded chunk. Offscreen file entries use concise local stub
content when their source body is not needed by the rendered initial state.

## Equal-viewport geometry

All values are CSS pixels. Source and React values were equal after font load,
reload, and state settlement.

| Viewport | IDE shell | Tree | Editor textarea |
|---|---|---|---|
| 390 x 844 | `22,77.70 346x688` | `22,111.70 207.59x626` | mobile editor; minimap hidden |
| 1024 x 768 | `88,87.88 848x592` | `88,121.88 240x530` | `375.50,159.20 496.50x289.67` |
| 1159 x 863 | `88,87.77 983x687` | `88,121.77 240x625` | `375.91,159.37 631.09x384.40` |
| 1280 x 720 | `88,87.76 1104x544` | `88,121.76 240x482` | `376.26,159.60 751.74x241.16` |

At 1159 x 863 the Astro state also matched the source shell, tree, and textarea
geometry: `88,414.77 983x687`, `88,448.77 240x625`, and
`375.91,486.37 631.09x384.40` respectively.

## Behavior checks

- switch Next.js to Astro and back;
- expand, collapse, and restore the `app` folder;
- open search, filter to `package.json`, and open the result;
- open files from both tree and terminal;
- edit the active document without losing the current mounted state;
- submit `git` and render the commit graph/status output;
- request the graph from the status strip;
- click and drag the minimap (`scrollTop` changed from 0 to 1043);
- resize the tree with pointer and keyboard (240 to 256 px keyboard check);
- resize the terminal and toggle it with both control and shortcut;
- close the search dialog with Escape.

The current live Next.js status has advanced to 128 commits. The reconstruction
retains the captured-era Next.js value of 119 rather than silently replacing
downloaded evidence with newer live content. The Astro status uses 60 commits,
validated with the supplemented Astro state.

## Result

The repository section passes DOM, style, behavior, responsive, accessibility,
and local-asset gates at the four required viewports. Its Astro evidence is a
separately dated lazy-state supplement because that tab was omitted from the
original interaction capture. This capture failure produced the deferred-state
rule now recorded in `REVERSE_ENGINEERING_RULES.md`.

