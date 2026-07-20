import type { SiteSummary } from '../types';
import { PreviewCarouselCard } from './PreviewCarouselCard';

export function SiteCard({ site, onOpen }: { site: SiteSummary; onOpen: () => void }) {
  return (
    <PreviewCarouselCard
      label={`Open ${site.name}`}
      identityKey={`site-icon-${site.id}`}
      identityLabel={site.name}
      accent="var(--color-accent)"
      supportingText={`${site.label} · ${site.pageCount} pages · ${site.sectionCount} sections`}
      overlayLabel="View pages"
      previews={site.previews.map((page) => ({
        key: String(page.id),
        url: page.url,
        alt: `${site.name} ${page.title}`,
      }))}
      onOpen={onOpen}
    />
  );
}
