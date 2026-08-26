export type ComponentCategory =
  | 'button'
  | 'input'
  | 'toggle'
  | 'navigation'
  | 'card'
  | 'header'
  | 'footer'
  | 'form'
  | 'overlay'
  | 'section'
  | 'page'
  | 'media'
  | 'display'
  | 'effect';

export type ComponentSource =
  | { type: 'site'; label: string; query: string }
  | { type: 'app'; label: string; appId: string };

export interface ComponentRecord {
  id: string;
  name: string;
  category: ComponentCategory;
  purposes: string[];
  technologies: string[];
  source: ComponentSource;
}

export const COMPONENT_CATEGORIES: ReadonlyArray<{
  id: ComponentCategory;
  label: string;
  description: string;
}> = [
  { id: 'button', label: 'Button', description: 'Clickable actions and control buttons.' },
  { id: 'input', label: 'Input', description: 'Fields, handles and expandable input controls.' },
  { id: 'toggle', label: 'Checkbox & Toggle', description: 'Binary choices, tabs and segmented controls.' },
  { id: 'navigation', label: 'Navigation', description: 'Menus, links and navigation systems.' },
  { id: 'card', label: 'Card', description: 'Contained content and interactive cards.' },
  { id: 'header', label: 'Header', description: 'Site headers and announcement bars.' },
  { id: 'footer', label: 'Footer', description: 'Footer structures, links and supporting details.' },
  { id: 'form', label: 'Form', description: 'Forms and grouped data-entry experiences.' },
  { id: 'overlay', label: 'Modal & Drawer', description: 'Dialogs, drawers and layered interfaces.' },
  { id: 'section', label: 'Section', description: 'Complete blocks designed to sit inside a page.' },
  { id: 'page', label: 'Page', description: 'Full-page compositions and application templates.' },
  { id: 'media', label: 'Media', description: 'Image, video and interactive media viewers.' },
  { id: 'display', label: 'Display', description: 'Content, branding and data-display components.' },
  { id: 'effect', label: 'Effects & Motion', description: 'Canvas, WebGL and animated visual treatments.' },
];

const SOURCES = {
  melius: { type: 'site', label: 'Melius', query: 'Melius' },
  contentArchitecture: {
    type: 'site',
    label: 'Content Architecture',
    query: 'Content Architecture',
  },
  craftWild: {
    type: 'site',
    label: 'Craft/Wild',
    query: 'craft.wild.as',
  },
  tasteLabs: {
    type: 'site',
    label: 'Taste Labs',
    query: 'tastelabs.com',
  },
  flim: {
    type: 'site',
    label: 'Flim',
    query: 'flim.ai',
  },
  details: {
    type: 'site',
    label: 'Details.so',
    query: 'details.so',
  },
} as const satisfies Record<string, ComponentSource>;

