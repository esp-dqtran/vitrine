import { useState, type ReactNode } from 'react';
import { ToggleButton } from '@astryxdesign/core';
import { useSlidingIndicator } from '../useSlidingIndicator.ts';
import { ScreenGridCard } from './ScreenGridCard.tsx';
import { FlowCard } from './FlowCard.tsx';
import { ReferenceGalleryGrid } from './ReferenceGallerySection.tsx';
import type { DesignFlow, EvidenceView } from '../../designSystem.ts';
import type { PublicAppPreview } from '../publicAppPreviewApi.ts';
import { usePublicAppPreview } from '../usePublicAppPreview.ts';
import { useCatalogCategories, type CategoryRow } from '../categoryFacets.ts';
import { navigate, updateLocation } from '../router.ts';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';
import { CatalogNotFoundPage } from './CatalogStaticPages.tsx';

/*
 * The preview payload's flow shape, adapted to the one FlowCard takes. The v1
 * preview page has an identical private helper — this is a deliberate copy
 * rather than an import, so the rebuilt surfaces never depend on v1 page
 * internals. Reaching across meant a v1 refactor could break v2's build.
 */
function previewFlowAsDesignFlow(
  flow: PublicAppPreview['previewFlows'][number],
): DesignFlow<EvidenceView> {
  return {
    id: flow.id,
    title: flow.title,
    description: flow.description ?? '',
    tags: [],
    steps: flow.screens.map((screen, index) => ({
      label: screen.label,
      evidence: [{
        imageId: index + 1,
        /* Steps arrive as thumbnails; the lightbox wants the full variant. */
        imageUrl: screen.imageUrl
          ?? screen.thumbnailUrl.replace(/([?&])variant=thumb(?=&|$)/, '$1variant=full'),
        thumbnailUrl: screen.thumbnailUrl,
        description: null,
      }],
    })),
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatCaptured(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed);
}

export type CatalogAppTab = 'screens' | 'flows' | 'elements' | 'design-system';

const TABS: { id: CatalogAppTab; label: string }[] = [
  { id: 'screens', label: 'Screens' },
  { id: 'flows', label: 'Flows' },
  { id: 'elements', label: 'UI Elements' },
  { id: 'design-system', label: 'Design System' },
];

export interface CatalogAppPageProps {
  appId: string;
  isAdmin: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  categories?: readonly CategoryRow[];
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
  /* Every gated card routes here: unlocking is a deliberate, confirmed act,
     so the page never performs it — it hands off. */
  onLocked?: () => void;
  /* Which section opens first. Defaults to the captures, which are what the
     catalog is for. */
  initialTab?: CatalogAppTab;
}

export function CatalogAppPage(props: CatalogAppPageProps) {
  const { preview, loading, error } = usePublicAppPreview(props.appId, true);
  /* Sidebar counts follow the app being viewed, so an iOS app shows the iOS
     ranking rather than the Web default. */
  const platform = preview?.app.platforms?.[0] ?? 'web';
  const categories = useCatalogCategories(
    { platform, contentType: 'apps', sort: 'latest', query: '', filters: [] },
    props.isAdmin,
  );
  return (
    <CatalogAppPageView
      {...props}
      categories={props.categories ?? categories}
      preview={preview}
      loading={loading}
      error={error}
    />
  );
}

/* Split so the populated layout can be rendered in a test without a network —
   the detail endpoint needs auth, the preview endpoint needs a server. */
export function CatalogAppPageView({
  appId,
  categories,
  onLocked = () => undefined,
  initialTab = 'screens',
  accountControls,
  onSignIn,
  entitlement,
  onUpgrade,
  preview,
  loading,
  error,
}: CatalogAppPageProps & {
  preview: PublicAppPreview | null;
  loading: boolean;
  error: string | null;
}) {
  const [tab, setTab] = useState<CatalogAppTab>(initialTab);
  /* The product's own tab bar: design-system ToggleButtons with the sliding
     underline, same as the existing detail page. Hand-rolling a second one
     was how the two would have drifted apart. */
  const { indicatorRef, registerItem } = useSlidingIndicator<CatalogAppTab>(tab);
  const app = preview?.app;
  const captured = formatCaptured(app?.lastCapturedAt);
  const platforms = (app?.platforms ?? [])
    .map((platform) => PLATFORM_LABELS[platform] ?? platform)
    .join(', ');
  const [primaryCategory, ...otherCategories] = (app?.categories ?? []).map((c) => c.name);
  /* The same pairs the factsheet carried, in the shape the hero expects. An
     entry with nothing to say is dropped rather than shown as a dash. */
  const metadata = ([
    ['Platforms', platforms],
    ['Screens', app?.totalScreens ? app.totalScreens.toLocaleString('en-US') : ''],
    ['Flows', app?.totalFlows ? app.totalFlows.toLocaleString('en-US') : ''],
    ['UI Elements', app?.totalUiElements ? app.totalUiElements.toLocaleString('en-US') : ''],
    ['Categories', [primaryCategory, ...otherCategories].filter(Boolean).join(', ')],
    ['Last captured', captured ?? ''],
  ] as const)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({ label, value }));

  /* `/browse/<anything>` parses as an app id — the router cannot know which
     slugs exist. A miss is a not-found, so show the page that offers a way
     onward rather than a bare error line. */
  if (error && /not found/i.test(error)) {
    return (
      <CatalogNotFoundPage
        pathname={`/browse/${appId}`}
        accountControls={accountControls}
        onSignIn={onSignIn}
      />
    );
  }

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="apps"
          categories={categories ?? []}
          selectedCategories={[]}
          showAllCategories={false}
          onToggleShowAll={() => undefined}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-app" data-catalog-app="true">
        {error ? (
          <p className="catalog-app__state" role="alert">{error}</p>
        ) : loading || !app ? (
          <p className="catalog-app__state" role="status">Loading…</p>
        ) : (
          <>
            {/* The product's own detail hero: back, logo, heading with the
                description, and the metadata rail. Reusing it is why there is
                no separate About section to maintain. */}
            <header className="reference-detail__hero">
              <div className="reference-detail__hero-inner">
                <div
                  className={`reference-detail__logo${app.iconUrl ? ' reference-detail__logo--image reference-detail__logo--image-light' : ''}`}
                  style={app.iconUrl ? undefined : { background: app.accent }}
                >
                  {app.iconUrl ? (
                    <picture className="reference-detail__logo-picture">
                      <img alt="" src={app.iconUrl} loading="eager" width={88} height={88} />
                    </picture>
                  ) : (
                    <span>{app.app.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="reference-detail__heading">
                  <h1>{app.app}</h1>
                  {app.description ? <p>{app.description}</p> : null}
                </div>
                <div className="reference-detail__metadata">
                  {metadata.map(({ label, value }) => (
                    <div key={label} className="reference-detail__metadata-item">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {app.websiteUrl ? (
                  <div className="reference-detail__actions">
                    <a
                      className="catalog-app__visit"
                      href={app.websiteUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Visit website &#8599;
                    </a>
                  </div>
                ) : null}
              </div>
            </header>

            <div className="catalog-app__tabbar">
              <div
                role="tablist"
                aria-label={`${app.app} sections`}
                className="reference-detail__tabs"
              >
                {TABS.map(({ id, label }) => (
                  <ToggleButton
                    key={id}
                    ref={registerItem(id)}
                    label={label}
                    isPressed={tab === id}
                    onPressedChange={() => setTab(id)}
                    role="tab"
                    aria-pressed={undefined}
                    aria-selected={tab === id}
                    size="sm"
                    className="reference-detail__tab"
                    style={{
                      color: tab === id
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    }}
                  />
                ))}
                <div ref={indicatorRef} className="reference-detail__tab-indicator" />
              </div>
            </div>

            {/* Each tab shows the product's own cards — the same
                ScreenGridCard and FlowCard the public preview page uses. */}
            <CatalogAppTabPanel tab={tab} preview={preview} onLocked={onLocked} />

          </>
        )}
      </div>
    </CatalogShell>
  );
}

const TAB_EMPTY: Record<CatalogAppTab, string> = {
  screens: 'No screens captured for this app yet.',
  flows: 'No flows captured for this app yet.',
  elements: 'UI elements are part of the full capture. Unlock this app to browse them.',
  'design-system': 'The design system is generated from a completed capture. Unlock this app to view it.',
};

/* One panel per tab, built from the product's own cards. Screens and Flows use
   the preview the catalog already serves; Elements and Design System have no
   guest-visible data, so they say so rather than rendering an empty grid. */
function CatalogAppTabPanel({
  tab,
  preview,
  onLocked,
}: {
  tab: CatalogAppTab;
  preview: PublicAppPreview;
  onLocked: () => void;
}) {
  const { app } = preview;
  const screens = preview.previewScreens ?? [];
  const flows = preview.previewFlows ?? [];
  const elements = preview.previewUiElements ?? [];

  if (tab === 'screens' && screens.length > 0) {
    const platform = screens[0]?.platform ?? app.platforms?.[0] ?? 'web';
    return (
      <section className="catalog-app__panel" aria-label="Screens">
        <p className="catalog-app__panel-summary">
          Showing {screens.length} of {app.totalScreens}
        </p>
        <ReferenceGalleryGrid
          minCardWidth={240}
          layout={platform === 'web' ? 'web-screens' : 'mobile-screens'}
        >
          {screens.map((screen, index) => (
            <ScreenGridCard
              key={screen.id}
              screen={screen}
              accent={app.accent}
              delay={Math.min(index * 0.04, 0.32)}
              appName={app.app}
              onOpen={onLocked}
              showActions={false}
              showCategory={false}
            />
          ))}
        </ReferenceGalleryGrid>
      </section>
    );
  }

  if (tab === 'flows' && flows.length > 0) {
    return (
      <section className="catalog-app__panel" aria-label="Flows">
        <p className="catalog-app__panel-summary">
          Showing {flows.length} of {app.totalFlows}
        </p>
        <div className="catalog-app__flowlist">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={previewFlowAsDesignFlow(flow)}
              onOpen={onLocked}
              platform={flow.platform ?? app.platforms?.[0] ?? 'web'}
              metaLabel={`${flow.stepCount} steps`}
              syncPreviewUrl={false}
            />
          ))}
        </div>
      </section>
    );
  }

  if (tab === 'elements' && elements.length > 0) {
    return (
      <section className="catalog-app__panel" aria-label="UI Elements">
        <p className="catalog-app__panel-summary">
          Showing {elements.length} of {app.totalUiElements}
        </p>
        <ul className="catalog-app__elements">
          {elements.map((element) => (
            <li key={`${element.group}:${element.type}`}>
              <img src={element.thumbnailUrl} alt="" aria-hidden="true" loading="lazy" />
              <strong>{element.type}</strong>
              <span>{element.count}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="catalog-app__panel" aria-label={TABS.find((t) => t.id === tab)?.label}>
      <p className="catalog-browse__state" role="status">{TAB_EMPTY[tab]}</p>
    </section>
  );
}
