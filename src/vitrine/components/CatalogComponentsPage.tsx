import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@astryxdesign/core';
import {
  COMPONENT_CATEGORIES,
  SIGNIFICANT_COMPONENT_LIBRARY,
  componentSourcePath,
  type ComponentCategory,
  type ComponentRecord,
} from '../componentLibraryCatalog.ts';
import { componentBundleFor } from '../componentBundles.ts';
import { updateLocation } from '../router.ts';
import { AppIcon } from './AppIcon.tsx';
import { ComponentLibraryPreview, type MenuPreviewViewport } from './ComponentLibraryPreview.tsx';
import { ComponentDeveloperDialog } from './ComponentDeveloperDialog.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';

type CategoryFilter = 'all' | ComponentCategory;
type ComponentCardLayout = 'compact' | 'standard' | 'wide' | 'immersive';

const SIGNIFICANT_CATEGORIES = COMPONENT_CATEGORIES.map((option) => ({
  ...option,
  count: SIGNIFICANT_COMPONENT_LIBRARY.filter((item) => item.category === option.id).length,
})).filter((option) => option.count > 0);

const MELIUS_MARK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.426 13.72"><path d="M18.51.671 14.99 2.156a13.58 13.58 0 0 1-10.552 0L.916.671A.66.66 0 0 0 0 1.283v11.156c0 .473.48.795.916.611l3.52-1.485a13.58 13.58 0 0 1 10.553 0l3.521 1.485a.66.66 0 0 0 .916-.611V1.283A.66.66 0 0 0 18.51.67m-1.28 7.372c-.54.97-1.682 1.423-2.751 1.136a4 4 0 0 1-.41-.135 2 2 0 0 1-.27-.13c-1.202-.66-2.538-1.034-3.91-1.034h-.353c-1.371 0-2.708.374-3.91 1.035a2 2 0 0 1-.27.129q-.2.08-.41.135c-1.069.286-2.21-.166-2.75-1.136a2.44 2.44 0 0 1-.06-2.253c.503-1.031 1.675-1.538 2.783-1.255q.245.063.479.157.14.058.271.135c1.182.677 2.534 1.006 3.898 1.006h.292c1.363 0 2.714-.329 3.897-1.006q.131-.077.272-.135.234-.095.479-.157c1.108-.282 2.28.224 2.783 1.255a2.44 2.44 0 0 1-.06 2.253"/></svg>')}`;
const CONTENT_ARCHITECTURE_MARK = 'data:image/png;base64,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';
const CRAFT_WILD_MARK = new URL(
  '../../../artifacts/downloads/craft.wild.as/2026-08-21-home/mirror/favicon.svg',
  import.meta.url,
).href;
const TASTE_LABS_APP_ICON = 'https://cdn.prod.website-files.com/6a1d5baf94efef5f7c435fc3/6a1da2ac3e6ba66f852367c6_clip.png';
const FLIM_APP_ICON = 'https://cdn.prod.website-files.com/695bc6699e9ebf7bc1099bbf/695bc6699e9ebf7bc1099cbd_icon.png';

function sourceIconUrl(source: ComponentRecord['source']): string | null {
  if (source.label === 'Melius') return MELIUS_MARK;
  if (source.label === 'Content Architecture') return CONTENT_ARCHITECTURE_MARK;
  if (source.label === 'Craft/Wild') return CRAFT_WILD_MARK;
  if (source.label === 'Taste Labs') return TASTE_LABS_APP_ICON;
  if (source.label === 'Flim') return FLIM_APP_ICON;
  return null;
}

function componentCardLayout(item: ComponentRecord): ComponentCardLayout {
  if (['ModelWebGLCarousel', 'RepoExplorer', 'StudioModeLauncher', 'CommonProblemsPanel', 'ClosingAsciiPanel', 'TestimonialsCarousel'].includes(item.name)) return 'immersive';
  if (item.name === 'AsciiShowcaseCard') return 'immersive';
  if (['button', 'input', 'toggle', 'overlay'].includes(item.category)) return 'compact';
  if (['navigation', 'header', 'footer'].includes(item.category)) return 'wide';
  if (['section', 'page', 'effect'].includes(item.category)) return 'immersive';
  return 'standard';
}

