import { useState } from 'react';
import { Badge, Button, Dialog, Icon, IconButton } from '@astryxdesign/core';
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
  const [copied, setCopied] = useState(false);
  const selectedView = view === 'section' ? 'Section' : 'Full page';
  const fullPage = view === 'full-page';
  const mediaUrl = fullPage ? item.fullPageUrl : item.sectionUrl;
  const mediaKind = fullPage ? 'image' : item.kind;
  const metadata = item.metadata ?? {};
  const heading = metadataText(metadata.heading);
  const selector = metadataText(metadata.selector);
  const tagName = metadataText(metadata.tagName);
  const role = metadataText(metadata.role);
  const text = metadataText(metadata.text);
  const style = metadataRecord(metadata.style);
  const content = metadataRecord(metadata.content);
  const contentSummary = [
    countLabel(content.links, 'link'),
    countLabel(content.buttons, 'button'),
    countLabel(content.images, 'image'),
    countLabel(content.videos, 'video'),
    countLabel(content.forms, 'form'),
  ].filter(Boolean).join(' · ');
  const layoutSummary = [
    metadataText(style.display),
    metadataText(style.flexDirection),
    metadataText(style.gridTemplateColumns),
    metadataText(style.gap) ? `gap ${metadataText(style.gap)}` : '',
  ].filter(Boolean).join(' · ');
  const bounds = metadataRecord(metadata.elementBounds);
  const resolution = [
    numberText(bounds.width),
    numberText(bounds.height),
  ].filter(Boolean).join(' × ');
  const siteName = item.siteName || safeHostname(item.pageUrl);
  const copySectionLink = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(
      typeof window === 'undefined' ? item.sectionUrl : window.location.href,
    ).then(() => setCopied(true));
  };

  return (
    <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} variant="fullscreen" purpose="info" padding={0}>
      <article className="site-section-inspector" aria-label={`${siteName} section detail`}>
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
              label={copied ? 'Copied' : 'Copy'}
              icon={<Icon icon="copy" size="sm" />}
              variant="ghost"
              size="sm"
              onClick={copySectionLink}
            />
            <IconButton
              label="Close"
              icon={<Icon icon="close" size="sm" />}
              variant="ghost"
              onClick={(event) => { event.stopPropagation(); onClose(); }}
            />
          </div>
        </header>

        <div className={`site-section-inspector__viewport${fullPage ? ' site-section-inspector__viewport--full-page' : ''}`}>
          {mediaKind === 'video'
            ? <video src={mediaUrl} poster={item.posterUrl} controls muted playsInline />
            : fullPage
              ? <img src={mediaUrl} alt={`${siteName} full page capture`} />
              : <PlaceholderImage src={mediaUrl} style={{ objectFit: 'contain' }} />}
          {total > 1 && <ArrowButton direction="left" visible onClick={() => onNavigate(index - 1)} />}
          {total > 1 && <ArrowButton direction="right" visible onClick={() => onNavigate(index + 1)} />}
        </div>

        <footer className="site-section-inspector__footer">
          <div className="site-section-inspector__summary">
            <div className="site-section-inspector__badges">
              <strong>{heading || item.patterns[0] || item.caption}</strong>
              <span>{index + 1} of {total}{resolution ? ` · ${resolution}` : ''}</span>
            </div>
            <div className="site-section-inspector__badges">
            {(item.patterns.length ? item.patterns : ['Unclassified']).map((pattern) => <Badge key={pattern} label={pattern} variant="neutral" />)}
              <a href={item.pageUrl} target="_blank" rel="noreferrer">{item.pageTitle} · {safeHostname(item.pageUrl)}</a>
            </div>
          </div>
          {!fullPage && (heading || selector || contentSummary || layoutSummary || text) ? (
            <details className="site-section-inspector__detail">
              <summary>Reconstruction details</summary>
              <div>
                {selector ? (
                  <code>{[tagName, role ? `role=${role}` : '', selector].filter(Boolean).join(' · ')}</code>
                ) : null}
                {layoutSummary || contentSummary ? (
                  <span>{[layoutSummary, contentSummary].filter(Boolean).join(' · ')}</span>
                ) : null}
                {text && text !== heading ? <p>{text}</p> : null}
              </div>
            </details>
          ) : null}
          <a className="site-section-inspector__download" href={mediaUrl} download>Download</a>
        </footer>
      </article>
    </Dialog>
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

function countLabel(value: unknown, label: string): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `${value} ${label}${value === 1 ? '' : 's'}`
    : '';
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
