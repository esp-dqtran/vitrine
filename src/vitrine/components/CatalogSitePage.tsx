import { useEffect, useState, type ReactNode } from 'react';
import { getSiteVersionBySlug } from '../sitesApi.ts';
import type { SiteVersionDetail } from '../types.ts';
import { useCatalogCategories, type CategoryRow } from '../categoryFacets.ts';
import { navigate, updateLocation } from '../router.ts';
import {
  CatalogSidebar,
  type CatalogSidebarEntitlement,
  type CatalogSidebarSection,
} from './CatalogSidebar.tsx';
import { CatalogShell } from './CatalogShell.tsx';
import { applySeoMetadata } from '../seo.ts';
import { metadataForSite } from '../../seoMetadata.ts';

export interface CatalogSitePageProps {
  siteSlug: string;
  isAdmin: boolean;
  accountControls?: ReactNode;
  onSignIn?: () => void;
  categories?: readonly CategoryRow[];
  entitlement?: CatalogSidebarEntitlement | null;
  onUpgrade?: () => void;
}

export function CatalogSitePage(props: CatalogSitePageProps) {
  const [detail, setDetail] = useState<SiteVersionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { siteSlug } = props;

  useEffect(() => {
    let live = true;
    setDetail(null);
    setError(null);
    getSiteVersionBySlug(siteSlug)
      .then((next) => { if (live) setDetail(next); })
      .catch((cause: Error) => { if (live) setError(cause.message); });
    return () => { live = false; };
  }, [siteSlug]);

  useEffect(() => {
    if (!detail) return;
    applySeoMetadata(metadataForSite({
      routeSlug: detail.routeSlug,
      name: detail.site.name,
      description: detail.site.description,
      logoUrl: detail.site.logoUrl,
      sourceUrl: detail.site.sourceUrl,
    }, window.location.search));
  }, [detail]);

  const categories = useCatalogCategories(
    { platform: 'web', contentType: 'apps', sort: 'latest', query: '', filters: [] },
    props.isAdmin,
  );

  return (
    <CatalogSitePageView
      {...props}
      categories={props.categories ?? categories}
      detail={detail}
      loading={detail === null && error === null}
      error={error}
    />
  );
}

/* Split so the populated layout renders in a test — the endpoint needs auth. */
export function CatalogSitePageView({
  categories,
  accountControls,
  onSignIn,
  entitlement,
  onUpgrade,
  detail,
  loading,
  error,
}: CatalogSitePageProps & {
  detail: SiteVersionDetail | null;
  loading: boolean;
  error: string | null;
}) {
  const site = detail?.site;
  const version = detail?.version;
  const pages = detail?.pages ?? [];
  const sectionTotal = pages.reduce((sum, page) => sum + (page.sections?.length ?? 0), 0);

  /* Same pairs the app detail hero uses, from fields a site record holds. An
     entry with nothing to say is dropped rather than shown as a dash. */
  const metadata = ([
    ['Pages', pages.length ? String(pages.length) : ''],
    ['Sections', sectionTotal ? String(sectionTotal) : ''],
    ['Version', version?.label ?? ''],
    ['Categories', (site?.categories ?? []).join(', ')],
    ['Styles', (site?.styles ?? []).join(', ')],
  ] as const)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({ label, value }));

  return (
    <CatalogShell
      accountControls={accountControls}
      onSignIn={onSignIn}
      sidebar={(
        <CatalogSidebar
          active="sites"
          categories={categories ?? []}
          selectedCategories={[]}
          showAllCategories={false}
          onToggleShowAll={() => undefined}
          onSelectCategory={(value) =>
            updateLocation(`/browse?filter=categories.${encodeURIComponent(value)}`)}
          onSelectSection={(section: CatalogSidebarSection) => {
            if (section === 'sites') navigate({ name: 'browse-sites' });
            else if (section === 'apps') navigate({ name: 'browse' });
            else if (section === 'flows') navigate({ name: 'browse-flows' });
            else if (section === 'collections') navigate({ name: 'browse-collections' });
            else if (section === 'projects') navigate({ name: 'browse-projects' });
          }}
          onSearch={() => navigate({ name: 'browse-search' })}
          entitlement={entitlement}
          onUpgrade={onUpgrade}
        />
      )}
    >
      <div className="catalog-app" data-catalog-site="true">
        {error ? (
          <p className="catalog-app__state" role="alert">{error}</p>
        ) : loading || !site ? (
          <p className="catalog-app__state" role="status">Loading…</p>
        ) : (
          <>
            <header className="reference-detail__hero">
              <div className="reference-detail__hero-inner">
                <div
                  className={`reference-detail__logo${site.logoUrl ? ' reference-detail__logo--image reference-detail__logo--image-light' : ''}`}
                >
                  {site.logoUrl ? (
                    <picture className="reference-detail__logo-picture">
                      <img alt="" src={site.logoUrl} loading="eager" width={88} height={88} />
                    </picture>
                  ) : (
                    <span>{site.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="reference-detail__heading">
                  <h1>{site.name}</h1>
                  {site.description ? <p>{site.description}</p> : null}
                </div>
                <div className="reference-detail__metadata">
                  {metadata.map(({ label, value }) => (
                    <div key={label} className="reference-detail__metadata-item">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {site.sourceUrl ? (
                  <div className="reference-detail__actions">
                    <a
                      className="catalog-app__visit"
                      href={site.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Visit site &#8599;
                    </a>
                  </div>
                ) : null}
              </div>
            </header>

            <section className="catalog-app__panel" aria-label="Pages">
              <p className="catalog-app__panel-summary">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'} captured
              </p>
              {pages.length === 0 ? (
                <p className="catalog-browse__state" role="status">
                  No pages captured for this site yet.
                </p>
              ) : (
                <div className="catalog-sites__grid">
                  {pages.map((page) => (
                    <article className="catalog-site" key={page.id}>
                      <div className="catalog-site__shot">
                        {page.fullPageImageUrl ? (
                          <img
                            src={page.fullPageImageUrl}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                          />
                        ) : (
                          <span className="catalog-site__empty" aria-hidden="true" />
                        )}
                      </div>
                      <div className="catalog-site__meta">
                        <div className="catalog-site__text">
                          <h2>{page.title}</h2>
                          <p>{page.url}</p>
                        </div>
                        {page.sections?.length ? (
                          <span className="catalog-site__sections">
                            {page.sections.length} sections
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </CatalogShell>
  );
}
