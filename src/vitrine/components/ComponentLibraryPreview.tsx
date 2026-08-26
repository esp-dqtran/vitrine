import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ComponentRecord } from '../componentLibraryCatalog.ts';
import { ContentArchitectureLivePreview } from './ContentArchitectureLivePreview.tsx';
import { CraftWildLivePreview, type CraftWildLiveComponentName } from './CraftWildLivePreview.tsx';
import { FlimLivePreview, type FlimLiveComponentName } from './FlimLivePreview.tsx';
import { MeliusAnimatedText } from './MeliusAnimatedText.tsx';
import { MeliusLivePreview } from './MeliusLivePreview.tsx';
import { OdometerWord, ReconstructedButtonPreview } from './ReconstructedButtonComponents.tsx';
import { TasteLabsLivePreview, type TasteLabsLiveComponentName } from './TasteLabsLivePreview.tsx';
import { OverlapTransitionDemo } from '../generated-components/overlap-transition/OverlapTransitionDemo.tsx';

function PreviewShell({
  item,
  children,
  surface,
}: {
  item: ComponentRecord;
  children: ReactNode;
  surface?: ComponentPreviewSurface;
}) {
  return (
    <div
      className={`component-preview-root${surface === 'full' ? ' component-preview-root--full' : ''}`}
      data-component-preview-name={item.name}
      data-component-preview-source={item.source.label}
    >
      {children}
    </div>
  );
}

type ComponentPreviewSurface = 'card' | 'full';

