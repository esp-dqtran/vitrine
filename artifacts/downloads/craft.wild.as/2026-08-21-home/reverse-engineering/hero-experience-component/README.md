# Craft hero experience extraction

A focused React reconstruction of the selected `section#hero` from
`https://craft.wild.as/`.

The visual component includes the source element's real composition boundary:

- the `section#hero` header DOM;
- the fixed `canvas#hero-kv` sibling that draws the interactive pixel field;
- the following `.intro` sibling, which overlaps the hero by `-24vh`.

All fonts, the Wild logo, layout rules, copy, and canvas behavior are bundled
locally. The project does not hotlink the source site.

## Run

```sh
npm install
npm run dev
```

## Verify

```sh
npm run build
npm run test:sites
```

## Main files

- `src/components/HeroExperience.jsx` — explicit React component structure
- `src/styles.css` — source-derived typography, geometry, responsive rules, and reveals
- `public/hero-runtime.js` — recovered pixel-field interaction runtime
- `REVERSE_ENGINEERING.md` — extraction evidence and component boundary
- `design-qa.md` — responsive and visual verification record
