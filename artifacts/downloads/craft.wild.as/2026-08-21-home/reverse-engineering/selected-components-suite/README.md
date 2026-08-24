# Craft selected components

Standalone React/Vite reconstruction of the selected DOM sections from
`https://craft.wild.as/`:

- `#hero` — responsive masthead and interactive pixel field
- `#work > .track-wrap` — case-study carousel with local source media
- `#process > .wrap` — four-stage animated process flow
- `#protocol-parts .reveal` — protocol flow canvas and four step cards
- `#lab > .track-wrap` — experiments carousel, tags, and local source media
- `#contact` — contact copy, mail links, ambient pixel field, and button effect
- `body > footer` — idle city strip and playable Tetris state

The implementation was derived from the saved source DOM, computed layout,
styles, assets, and JavaScript behavior. Every behavior is now owned by React
components and hooks; there are no injected runtime scripts or HTML fragment
injection. Screenshots in
`evidence/` are the visual QA layer, not the implementation source.

## Run

```sh
npm install
npm run dev
```

The verified local preview currently runs at `http://127.0.0.1:4175/`.

## Verify

```sh
npm run build
npm run test:react
npm run test:sites
```

See `REVERSE_ENGINEERING.md` for the source mapping and `design-qa.md` for
the comparison record.
