import { useState } from 'react';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { copyShareLink } from '../screenActions.ts';
import { ArrowButton } from './ArrowButton.tsx';
import { AstryxModal, AstryxModalSurface } from './AstryxModal.tsx';
import { CopyButton } from './CopyButton.tsx';
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
  siteName?: string;
  siteLogoUrl?: string | null;
  patterns: string[];
  caption: string;
  metadata?: Record<string, unknown>;
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
  const [saved, setSaved] = useState(false);
  const selectedView = view === 'section' ? 'Section' : 'Full page';
  const fullPage = view === 'full-page';
  const mediaUrl = fullPage ? item.fullPageUrl : item.sectionUrl;
  const mediaKind = fullPage ? 'image' : item.kind;
  const metadata = item.metadata ?? {};
  const heading = metadataText(metadata.heading);
  const bounds = metadataRecord(metadata.elementBounds);
  const resolution = [
    numberText(bounds.width),
    numberText(bounds.height),
  ].filter(Boolean).join(' × ');
  const siteName = item.siteName || safeHostname(item.pageUrl);
  const copySectionLink = async () => {
    await copyShareLink(
      typeof window === 'undefined' ? item.sectionUrl : window.location.href,
    );
  };

  return (
    <AstryxModal
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      variant="fullscreen"
      purpose="info"
      padding={0}
      className="flow-preview-dialog-shell site-section-inspector-shell"
      aria-label={`${siteName} section detail`}
    >
      <AstryxModalSurface className="flow-preview-dialog site-section-inspector">
        <header className="site-section-inspector__header">
          <div className="site-section-inspector__identity">
            <span className="site-section-inspector__logo" aria-hidden="true">
              {item.siteLogoUrl ? <img src={item.siteLogoUrl} alt="" /> : siteName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{siteName}</strong>
              <small>{item.pageTitle}</small>
            </span>
          </div>
          <div className="site-section-inspector__switcher">
            <FilterChips
              options={['Section', 'Full page'] as const}
              value={selectedView}
              onChange={(value) => onViewChange(value === 'Section' ? 'section' : 'full-page')}
            />
          </div>
          <div className="site-section-inspector__actions">
            <Button
              label={saved ? 'Saved' : 'Save'}
              variant="primary"
              size="sm"
              className="flow-preview-dialog__save"
              onClick={() => setSaved((value) => !value)}
            />
            <CopyButton
              label="Copy link"
              successMessage="Section link copied"
              action={copySectionLink}
              variant="secondary"
              size="sm"
              className="flow-preview-dialog__copy"
            />
            <IconButton
              label="Close"
              icon={<Icon icon="close" size="sm" />}
              variant="ghost"
              className="astryx-modal__icon-action"
              onClick={(event) => { event.stopPropagation(); onClose(); }}
            />
          </div>
        </header>

        <div className={`site-section-inspector__viewport${fullPage ? ' site-section-inspector__viewport--full-page' : ''}`}>
          {mediaKind === 'video'
            ? <video src={mediaUrl} poster={item.posterUrl} controls muted playsInline />
            : fullPage
              ? <img src={mediaUrl} alt={`${siteName} full page capture`} />
              : <PlaceholderImage src={mediaUrl} style={{ objectFit: 'contain', background: 'transparent' }} />}
          {total > 1 && <ArrowButton direction="left" visible onClick={() => onNavigate(index - 1)} />}
          {total > 1 && <ArrowButton direction="right" visible onClick={() => onNavigate(index + 1)} />}
        </div>

        <footer className="site-section-inspector__footer">
          <div className="site-section-inspector__summary">
            <div className="site-section-inspector__badges">
              <strong>{heading || item.patterns[0] || item.caption}</strong>
              <span>{index + 1} of {total}{resolution ? ` · ${resolution}` : ''}</span>
            </div>
          </div>
        </footer>
      </AstryxModalSurface>
    </AstryxModal>
  );
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function metadataText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? String(Math.round(value))
    : '';
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
