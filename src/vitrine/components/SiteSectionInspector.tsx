import { Badge, Dialog, Icon, IconButton } from '@astryxdesign/core';
import { ArrowButton } from './ArrowButton.tsx';
import { FilterChips } from './FilterChips.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';

export type SiteInspectorView = 'section' | 'full-page';

export interface SiteInspectorItem {
  id: number;
  kind: 'image' | 'video';
  sectionUrl: string;
  posterUrl?: string;
  fullPageUrl: string;
  pageTitle: string;
  pageUrl: string;
  patterns: string[];
  caption: string;
}

interface SiteSectionInspectorProps {
  item: SiteInspectorItem;
  index: number;
  total: number;
  view: SiteInspectorView;
  onViewChange: (view: SiteInspectorView) => void;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function SiteSectionInspector({
  item,
  index,
  total,
  view,
  onViewChange,
  onClose,
  onNavigate,
}: SiteSectionInspectorProps) {
  const selectedView = view === 'section' ? 'Section' : 'Full page';
  const fullPage = view === 'full-page';
  const mediaUrl = fullPage ? item.fullPageUrl : item.sectionUrl;
  const mediaKind = fullPage ? 'image' : item.kind;

  return (
    <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="fullscreen" purpose="info" padding={0}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: 'rgba(10,10,11,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 40px 28px', boxSizing: 'border-box', overflow: 'auto' }}>
        <IconButton
          label="Close"
          icon={<Icon icon="close" size="sm" />}
          variant="ghost"
          onClick={(event) => { event.stopPropagation(); onClose(); }}
          style={{ position: 'absolute', top: 20, right: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', zIndex: 3 }}
        />

        <div style={{ width: 'min(1100px, 92vw)', paddingRight: 52, boxSizing: 'border-box', flex: '0 0 auto' }}>
          <FilterChips
            options={['Section', 'Full page'] as const}
            value={selectedView}
            onChange={(value) => onViewChange(value === 'Section' ? 'section' : 'full-page')}
          />
        </div>

        <div style={{ position: 'relative', width: 'min(1100px, 92vw)', height: 'min(72vh, 820px)', minHeight: 320, borderRadius: 14, overflow: 'hidden', background: 'var(--color-background-muted)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'vtScaleIn .3s cubic-bezier(.16,1,.3,1) both', flex: '1 1 auto' }}>
          {mediaKind === 'video'
            ? <video src={mediaUrl} poster={item.posterUrl} controls muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <PlaceholderImage src={mediaUrl} style={{ objectFit: 'contain' }} />}
          {total > 1 && <ArrowButton direction="left" visible onClick={() => onNavigate(index - 1)} />}
          {total > 1 && <ArrowButton direction="right" visible onClick={() => onNavigate(index + 1)} />}
        </div>

        <div style={{ width: 'min(1100px, 92vw)', display: 'grid', gap: 8, marginTop: 16, color: '#d4d4d8', fontSize: 13.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {(item.patterns.length ? item.patterns : ['Unclassified']).map((pattern) => <Badge key={pattern} label={pattern} variant="neutral" />)}
            <span>{item.caption} — {index + 1} of {total}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <a href={item.pageUrl} target="_blank" rel="noreferrer" style={{ color: '#d4d4d8', overflowWrap: 'anywhere' }}>{item.pageTitle} · {item.pageUrl}</a>
            <a href={mediaUrl} download style={{ color: '#fff', fontWeight: 600 }}>Download</a>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