function idFor(source: ComponentSource, name: string): string {
  return `${source.label}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function inferredPurposes(name: string, category: ComponentCategory): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('menu') || lower.includes('navigation') || lower.includes('drawer')) return ['Navigation'];
  if (lower.includes('button') || lower.includes('toggle') || lower.includes('tab')) return ['Action'];
  if (lower.includes('form') || lower.includes('consent') || lower.includes('accordion')) return ['Input', 'Feedback'];
  if (lower.includes('pricing') || lower.includes('billing')) return ['Commerce'];
  if (lower.includes('media') || lower.includes('image') || lower.includes('carousel')) return ['Media'];
  if (lower.includes('footer') || lower.includes('header') || lower.includes('hero')) return ['Navigation', 'Content'];
  if (category === 'effect') return ['Visual effect'];
  if (category === 'section' || category === 'page') return ['Content'];
  return ['Display'];
}

function inferredTechnologies(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower.includes('webgl') || lower.includes('spiral')) return ['React', 'WebGL'];
  if (lower.includes('canvas') || lower.includes('ascii') || lower.includes('glyph')) return ['React', 'Canvas'];
  if (lower.includes('media') || lower.includes('persona')) return ['React', 'CSS', 'Video'];
  return ['React', 'CSS'];
}

function records(
  source: ComponentSource,
  definitions: ReadonlyArray<readonly [name: string, category: ComponentCategory]>,
): ComponentRecord[] {
  return definitions.map(([name, category]) => ({
    id: idFor(source, name),
    name,
    category,
    purposes: inferredPurposes(name, category),
    technologies: inferredTechnologies(name),
    source,
  }));
}

export const COMPONENT_LIBRARY: readonly ComponentRecord[] = [
  ...records(SOURCES.melius, [
    ['AccordionContent', 'input'],
    ['BillingToggle', 'toggle'],
    ['CanvasMediaFrame', 'media'],
    ['CanvasNodeCaption', 'display'],
    ['ConsentSwitch', 'toggle'],
    ['FooterStatus', 'footer'],
    ['HeroDescription', 'display'],
    ['HeroHeadline', 'display'],
    ['MeliusButton', 'button'],
    ['MeliusLogo', 'display'],
    ['MeliusTag', 'display'],
    ['MenuLink', 'navigation'],
    ['MenuToggle', 'toggle'],
    ['PersonaIndent', 'display'],
    ['PersonaMedia', 'media'],
    ['SegmentedTab', 'toggle'],
    ['TextLink', 'navigation'],
    ['AnnouncementBar', 'header'],
    ['CanvasNode', 'card'],
    ['CookieConsentBanner', 'form'],
    ['CookiePreferencesDialog', 'overlay'],
    ['FaqAccordionItem', 'input'],
    ['FooterLinkGroup', 'footer'],
    ['FooterMeta', 'footer'],
    ['FooterWordmark', 'footer'],
    ['ModelCarouselControls', 'button'],
    ['NewsletterForm', 'form'],
    ['PersonaCard', 'card'],
    ['PersonaUseCaseField', 'input'],
    ['SegmentedTabBar', 'toggle'],
    ['CanvasScene', 'section'],
    ['CanvasShowcase', 'section'],
    ['FaqSection', 'section'],
    ['FooterEasterEgg', 'footer'],
    ['HeroSection', 'section'],
    ['ModelWebGLCarousel', 'media'],
    ['MeliusAnimatedText', 'effect'],
    ['PersonaStack', 'section'],
    ['PricingSection', 'section'],
    ['MenuCard', 'navigation'],
  ]),
  ...records(SOURCES.contentArchitecture, [
    ['ContentArchitectureLogo', 'display'],
    ['OdometerWord', 'display'],
    ['PullWindowHandle', 'input'],
    ['SplitButton', 'button'],
    ['AsciiShowcaseCard', 'card'],
    ['DesktopMenuCard', 'navigation'],
    ['LearnMoreDrawer', 'overlay'],
    ['MobileMenuCard', 'navigation'],
    ['PullWindow', 'display'],
    ['RepoExplorer', 'display'],
    ['SiteNavigation', 'navigation'],
    ['StudioModeLauncher', 'display'],
    ['StudioChrome', 'display'],
    ['StudioSectionEditor', 'display'],
    ['Terminal', 'display'],
    ['CommonProblemsPanel', 'card'],
    ['ClosingAsciiPanel', 'card'],
    ['ClosingSection', 'section'],
    ['FaqSection', 'section'],
    ['FeaturesSection', 'section'],
    ['HeroSection', 'section'],
    ['PricingSection', 'section'],
    ['ProblemSection', 'section'],
    ['TestimonialsCarousel', 'display'],
    ['ReviewsSection', 'section'],
    ['ShowcaseSection', 'section'],
    ['SiteFooter', 'footer'],
    ['App', 'page'],
    ['BlogPage', 'page'],
    ['AnimatedText', 'effect'],
    ['AsciiImage', 'media'],
    ['AsciiPageTransition', 'effect'],
    ['AsciiTexture', 'effect'],
    ['GlyphField', 'effect'],
    ['GlyphFieldBackdrop', 'effect'],
    ['SpiralScene', 'effect'],
  ]),
  ...records(SOURCES.craftWild, [
    ['HeroSection', 'section'],
    ['WorkCarouselSection', 'section'],
    ['ProcessFlowSection', 'section'],
    ['ProtocolPartsSection', 'section'],
    ['ExperimentsCarouselSection', 'section'],
    ['ContactSection', 'section'],
    ['TetrisFooter', 'section'],
  ]),
  ...records(SOURCES.tasteLabs, [
    ['TasteHeroSection', 'section'],
    ['TasteChallengeCarouselSection', 'section'],
    ['TasteMissionSection', 'section'],
    ['TasteStackSection', 'section'],
    ['TasteSwipeFooter', 'footer'],
  ]),
  ...records(SOURCES.flim, [
    ['FlimHeroSearchSection', 'section'],
    ['FlimWhatIsFlimSection', 'section'],
    ['FlimDatabaseScrollSection', 'section'],
  ]),
  ...records(SOURCES.details, [
    ['OverlapTransitionStage', 'effect'],
  ]),
];

const SIGNIFICANT_COMPONENT_IDS = new Set([
  'melius-menucard',
  'melius-meliusbutton',
  'melius-footereasteregg',
  'melius-herosection',
  'melius-modelwebglcarousel',
  'melius-meliusanimatedtext',
  'melius-personastack',
  'content-architecture-splitbutton',
  'content-architecture-asciishowcasecard',
  'content-architecture-desktopmenucard',
  'content-architecture-repoexplorer',
  'content-architecture-commonproblemspanel',
  'content-architecture-closingasciipanel',
  'content-architecture-testimonialscarousel',
  'content-architecture-glyphfield',
  'content-architecture-spiralscene',
  'craft-wild-herosection',
  'craft-wild-workcarouselsection',
  'craft-wild-processflowsection',
  'craft-wild-protocolpartssection',
  'craft-wild-experimentscarouselsection',
  'craft-wild-contactsection',
  'craft-wild-tetrisfooter',
  'taste-labs-tasteherosection',
  'taste-labs-tastechallengecarouselsection',
  'taste-labs-tastemissionsection',
  'taste-labs-tastestacksection',
  'taste-labs-tasteswipefooter',
  'flim-flimherosearchsection',
  'flim-flimwhatisflimsection',
  'flim-flimdatabasescrollsection',
]);

export const SIGNIFICANT_COMPONENT_LIBRARY: readonly ComponentRecord[] = COMPONENT_LIBRARY.filter(
  (component) => SIGNIFICANT_COMPONENT_IDS.has(component.id),
);

export function componentSourcePath(source: ComponentSource): string {
  return source.type === 'app'
    ? `/apps/${encodeURIComponent(source.appId)}`
    : `/sites?query=${encodeURIComponent(source.query)}`;
}
