import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPONENT_CATEGORIES,
  COMPONENT_LIBRARY,
  SIGNIFICANT_COMPONENT_LIBRARY,
  componentSourcePath,
} from './componentLibraryCatalog.ts';

test('organizes reconstructed sites into one practical component-family layer', () => {
  assert.equal(COMPONENT_LIBRARY.length, 90);
  assert.deepEqual(
    Object.fromEntries(COMPONENT_CATEGORIES.map(({ id }) => [
      id,
      COMPONENT_LIBRARY.filter((item) => item.category === id).length,
    ])),
    {
      button: 3,
      input: 4,
      toggle: 5,
      navigation: 6,
      card: 5,
      header: 1,
      footer: 7,
      form: 2,
      overlay: 2,
      section: 28,
      page: 2,
      media: 4,
      display: 15,
      effect: 6,
    },
  );
  assert.equal(new Set(COMPONENT_LIBRARY.map(({ id }) => id)).size, 90);
});

test('keeps the public showcase focused on significant standalone components', () => {
  assert.equal(SIGNIFICANT_COMPONENT_LIBRARY.length, 30);
  assert.equal(new Set(SIGNIFICANT_COMPONENT_LIBRARY.map(({ id }) => id)).size, 30);
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.every((component) => COMPONENT_LIBRARY.includes(component)));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'HeroSection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'SpiralScene'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'CommonProblemsPanel'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'AsciiShowcaseCard'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'ClosingAsciiPanel'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'TestimonialsCarousel'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'GlyphField'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-herosection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-workcarouselsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-processflowsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-protocolpartssection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-experimentscarouselsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-contactsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'craft-wild-tetrisfooter'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'taste-labs-tasteherosection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'taste-labs-tastechallengecarouselsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'taste-labs-tastemissionsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'taste-labs-tastestacksection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'taste-labs-tasteswipefooter'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'flim-flimherosearchsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'flim-flimwhatisflimsection'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'flim-flimdatabasescrollsection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-herosection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-pricingsection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-app'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-studiomodelauncher'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-featuressection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-showcasesection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-announcementbar'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-modelcarouselcontrols'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-cookieconsentbanner'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-cookiepreferencesdialog'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-canvasscene'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-canvasshowcase'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-pricingsection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'melius-faqsection'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-sitefooter'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ id }) => id === 'content-architecture-learnmoredrawer'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ id, name }) => id === 'melius-menucard' && name === 'MenuCard'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'StudioChrome'));
  assert.ok(SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'DesktopMenuCard'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'MobileMenuCard'));
  assert.ok(!SIGNIFICANT_COMPONENT_LIBRARY.some(({ name }) => name === 'AccordionContent'));
});

test('links component sources to the matching Site or App catalog surface', () => {
  assert.equal(
    componentSourcePath(COMPONENT_LIBRARY[0]!.source),
    '/sites?query=Melius',
  );
  assert.equal(
    componentSourcePath({ type: 'app', label: 'Linear', appId: 'linear' }),
    '/apps/linear',
  );
  const craftSource = COMPONENT_LIBRARY.find(({ id }) => id === 'craft-wild-protocolpartssection')!.source;
  assert.equal(componentSourcePath(craftSource), '/sites?query=craft.wild.as');
  const tasteSource = COMPONENT_LIBRARY.find(({ id }) => id === 'taste-labs-tastestacksection')!.source;
  assert.equal(componentSourcePath(tasteSource), '/sites?query=tastelabs.com');
  const flimSource = COMPONENT_LIBRARY.find(({ id }) => id === 'flim-flimherosearchsection')!.source;
  assert.equal(componentSourcePath(flimSource), '/sites?query=flim.ai');
});