function sourceLogoClass(source: ComponentRecord['source']): string {
  if (source.label === 'Content Architecture') return 'component-library-card__logo--content-architecture';
  if (source.label === 'Melius') return 'component-library-card__logo--melius';
  if (source.label === 'Taste Labs') return 'component-library-card__logo--taste-labs';
  if (source.label === 'Flim') return 'component-library-card__logo--flim';
  if (source.label === 'Details.so') return 'component-library-card__logo--details';
  return 'component-library-card__logo--craft-wild';
}

function intrinsicPreviewRatio(item: ComponentRecord): string | undefined {
  if (item.source.label === 'Melius' && item.name === 'FooterEasterEgg') return '1280 / 900';
  if (item.source.label === 'Melius' && item.name === 'HeroSection') return '1280 / 900';
  if (item.source.label === 'Melius' && item.name === 'MeliusFooter') return '1280 / 760';
  if (item.source.label === 'Melius' && item.name === 'ModelWebGLCarousel') return '1280 / 900';
  if (item.source.label === 'Melius' && item.name === 'PersonaStack') return '1280 / 933';
  if (item.source.label === 'Craft/Wild' && item.name === 'HeroSection') return '1280 / 720';
  if (item.source.label === 'Craft/Wild' && item.name === 'WorkCarouselSection') return '1280 / 720';
  if (item.source.label === 'Craft/Wild' && item.name === 'ProcessFlowSection') return '1280 / 820';
  if (item.source.label === 'Craft/Wild' && item.name === 'ProtocolPartsSection') return '1280 / 620';
  if (item.source.label === 'Craft/Wild' && item.name === 'ExperimentsCarouselSection') return '1280 / 980';
  if (item.source.label === 'Craft/Wild' && item.name === 'ContactSection') return '1280 / 920';
  if (item.source.label === 'Craft/Wild' && item.name === 'TetrisFooter') return '1280 / 390';
  if (item.source.label === 'Taste Labs' && item.name === 'TasteHeroSection') return '1280 / 880';
  if (item.source.label === 'Taste Labs' && item.name === 'TasteChallengeCarouselSection') return '1280 / 780';
  if (item.source.label === 'Taste Labs' && item.name === 'TasteMissionSection') return '1280 / 650';
  if (item.source.label === 'Taste Labs' && item.name === 'TasteStackSection') return '1280 / 970';
  if (item.source.label === 'Taste Labs' && item.name === 'TasteSwipeFooter') return '1280 / 720';
  if (item.source.label === 'Flim' && item.name === 'FlimHeroSearchSection') return '1057 / 728';
  if (item.source.label === 'Flim' && item.name === 'FlimWhatIsFlimSection') return '846 / 1913';
  if (item.source.label === 'Flim' && item.name === 'FlimDatabaseScrollSection') return '2114 / 994';
  if (item.source.label === 'Details.so' && item.name === 'OverlapTransitionStage') return '16 / 9';
  if (item.name === 'RepoExplorer') return '1280 / 900';
  if (item.name === 'SpiralScene') return '1000 / 900';
  if (item.name === 'GlyphField') return '1280 / 900';
  if (item.name === 'TestimonialsCarousel') return '1280 / 850';
  if (item.name === 'ClosingAsciiPanel') return '1280 / 540';
  return undefined;
}

function PhonePreviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <rect height="15" rx="1.5" width="9" x="5.5" y="2.5" />
      <path d="M8.5 15h3" />
    </svg>
  );
}

function DesktopPreviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <rect height="10.5" rx="1.5" width="15" x="2.5" y="3" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  );
}

function ComponentPreviewDialog({
  displayName,
  item,
  menuViewport,
  onClose,
  onMenuViewportChange,
}: {
  displayName: string;
  item: ComponentRecord;
  menuViewport?: MenuPreviewViewport;
  onClose: () => void;
  onMenuViewportChange?: (viewport: MenuPreviewViewport) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeFromDialog = () => onClose();
    const closeFromCancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialog.open) dialog.close();
    };

    document.body.style.overflow = 'hidden';
    dialog.addEventListener('close', closeFromDialog);
    dialog.addEventListener('cancel', closeFromCancel);
    document.addEventListener('keydown', closeFromKeyboard);
    dialog.showModal();
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener('close', closeFromDialog);
      dialog.removeEventListener('cancel', closeFromCancel);
      document.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [onClose]);

  return (
    <dialog
      aria-label={`${displayName} full component`}
      className="component-preview-dialog"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) event.currentTarget.close();
      }}
      ref={dialogRef}
    >
      <header className="component-preview-dialog__header">
        <div>
          <span>Component</span>
          <h2>{displayName}</h2>
        </div>
        <form method="dialog">
          <button aria-label="Close full component" ref={closeRef} type="submit">×</button>
        </form>
      </header>
      <div className="component-preview-dialog__canvas">
        <ComponentLibraryPreview
          item={item}
          menuViewport={menuViewport}
          onMenuViewportChange={onMenuViewportChange}
          sourceIconUrl={sourceIconUrl(item.source)}
          surface="full"
        />
      </div>
    </dialog>
  );
}

