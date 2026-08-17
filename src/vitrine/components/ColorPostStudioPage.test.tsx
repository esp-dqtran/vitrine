import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultColorPalettes } from '../../colorPalettes.ts';
import {
  ColorPostStudioPage,
  EventCanvasTheme,
  PaletteDots,
  applyCanvasTemplate,
  applyEventThemeToDocument,
  buildEventCalendarDays,
  canvasTemplateOptions,
  createInitialPostDocument,
  eventThemePresets,
  fontOptions,
  getTextListItems,
  normalizeFontSizeDraft,
  parseFontSizeDraft,
  resolveCanvasColorRoles,
  wrapCanvasText,
} from './ColorPostStudioPage.tsx';

test('renders a direct-manipulation social text editor', () => {
  const html = renderToStaticMarkup(
    <ColorPostStudioPage initialPaletteId="quiet-authority" />,
  );

  assert.match(html, /Post editor/);
  assert.match(html, /Quiet Authority/);
  assert.match(html, /1080 × 1350/);
  assert.match(html, /Double-click anywhere on the canvas to add text/);
  assert.match(html, /aria-label="Canvas formatting"/);
  assert.match(html, /aria-label="Event theme calendar"/);
  assert.match(html, /aria-label="Previous dates"/);
  assert.match(html, /aria-label="Next dates"/);
  assert.match(html, /World Photography Day/);
  assert.match(html, /World Humanitarian Day/);
  assert.match(html, /aria-label="Events on 2026-08-19"/);
  assert.match(html, /role="tab" aria-selected="true"/);
  assert.match(html, /darkroom-inspired editorial layout/);
  assert.match(html, /Use theme/);
  assert.match(html, /aria-label="Canvas history"/);
  assert.match(html, /aria-label="Undo"/);
  assert.match(html, /aria-label="Redo"/);
  assert.doesNotMatch(html, /color-post-editor__history/);
  assert.match(html, /aria-label="Format Heading"/);
  assert.match(html, /aria-label="Palette: Quiet Authority"/);
  assert.match(html, /color-post-editor__palette-trigger/);
  assert.match(html, /color-post-editor__palette-dots/);
  assert.match(html, /aria-label="Template: Halo Frame"/);
  assert.doesNotMatch(html, /color-post-editor__toolbar-label|Canvas color roles/);
  assert.match(html, /color-post-editor__stage--halo-frame/);
  assert.match(html, /aria-label="Background color"/);
  assert.match(html, /Copy image/);
  assert.doesNotMatch(html, /Download image/);
  assert.match(html, /Edit Heading/);
  assert.match(html, /aria-label="Font: Instrument Serif"/);
  assert.match(html, /aria-label="Font weight: Regular"/);
  assert.match(html, /aria-label="Bold"/);
  assert.match(html, /aria-label="Italic"/);
  assert.match(html, /aria-label="Bulleted list"/);
  assert.match(html, /aria-label="Numbered list"/);
  assert.match(html, /Bricolage Grotesque/);
  assert.match(html, /Instrument Serif/);
  assert.match(html, /Unbounded/);
  assert.match(html, /Fraunces/);
  assert.doesNotMatch(html, /Syne|Space Grotesk/);
  assert.doesNotMatch(html, /color-post-editor__post-(?:swatches|hexes)|Made with Vitrines/);
  assert.doesNotMatch(html, /Post formatting|Add text|aria-label="Layers"|<textarea|Open Threads|Open Instagram|Copy caption/);
});

test('uses the registered Fontsource family names for variable fonts', () => {
  assert.deepEqual(
    fontOptions.map(({ label, value }) => [label, value]),
    [
      ['Figtree', 'Figtree'],
      ['Bricolage Grotesque', 'Bricolage Grotesque Variable'],
      ['Instrument Serif', 'Instrument Serif'],
      ['Unbounded', 'Unbounded Variable'],
      ['Fraunces', 'Fraunces Variable'],
    ],
  );
});