function ComponentPreviewViewport({
  children,
  className,
  fit = 'contain',
  fitFull = false,
  surface,
}: {
  children: ReactNode;
  className: string;
  fit?: 'contain' | 'fill' | 'width';
  fitFull?: boolean;
  surface: ComponentPreviewSurface;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(surface === 'card' ? 0.5 : 1);

  useEffect(() => {
    if ((surface === 'full' && !fitFull) || fit === 'fill') {
      setScale(1);
      return undefined;
    }

    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return undefined;

    const measure = () => {
      const contentWidth = content.offsetWidth;
      const contentHeight = content.offsetHeight;
      if (!contentWidth || !contentHeight) return;
      const widthScale = viewport.clientWidth / contentWidth;
      setScale(fit === 'width'
        ? Math.min(1, widthScale)
        : Math.min(1, widthScale, viewport.clientHeight / contentHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fit, fitFull, surface]);

  return (
    <div
      className={`component-preview-viewport component-preview-viewport--${surface} component-preview-viewport--${fit}${fitFull ? ' component-preview-viewport--fit-full' : ''} ${className}`}
      data-preview-fit={fit}
      data-preview-surface={surface}
      ref={viewportRef}
    >
      <div
        className="component-preview-viewport__content"
        ref={contentRef}
        style={{ '--component-preview-scale': scale } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

function DotGrid() {
  return <span aria-hidden="true" className="catalog-preview__dot-grid" />;
}

function MiniMedia({ warm = false }: { warm?: boolean }) {
  return <span aria-hidden="true" className={`catalog-preview__media ${warm ? 'catalog-preview__media--warm' : ''}`} />;
}

function AsciiPanel({ word = 'CONTENT' }: { word?: string }) {
  return (
    <span aria-hidden="true" className="catalog-preview__ascii">
      {Array.from({ length: 7 }, (_, index) => (
        <span key={index}>{`${word.slice(0, Math.max(2, 7 - index))}  ${'#+='.repeat(index + 2)}`}</span>
      ))}
    </span>
  );
}

const CA_MENU_LINKS = [
  { key: 'features', label: 'Features', href: '#features' },
  { key: 'the-repo', label: 'The Repo', href: '#the-repo' },
  { key: 'showcase', label: 'Showcase', href: '#showcase' },
  { key: 'pricing', label: 'Pricing', href: '#pricing', highlighted: true },
  { key: 'faq', label: 'FAQ', href: '#faq' },
  { key: 'blog', label: 'Blog', href: '#blog' },
] as const;

function CaMenuLogo({ className = '', sourceIconUrl }: { className?: string; sourceIconUrl: string }) {
  return (
    <img alt="The Content Architecture" className={className} src={sourceIconUrl} />
  );
}

function MenuAnnouncement({ compact = false }: { compact?: boolean }) {
  const repeats = compact ? 2 : 6;
  return (
    <div aria-label="Now available with Astro" className={compact ? 'ca-mobile-menu__announcement' : 'ca-desktop-menu__announcement'}>
      <span aria-hidden="true">
        {Array.from({ length: repeats }, (_, index) => <i key={index}>Now available with Astro</i>)}
      </span>
    </div>
  );
}

function MenuOdometer({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="ca-desktop-menu__odometer">
        {Array.from(label).map((character, index) => {
          if (character === ' ') return <span className="ca-desktop-menu__space" key={index}>&nbsp;</span>;
          const upper = character.toUpperCase();
          const glyphs = [character, String((index * 3 + 2) % 10), upper, String.fromCharCode(65 + ((index * 7 + 3) % 26)), 'W', character];
          return (
            <span className="ca-desktop-menu__character" key={`${character}-${index}`}>
              <span className="ca-desktop-menu__character-width">{character}</span>
              <span className="ca-desktop-menu__glyph-track" style={{ '--glyph-delay': `${index * 28}ms` } as CSSProperties}>
                {glyphs.map((glyph, glyphIndex) => <span key={glyphIndex}>{glyph}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );
}

function DesktopMenuCardPreview({
  sourceIconUrl,
  surface,
}: {
  sourceIconUrl: string;
  surface: ComponentPreviewSurface;
}) {
  return (
    <ComponentPreviewViewport className="ca-menu-preview ca-menu-preview--desktop" surface={surface}>
      <div className="ca-desktop-menu-frame">
        <div className="ca-desktop-menu">
          <ul className="ca-desktop-menu__links">
            <li className="ca-desktop-menu__home-item"><a aria-label="Home" href="#top" onClick={(event) => event.preventDefault()}><CaMenuLogo sourceIconUrl={sourceIconUrl} /></a></li>
            {CA_MENU_LINKS.map((link) => (
              <li key={link.key}>
                <a aria-current={link.key === 'showcase' ? 'true' : undefined} href={link.href} onClick={(event) => event.preventDefault()}>
                  <MenuOdometer label={link.label} />
                  {link.highlighted ? <span aria-hidden="true" className="ca-menu-status"><i /><b /></span> : null}
                </a>
              </li>
            ))}
          </ul>
          <MenuAnnouncement />
        </div>
      </div>
    </ComponentPreviewViewport>
  );
}

function MobileMenuCardPreview({
  sourceIconUrl,
  surface,
}: {
  sourceIconUrl: string;
  surface: ComponentPreviewSurface;
}) {
  const [open, setOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, []);

  return (
    <ComponentPreviewViewport className="ca-menu-preview ca-menu-preview--mobile" surface={surface}>
      <div className="ca-mobile-menu-frame" ref={rootRef}>
        <div className="ca-mobile-menu">
          <div className="ca-mobile-menu__header">
            <a aria-label="Home" className="ca-mobile-menu__home" href="#top" onClick={(event) => event.preventDefault()}><CaMenuLogo sourceIconUrl={sourceIconUrl} /></a>
            <button
              aria-controls={menuId}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="ca-mobile-menu__toggle"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <span>Menu</span>
              <span aria-hidden="true" className="ca-mobile-menu__toggle-icon"><i /><b className={open ? 'is-open' : ''} /></span>
            </button>
          </div>
          <div className={`ca-mobile-menu__collapsible ${open ? 'is-open' : ''}`} id={menuId}>
            <ul className="ca-mobile-menu__links">
              {CA_MENU_LINKS.map((link, index) => (
                <li key={link.key} style={{ '--menu-index': index } as CSSProperties}>
                  <a
                    aria-current={link.key === 'showcase' ? 'page' : undefined}
                    href={link.href}
                    onClick={(event) => { event.preventDefault(); setOpen(false); }}
                  >
                    <span>{link.label}</span>
                    {link.highlighted ? <span aria-hidden="true" className="ca-mobile-menu__pulse" /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <MenuAnnouncement compact />
        </div>
      </div>
    </ComponentPreviewViewport>
  );
}

export type MenuPreviewViewport = 'desktop' | 'mobile';

function ResponsiveMenuCardPreview({
  sourceIconUrl,
  viewport: controlledViewport,
  onViewportChange,
  showSwitch = true,
  surface,
}: {
  sourceIconUrl: string;
  viewport?: MenuPreviewViewport;
  onViewportChange?: (viewport: MenuPreviewViewport) => void;
  showSwitch?: boolean;
  surface: ComponentPreviewSurface;
}) {
  const [internalViewport, setInternalViewport] = useState<MenuPreviewViewport>('mobile');
  const viewport = controlledViewport ?? internalViewport;
  const setViewport = onViewportChange ?? setInternalViewport;
  const nextViewport = viewport === 'desktop' ? 'mobile' : 'desktop';

  return (
    <div className="ca-responsive-menu-preview">
      {showSwitch ? (
        <button
          aria-label={`Switch to ${nextViewport} preview`}
          className="ca-menu-view-switch"
          onClick={() => setViewport(nextViewport)}
          type="button"
        >
          <span>{viewport === 'desktop' ? 'Desktop' : 'Mobile'}</span>
          <span aria-hidden="true">↔</span>
        </button>
      ) : null}
      {viewport === 'desktop'
        ? <DesktopMenuCardPreview sourceIconUrl={sourceIconUrl} surface={surface} />
        : <MobileMenuCardPreview sourceIconUrl={sourceIconUrl} surface={surface} />}
    </div>
  );
}

function MeliusPreview({
  item,
  menuViewport,
  surface,
}: {
  item: ComponentRecord;
  menuViewport?: MenuPreviewViewport;
  surface: ComponentPreviewSurface;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [enabled, setEnabled] = useState(true);

  switch (item.name) {
    case 'AccordionContent':
      return <PreviewShell item={item}><div className="catalog-preview__accordion"><strong>What is Melius?</strong><p>One workspace for every creative model.</p></div></PreviewShell>;
    case 'BillingToggle':
      return <PreviewShell item={item}><button className="catalog-preview__segmented" onClick={() => setActive(active ? 0 : 1)} type="button"><span className={active === 0 ? 'is-active' : ''}>Monthly</span><span className={active === 1 ? 'is-active' : ''}>Yearly</span></button></PreviewShell>;
    case 'CanvasMediaFrame':
      return <PreviewShell item={item}><div className="catalog-preview__media-frame"><MiniMedia warm /><span>Generated image</span></div></PreviewShell>;
    case 'CanvasNodeCaption':
      return <PreviewShell item={item}><div className="catalog-preview__node-caption"><i />Campaign image <small>Flux 1.1 Pro</small></div></PreviewShell>;
    case 'ConsentSwitch':
      return <PreviewShell item={item}><button aria-pressed={enabled} className={`catalog-preview__switch ${enabled ? 'is-active' : ''}`} onClick={() => setEnabled(!enabled)} type="button"><i /></button></PreviewShell>;
    case 'FooterStatus':
      return <PreviewShell item={item}><div className="catalog-preview__status"><i />All systems operational</div></PreviewShell>;
    case 'HeroDescription':
      return <PreviewShell item={item}><p className="catalog-preview__hero-copy">Create images and videos with the world&apos;s best AI models.</p></PreviewShell>;
    case 'HeroHeadline':
      return <PreviewShell item={item}><h3 className="catalog-preview__hero-title">Make anything.<br /><em>All in one place.</em></h3></PreviewShell>;
    case 'MeliusLogo':
      return <PreviewShell item={item}><div className="catalog-preview__melius-logo"><i /><strong>MELIUS</strong></div></PreviewShell>;
    case 'MeliusTag':
      return <PreviewShell item={item}><span className="catalog-preview__tag">NEW MODEL</span></PreviewShell>;
    case 'MenuLink':
      return <PreviewShell item={item}><a className="catalog-preview__menu-link" href="#component-preview-menulink" onClick={(event) => event.preventDefault()}>Models <span>↗</span></a></PreviewShell>;
    case 'MenuToggle':
      return <PreviewShell item={item}><button aria-expanded={open} className={`catalog-preview__menu-toggle ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)} type="button"><span>{open ? 'Close' : 'Menu'}</span><i /><i /></button></PreviewShell>;
    case 'PersonaIndent':
      return <PreviewShell item={item}><div className="catalog-preview__indent"><span>01</span><i /><span>05</span></div></PreviewShell>;
    case 'PersonaMedia':
      return <PreviewShell item={item}><div className="catalog-preview__portrait"><MiniMedia /><span>FILMMAKER</span></div></PreviewShell>;
    case 'SegmentedTab':
      return <PreviewShell item={item}><button className={`catalog-preview__tab ${active ? 'is-active' : ''}`} onClick={() => setActive(active ? 0 : 1)} type="button">{active ? 'Selected' : 'Fashion'}</button></PreviewShell>;
    case 'TextLink':
      return <PreviewShell item={item}><a className="catalog-preview__text-link" href="#component-preview-textlink" onClick={(event) => event.preventDefault()}>Explore models <span>↗</span></a></PreviewShell>;
    case 'AnnouncementBar':
      return <PreviewShell item={item}><div className="catalog-preview__announcement"><span>NEW</span> Melius is now live <b>↗</b></div></PreviewShell>;
    case 'CanvasNode':
      return <PreviewShell item={item}><div className="catalog-preview__node"><header><i /> Image</header><MiniMedia warm /><footer>Campaign garment</footer></div></PreviewShell>;
    case 'CookieConsentBanner':
      return <PreviewShell item={item}><div className="catalog-preview__cookie"><strong>We value your privacy</strong><p>Choose how cookies are used.</p><div><button type="button">Reject</button><button type="button">Accept</button></div></div></PreviewShell>;
    case 'CookiePreferencesDialog':
      return <PreviewShell item={item}><div className="catalog-preview__dialog"><header>Privacy preferences <button type="button">×</button></header><p>Necessary</p><span className="catalog-preview__switch is-active"><i /></span><button className="catalog-preview__save" type="button">Save choices</button></div></PreviewShell>;
    case 'FaqAccordionItem':
      return <PreviewShell item={item}><button aria-expanded={open} className="catalog-preview__faq-row" onClick={() => setOpen(!open)} type="button"><span>Can I cancel anytime?</span><b>{open ? '−' : '+'}</b>{open ? <small>Yes, from your account settings.</small> : null}</button></PreviewShell>;
    case 'FooterLinkGroup':
      return <PreviewShell item={item}><div className="catalog-preview__link-group"><strong>Product</strong><a href="#models">Models</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div></PreviewShell>;
    case 'FooterMeta':
      return <PreviewShell item={item}><div className="catalog-preview__footer-meta"><span>© 2026 Melius</span><span>Privacy · Terms</span></div></PreviewShell>;
    case 'FooterWordmark':
      return <PreviewShell item={item}><strong className="catalog-preview__wordmark">MELIUS</strong></PreviewShell>;
    case 'NewsletterForm':
      return <PreviewShell item={item}><form className="catalog-preview__newsletter" onSubmit={(event) => event.preventDefault()}><input aria-label="Email address" placeholder="Email address" type="email" /><button type="submit">↗</button></form></PreviewShell>;
    case 'PersonaCard':
      return <PreviewShell item={item}><div className="catalog-preview__persona-card"><MiniMedia /><strong>Filmmaker</strong><span>Build cinematic worlds</span></div></PreviewShell>;
    case 'PersonaUseCaseField':
      return <PreviewShell item={item}><label className="catalog-preview__prompt-field"><span>Describe your idea</span><input defaultValue="A cinematic portrait..." /><button type="button">↗</button></label></PreviewShell>;
    case 'SegmentedTabBar':
      return <PreviewShell item={item}><div className="catalog-preview__tabbar">{['E-commerce', 'Filmmaking', 'Fashion'].map((label, index) => <button className={active === index ? 'is-active' : ''} key={label} onClick={() => setActive(index)} type="button">{label}</button>)}</div></PreviewShell>;
    case 'CanvasScene':
      return <PreviewShell item={item}><div className="catalog-preview__canvas"><DotGrid /><div className="catalog-preview__node catalog-preview__node--small"><header>Image</header><MiniMedia /></div><svg aria-hidden="true"><path d="M10 66 C70 66 54 20 120 20" /></svg></div></PreviewShell>;
    case 'CanvasShowcase':
      return <PreviewShell item={item}><div className="catalog-preview__canvas-showcase"><DotGrid /><div className="catalog-preview__tabbar"><button className="is-active" type="button">Branding</button><button type="button">Fashion</button></div><div className="catalog-preview__node catalog-preview__node--small"><MiniMedia warm /></div></div></PreviewShell>;
    case 'FaqSection':
      return <PreviewShell item={item}><div className="catalog-preview__section catalog-preview__section--faq"><h3>Frequently asked questions</h3><p>What is included?<b>+</b></p><p>Can I cancel?<b>+</b></p></div></PreviewShell>;
    case 'FooterEasterEgg':
      return <PreviewShell item={item} surface={surface}><ComponentPreviewViewport className="melius-live-preview-viewport" fit="contain" surface={surface}><MeliusLivePreview componentName="FooterEasterEgg" surface={surface} /></ComponentPreviewViewport></PreviewShell>;
    case 'HeroSection':
      return <PreviewShell item={item} surface={surface}><ComponentPreviewViewport className="melius-live-preview-viewport" fit="contain" surface={surface}><MeliusLivePreview componentName="HeroSection" surface={surface} /></ComponentPreviewViewport></PreviewShell>;
    case 'MeliusAnimatedText':
      return <PreviewShell item={item} surface={surface}><div className="melius-animated-text-preview"><MeliusAnimatedText text="MELIUS" /></div></PreviewShell>;
    case 'ModelWebGLCarousel':
      return <PreviewShell item={item} surface={surface}><ComponentPreviewViewport className="melius-live-preview-viewport" fit="contain" surface={surface}><MeliusLivePreview componentName="ModelWebGLCarousel" surface={surface} /></ComponentPreviewViewport></PreviewShell>;
    case 'PersonaStack':
      return <PreviewShell item={item} surface={surface}><ComponentPreviewViewport className="melius-live-preview-viewport" fit="contain" surface={surface}><MeliusLivePreview componentName="PersonaStack" surface={surface} /></ComponentPreviewViewport></PreviewShell>;
    case 'PricingSection':
      return <PreviewShell item={item}><div className="catalog-preview__pricing"><article><span>Essential</span><strong>$15</strong><button type="button">Start free</button></article><article className="is-featured"><span>Professional</span><strong>$35</strong><button type="button">Choose plan</button></article></div></PreviewShell>;
    case 'MenuCard':
      return <PreviewShell item={item} surface={surface}><ComponentPreviewViewport className="melius-live-preview-viewport" fit="contain" surface={surface}><MeliusLivePreview componentName="SiteHeader" surface={surface} viewport={menuViewport} /></ComponentPreviewViewport></PreviewShell>;
    default:
      return <PreviewShell item={item}><span>{item.name}</span></PreviewShell>;
  }
}

function CraftWildPreview({ item, surface }: { item: ComponentRecord; surface: ComponentPreviewSurface }) {
  return (
    <PreviewShell item={item} surface={surface}>
      <ComponentPreviewViewport className="craft-wild-live-viewport" fit="contain" surface={surface}>
        <CraftWildLivePreview componentName={item.name as CraftWildLiveComponentName} surface={surface} />
      </ComponentPreviewViewport>
    </PreviewShell>
  );
}

function TasteLabsPreview({ item, surface }: { item: ComponentRecord; surface: ComponentPreviewSurface }) {
  return (
    <PreviewShell item={item} surface={surface}>
      <ComponentPreviewViewport className="taste-labs-live-viewport" fit="contain" fitFull surface={surface}>
        <TasteLabsLivePreview componentName={item.name as TasteLabsLiveComponentName} surface={surface} />
      </ComponentPreviewViewport>
    </PreviewShell>
  );
}

function FlimPreview({ item, surface }: { item: ComponentRecord; surface: ComponentPreviewSurface }) {
  return (
    <PreviewShell item={item} surface={surface}>
      <ComponentPreviewViewport className="flim-live-viewport" fit={surface === 'card' ? 'width' : 'contain'} surface={surface}>
        <FlimLivePreview componentName={item.name as FlimLiveComponentName} surface={surface} />
      </ComponentPreviewViewport>
    </PreviewShell>
  );
}

function ContentArchitecturePreview({
  item,
  sourceIconUrl,
  menuViewport,
  onMenuViewportChange,
  showMenuViewportSwitch,
  surface,
}: {
  item: ComponentRecord;
  sourceIconUrl: string;
  menuViewport?: MenuPreviewViewport;
  onMenuViewportChange?: (viewport: MenuPreviewViewport) => void;
  showMenuViewportSwitch?: boolean;
  surface: ComponentPreviewSurface;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  switch (item.name) {
    case 'AsciiShowcaseCard':
    case 'ClosingAsciiPanel':
    case 'CommonProblemsPanel':
    case 'FeaturesSection':
    case 'GlyphField':
    case 'RepoExplorer':
    case 'TestimonialsCarousel':
    case 'ShowcaseSection':
    case 'SpiralScene':
    case 'StudioModeLauncher': {
      const widthFitComponents = ['FeaturesSection', 'TestimonialsCarousel', 'ShowcaseSection'];
      const fit = surface !== 'card'
        ? 'contain'
        : ['GlyphField', 'SpiralScene', 'TestimonialsCarousel'].includes(item.name)
          ? 'fill'
          : widthFitComponents.includes(item.name) ? 'width' : 'contain';
      return (
        <PreviewShell item={item} surface={surface}>
          <ComponentPreviewViewport className="content-architecture-live-viewport" fit={fit} surface={surface}>
            <ContentArchitectureLivePreview componentName={item.name} surface={surface} />
          </ComponentPreviewViewport>
        </PreviewShell>
      );
    }
    case 'ContentArchitectureLogo':
      return <PreviewShell item={item}><div className="catalog-preview__ca-logo"><i /><i /><i /><i /><i /><i /></div></PreviewShell>;
    case 'OdometerWord':
      return <PreviewShell item={item}><span className="catalog-preview__odometer"><OdometerWord>CONTENT</OdometerWord></span></PreviewShell>;
    case 'PullWindowHandle':
      return <PreviewShell item={item}><button className="catalog-preview__pull-handle" onClick={() => setActive(active ? 0 : 1)} type="button"><i /><i /><i /></button></PreviewShell>;
    case 'DesktopMenuCard':
      return <PreviewShell item={item}><ResponsiveMenuCardPreview onViewportChange={onMenuViewportChange} showSwitch={showMenuViewportSwitch} sourceIconUrl={sourceIconUrl} surface={surface} viewport={menuViewport} /></PreviewShell>;
    case 'LearnMoreDrawer':
      return <PreviewShell item={item}><button aria-expanded={open} className={`catalog-preview__drawer ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)} type="button"><span>{open ? 'CLOSE' : 'LEARN MORE'}</span><b>{open ? '−' : '+'}</b>{open ? <small>Content architecture details</small> : null}</button></PreviewShell>;
    case 'MobileMenuCard':
      return <PreviewShell item={item}><ResponsiveMenuCardPreview onViewportChange={onMenuViewportChange} showSwitch={showMenuViewportSwitch} sourceIconUrl={sourceIconUrl} surface={surface} viewport={menuViewport} /></PreviewShell>;
    case 'PullWindow':
      return <PreviewShell item={item}><div className="catalog-preview__pull-window"><AsciiPanel word="THE" /><button onClick={() => setActive(active ? 0 : 1)} type="button">{active ? '←' : '→'}</button></div></PreviewShell>;
    case 'SiteNavigation':
      return <PreviewShell item={item}><nav className="catalog-preview__ca-nav"><a href="#features">FEATURES</a><a href="#repo">THE REPO</a><a href="#showcase">SHOWCASE</a></nav></PreviewShell>;
    case 'StudioChrome':
      return <PreviewShell item={item}><div className="catalog-preview__studio"><header><i /><i /><i /><span>Sanity Studio</span></header><aside>Content<br />Media<br />Structure</aside><main /></div></PreviewShell>;
    case 'StudioSectionEditor':
      return <PreviewShell item={item}><div className="catalog-preview__editor"><label>Title<input defaultValue="Hero section" /></label><label>Layout<select defaultValue="Split"><option>Split</option></select></label><button type="button">Publish</button></div></PreviewShell>;
    case 'Terminal':
      return <PreviewShell item={item}><div className="catalog-preview__terminal"><span>$ npm create sanity@latest</span><span>✓ Project created</span><span>› Starting dev server_</span></div></PreviewShell>;
    case 'ClosingSection':
      return <PreviewShell item={item}><div className="catalog-preview__ca-section catalog-preview__ca-section--closing"><AsciiPanel word="BUILD" /><h3>Stop reinventing.<br />Start shipping.</h3></div></PreviewShell>;
    case 'FaqSection':
      return <PreviewShell item={item}><div className="catalog-preview__ca-section"><span>FAQ</span><h3>Questions,<br />answered.</h3><p>HOW DOES IT WORK? +</p></div></PreviewShell>;
    case 'HeroSection':
      return <PreviewShell item={item}><div className="catalog-preview__ca-section catalog-preview__ca-section--hero"><span>BUILT FOR AGENTIC DEVELOPMENT.</span><h3>The Sanity setup<br />agents don&apos;t reinvent.</h3><button type="button">GET ACCESS</button></div></PreviewShell>;
    case 'PricingSection':
      return <PreviewShell item={item}><div className="catalog-preview__ca-section"><span>PRICING</span><h3>One kit.<br />Every project.</h3><strong>$299</strong></div></PreviewShell>;
    case 'ProblemSection':
      return <PreviewShell item={item}><div className="catalog-preview__ca-section catalog-preview__ca-section--dark"><span>THE PROBLEM</span><h3>Every run invents<br />a new one.</h3></div></PreviewShell>;
    case 'SiteFooter':
      return <PreviewShell item={item}><div className="catalog-preview__ca-footer"><strong>CONTENT<br />ARCHITECTURE</strong><nav>FEATURES<br />REPO<br />PRICING</nav><small>© 2026</small></div></PreviewShell>;
    case 'App':
      return <PreviewShell item={item}><div className="catalog-preview__page"><header>MENU&nbsp;&nbsp;&nbsp; FEATURES&nbsp;&nbsp; REPO</header><main><h3>The Sanity setup<br />agents don&apos;t reinvent.</h3><AsciiPanel /></main></div></PreviewShell>;
    case 'BlogPage':
      return <PreviewShell item={item}><div className="catalog-preview__page catalog-preview__page--blog"><header>BLOG</header><main><article>BUILDING FOR AGENTS<br /><small>6 MIN READ</small></article><article>CONTENT AS CODE<br /><small>4 MIN READ</small></article></main></div></PreviewShell>;
    case 'AnimatedText':
      return <PreviewShell item={item}><button className="catalog-preview__animated-text" onClick={() => setActive((active + 1) % 3)} type="button" style={{ '--text-step': active } as CSSProperties}>SHIP<br /><span>SMARTER</span></button></PreviewShell>;
    case 'AsciiImage':
      return <PreviewShell item={item}><div className="catalog-preview__ascii-image"><AsciiPanel word="IMAGE" /></div></PreviewShell>;
    case 'AsciiPageTransition':
      return <PreviewShell item={item}><button className={`catalog-preview__transition ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)} type="button"><AsciiPanel word={open ? 'OPEN' : 'NEXT'} /></button></PreviewShell>;
    case 'AsciiTexture':
      return <PreviewShell item={item}><div className="catalog-preview__texture"><AsciiPanel word="CONTENT" /><AsciiPanel word="ARCH" /></div></PreviewShell>;
    case 'GlyphField':
      return <PreviewShell item={item}><button className="catalog-preview__glyph-field" onClick={() => setActive((active + 1) % 4)} type="button"><span style={{ transform: `translate(${active * 7}px, ${active * -4}px)` }}>{'#+*='.repeat(18)}</span></button></PreviewShell>;
    case 'GlyphFieldBackdrop':
      return <PreviewShell item={item}><div className="catalog-preview__glyph-backdrop"><AsciiPanel word="THE" /><strong>CONTENT ARCHITECTURE</strong></div></PreviewShell>;
    default:
      return <PreviewShell item={item}><span>{item.name}</span></PreviewShell>;
  }
}

export function ComponentLibraryPreview({
  item,
  sourceIconUrl,
  menuViewport,
  onMenuViewportChange,
  showMenuViewportSwitch,
  surface = 'card',
}: {
  item: ComponentRecord;
  sourceIconUrl: string | null;
  menuViewport?: MenuPreviewViewport;
  onMenuViewportChange?: (viewport: MenuPreviewViewport) => void;
  showMenuViewportSwitch?: boolean;
  surface?: ComponentPreviewSurface;
}) {
  if (item.category === 'button') {
    return <PreviewShell item={item}><ReconstructedButtonPreview name={item.name} /></PreviewShell>;
  }

  if (item.source.label === 'Flim') return <FlimPreview item={item} surface={surface} />;
  if (item.source.label === 'Details.so') return <PreviewShell item={item}><OverlapTransitionDemo /></PreviewShell>;
  if (item.source.label === 'Craft/Wild') return <CraftWildPreview item={item} surface={surface} />;
  if (item.source.label === 'Taste Labs') return <TasteLabsPreview item={item} surface={surface} />;
  if (item.source.label === 'Melius') return <MeliusPreview item={item} menuViewport={menuViewport} surface={surface} />;
  return <ContentArchitecturePreview item={item} menuViewport={menuViewport} onMenuViewportChange={onMenuViewportChange} showMenuViewportSwitch={showMenuViewportSwitch} sourceIconUrl={sourceIconUrl ?? ''} surface={surface} />;
}