function ComponentCard({ item }: { item: ComponentRecord }) {
  const href = componentSourcePath(item.source);
  const bundle = componentBundleFor(item.id);
  const displayName =
    item.name === 'OverlapTransitionStage'
      ? 'Overlap Transition Stage'
      : item.name === 'MeliusButton'
      ? 'Button'
      : item.name === 'FooterEasterEgg'
        ? 'Footer'
        : item.name === 'HeroSection' ||
            item.name === 'ModelWebGLCarousel' ||
            item.name === 'PersonaStack'
          ? 'Section'
          : item.name === 'MenuCard' ||
              item.name === 'DesktopMenuCard' ||
              item.name === 'MobileMenuCard'
            ? 'Navigation'
            : item.name;
  const isMenuCard = item.name === 'MenuCard' || item.name === 'DesktopMenuCard' || item.name === 'MobileMenuCard';
  const cardLayout = componentCardLayout(item);
  const previewRatio = intrinsicPreviewRatio(item);
  const [menuViewport, setMenuViewport] = useState<'desktop' | 'mobile'>('mobile');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const openPreviewRef = useRef<HTMLButtonElement>(null);
  const openDeveloperRef = useRef<HTMLButtonElement>(null);
  const closePreview = () => {
    setPreviewOpen(false);
    requestAnimationFrame(() => openPreviewRef.current?.focus());
  };
  const closeDeveloper = () => {
    setDeveloperOpen(false);
    requestAnimationFrame(() => openDeveloperRef.current?.focus());
  };

  return (
    <article
      aria-label={`${displayName} component card`}
      className={`component-library-card component-library-card--${cardLayout} discovery-card`}
      data-component-id={item.id}
      data-preview-layout={cardLayout}
      data-preview-ratio={previewRatio ? 'intrinsic' : undefined}
      data-preview-viewport={isMenuCard ? menuViewport : undefined}
      data-reference-component="component-card"
      style={previewRatio ? { '--component-library-preview-ratio': previewRatio } as CSSProperties : undefined}
    >
      <div className="component-library-card__media discovery-card__media">
        {isMenuCard ? (
          <div className="component-library-card__media-topline">
            <div
              aria-label="Menu preview viewport"
              className="component-library-card__viewport-switcher"
              data-viewport={menuViewport}
              role="group"
            >
              <button
                aria-label="Show mobile preview"
                aria-pressed={menuViewport === 'mobile'}
                className="component-library-card__viewport-option"
                onClick={() => setMenuViewport('mobile')}
                type="button"
              >
                <PhonePreviewIcon />
              </button>
              <button
                aria-label="Show desktop preview"
                aria-pressed={menuViewport === 'desktop'}
                className="component-library-card__viewport-option"
                onClick={() => setMenuViewport('desktop')}
                type="button"
              >
                <DesktopPreviewIcon />
              </button>
            </div>
          </div>
        ) : null}
        <ComponentLibraryPreview
          item={item}
          menuViewport={isMenuCard ? menuViewport : undefined}
          onMenuViewportChange={isMenuCard ? setMenuViewport : undefined}
          showMenuViewportSwitch={!isMenuCard}
          sourceIconUrl={sourceIconUrl(item.source)}
        />
      </div>

      <div className="component-library-card__identity discovery-card__identity">
        <a
          aria-label={`Open ${item.source.label}, the source for ${item.name}`}
          className="component-library-card__source-link"
          href={href}
          onClick={(event) => {
            event.preventDefault();
            updateLocation(href);
          }}
        >
          <AppIcon
            className={[
              'component-library-card__logo discovery-card__logo',
              sourceLogoClass(item.source),
            ].join(' ')}
            data-component-source-type={item.source.type}
            name={item.source.label}
            iconUrl={sourceIconUrl(item.source)}
            size={44}
            fit="contain"
            fallbackTextColor="var(--color-text-primary)"
          />
        </a>
        <button
          aria-label={`Open full ${displayName} component`}
          className="component-library-card__open"
          onClick={() => setPreviewOpen(true)}
          ref={openPreviewRef}
          type="button"
        >
          <strong>{displayName}</strong>
          <span aria-hidden="true">↗</span>
        </button>
        {bundle ? (
          <Button
            className="component-library-card__generate"
            label="Generate React"
            onClick={() => setDeveloperOpen(true)}
            ref={openDeveloperRef}
            variant="secondary"
          />
        ) : null}
      </div>

      {previewOpen ? (
        <ComponentPreviewDialog
          displayName={displayName}
          item={item}
          menuViewport={isMenuCard ? menuViewport : undefined}
          onClose={closePreview}
          onMenuViewportChange={isMenuCard ? setMenuViewport : undefined}
        />
      ) : null}
      {developerOpen && bundle ? (
        <ComponentDeveloperDialog
          bundle={bundle}
          item={item}
          onClose={closeDeveloper}
          sourceIconUrl={sourceIconUrl(item.source)}
        />
      ) : null}
    </article>
  );
}