test('renders all three palette colors in the dropdown preview', () => {
  const palette = defaultColorPalettes[0];
  const html = renderToStaticMarkup(<PaletteDots palette={palette} />);

  assert.equal((html.match(/style="background:/g) ?? []).length, 3);
  palette.cards.forEach((card) => assert.match(html, new RegExp(card.hex, 'i')));
});

test('creates an editable document from the selected palette', () => {
  const palette = defaultColorPalettes[0];
  const roles = resolveCanvasColorRoles(palette);
  const document = createInitialPostDocument(palette);

  assert.equal(document.backgroundId, palette.cards[0].id);
  assert.equal(document.templateId, 'halo-frame');
  assert.equal(document.layers.length, 2);
  assert.equal(document.layers[0].text, palette.name);
  assert.equal(document.layers[1].name, 'Heading');
  assert.equal(document.layers[1].color, roles.text.hex);
  assert.equal(document.layers[1].fontFamily, 'Instrument Serif');
  assert.equal(document.layers[1].fontWeight, 400);
  assert.equal(document.layers[1].fontStyle, 'normal');
  assert.equal(document.layers[1].listStyle, 'none');
});

test('turns multiline text into clean list items', () => {
  assert.deepEqual(
    getTextListItems('First point\n\n Second point \nThird point'),
    ['First point', 'Second point', 'Third point'],
  );
});

test('maps three palette colors to distinct canvas roles by contrast', () => {
  const palette = defaultColorPalettes[0];
  const roles = resolveCanvasColorRoles(palette);

  assert.equal(roles.background.id, palette.cards[0].id);
  assert.equal(roles.text.id, palette.cards[2].id);
  assert.equal(roles.border.id, palette.cards[1].id);
  assert.equal(new Set([roles.background.id, roles.text.id, roles.border.id]).size, 3);
});

test('offers three canvas templates with visibly different typography', () => {
  assert.deepEqual(
    canvasTemplateOptions.map(({ label, value }) => [label, value]),
    [
      ['Halo Frame', 'halo-frame'],
      ['Editorial Edge', 'editorial-edge'],
      ['Center Stage', 'center-stage'],
    ],
  );

  const palette = defaultColorPalettes[0];
  const document = createInitialPostDocument(palette);
  const roles = resolveCanvasColorRoles(palette);
  const centerStage = applyCanvasTemplate(document, 'center-stage', roles.text.hex);

  assert.equal(centerStage.layers[1].text, document.layers[1].text);
  assert.equal(centerStage.layers[1].fontFamily, 'Fraunces Variable');
  assert.equal(centerStage.layers[1].alignment, 'center');
  assert.equal(centerStage.layers[1].width, 720);
  assert.equal(centerStage.layers[1].color, roles.text.hex);
});

test('builds an eleven-day event calendar row', () => {
  const days = buildEventCalendarDays('2026-08-17');

  assert.equal(days.length, 11);
  assert.deepEqual(days[0], { key: '2026-08-17', weekday: 'Mon', day: '17', month: 'Aug' });
  assert.deepEqual(days.at(-1), { key: '2026-08-27', weekday: 'Thu', day: '27', month: 'Aug' });
});

test('ships a curated August and September event-theme library', () => {
  assert.equal(eventThemePresets.length, 20);
  assert.deepEqual(
    eventThemePresets.filter(({ date }) => date <= '2026-08-27').map(({ name, date }) => [name, date]),
    [
      ['World Photography Day', '2026-08-19'],
      ['World Humanitarian Day', '2026-08-19'],
      ['Victims of Terrorism Remembrance', '2026-08-21'],
      ['Victims of Religious Violence', '2026-08-22'],
      ['Slave Trade Remembrance Day', '2026-08-23'],
      ['World Lake Day', '2026-08-27'],
    ],
  );
  assert.equal(eventThemePresets.filter(({ date }) => date === '2026-08-19').length, 2);
  assert.ok(eventThemePresets.some(({ name, date }) => name === 'Venice Film Festival' && date === '2026-09-02'));
  assert.ok(eventThemePresets.some(({ name, date }) => name === 'International Translation Day' && date === '2026-09-30'));
  assert.deepEqual(
    new Set(eventThemePresets.map(({ themeStyle }) => themeStyle)),
    new Set(['contact-sheet', 'darkroom', 'horizon', 'premiere', 'peace']),
  );
  eventThemePresets.forEach((eventTheme) => assert.equal(eventTheme.palette.cards.length, 3));
});

test('renders a distinct canvas composition for every event theme', () => {
  eventThemePresets.forEach((eventTheme) => {
    const html = renderToStaticMarkup(<EventCanvasTheme themeStyle={eventTheme.themeStyle} />);
    assert.match(html, new RegExp(`event-canvas-theme--${eventTheme.themeStyle}`));
  });

  const contactSheet = renderToStaticMarkup(<EventCanvasTheme themeStyle="contact-sheet" />);
  assert.match(contactSheet, /color-post-editor__event-canvas-theme--contact-sheet/);
  assert.match(contactSheet, /ISO 400 · 1\/125 · ƒ2\.8/);
});

test('applies an event template without replacing the post heading', () => {
  const palette = defaultColorPalettes[0];
  const document = createInitialPostDocument(palette);
  const eventTheme = eventThemePresets[0];
  const themed = applyEventThemeToDocument(document, eventTheme);
  const roles = resolveCanvasColorRoles(eventTheme.palette);

  assert.equal(themed.templateId, 'editorial-edge');
  assert.equal(themed.eventThemeId, eventTheme.id);
  assert.equal(themed.backgroundId, roles.background.id);
  assert.equal(themed.layers[0].text, eventTheme.name);
  assert.equal(themed.layers[1].text, document.layers[1].text);
  assert.equal(themed.layers[1].fontFamily, 'Unbounded Variable');
  assert.equal(themed.layers[1].color, roles.text.hex);
});

test('wraps canvas text without dropping words', () => {
  const widths = (value: string) => ({ width: value.length * 10 } as TextMetrics);
  const lines = wrapCanvasText('Three colors, one atmosphere', 145, widths);

  assert.deepEqual(lines, ['Three colors,', 'one atmosphere']);
});

test('keeps partial font-size edits while accepting valid values', () => {
  assert.equal(parseFontSizeDraft(''), null);
  assert.equal(parseFontSizeDraft('7'), null);
  assert.equal(parseFontSizeDraft('72'), 72);
  assert.equal(parseFontSizeDraft('181'), null);
  assert.equal(normalizeFontSizeDraft('', 88), 88);
  assert.equal(normalizeFontSizeDraft('7', 88), 18);
  assert.equal(normalizeFontSizeDraft('220', 88), 180);
});