export function ComponentsPage() {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const items = useMemo(() => SIGNIFICANT_COMPONENT_LIBRARY.filter((item) => (
    (category === 'all' || item.category === category)
  )), [category]);

  const sourceGroups = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      items: ComponentRecord[];
      source: ComponentRecord['source'];
    }>();

    for (const item of items) {
      const id = `${item.source.type}:${item.source.label}`;
      const group = groups.get(id);
      if (group) group.items.push(item);
      else groups.set(id, { id, items: [item], source: item.source });
    }

    return [...groups.values()];
  }, [items]);

  return (
    <div className="component-library" data-component-library="true">
      <DiscoveryPageLayout
        kind="components"
        header={null}
        taxonomyLabel="Component categories"
        taxonomy={(
          <ReferenceDiscoveryFacetGroup label="Components" className="component-library__facet">
            <button
              type="button"
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              All <span>{SIGNIFICANT_COMPONENT_LIBRARY.length}</span>
            </button>
            {SIGNIFICANT_CATEGORIES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={category === option.id}
                onClick={() => setCategory(option.id)}
              >
                {option.label} <span>{option.count}</span>
              </button>
            ))}
          </ReferenceDiscoveryFacetGroup>
        )}
        toolbar={null}
        resultLabel="components"
        singularResultLabel="component"
        totalCount={items.length}
        renderedCount={items.length}
        loading={false}
        error={null}
        loadMoreError={null}
        onRetry={() => undefined}
        onRetryLoadMore={() => undefined}
        onReset={() => setCategory('all')}
      >
        <div
          className="component-library__results"
          data-components-discovery-grid="true"
        >
          {sourceGroups.map((group) => {
            const href = componentSourcePath(group.source);
            const sourceTypeLabel = group.source.type === 'site' ? 'Site' : 'App';
            return (
            <section
              aria-label={`${group.source.label} ${sourceTypeLabel} components`}
              className="component-library__group component-library__source-group"
              data-component-source-group={`${group.source.type}:${group.source.label}`}
              key={group.id}
            >
              <header className="component-library__source-heading">
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    updateLocation(href);
                  }}
                >
                  <AppIcon
                    className={`component-library__source-logo ${sourceLogoClass(group.source)}`}
                    fit="contain"
                    iconUrl={sourceIconUrl(group.source)}
                    name={group.source.label}
                    size={42}
                  />
                  <span className="component-library__source-copy">
                    <strong>{group.source.label}</strong>
                  </span>
                </a>
                <span>{group.items.length} {group.items.length === 1 ? 'component' : 'components'}</span>
              </header>
              <div className="reference-discovery__grid components-discovery__grid component-library__grid">
                {group.items.map((item) => <ComponentCard item={item} key={item.id} />)}
              </div>
            </section>
            );
          })}
        </div>
      </DiscoveryPageLayout>
    </div>
  );
}
