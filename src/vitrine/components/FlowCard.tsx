import type { DesignFlow, EvidenceView } from '../../designSystem';
import type { Platform } from '../../platformFromUrl.ts';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  FlowPreviewDialog,
  type FlowPreviewDocumentSource,
  type FlowPreviewMode,
  type FlowPreviewVariant,
} from './FlowPreviewDialog.tsx';
import { copyShareLink, flowShareUrl } from '../screenActions.ts';
import { CopyButton } from './CopyButton.tsx';
import { PlaceholderImage } from './PlaceholderImage';
import {
  flowCarouselEdges,
  scrollToAdjacentFlowScreen,
} from './flowCarousel';

function flowScreenItems(flow: DesignFlow<EvidenceView>) {
  return flow.steps.flatMap((step, index) => {
    const evidence = step.evidence[0];
    return evidence
      ? [{ evidence, label: step.label, stepNumber: index + 1 }]
      : [];
  });
}

function flowTitle(title: string) {
  const separator = ' from ';
  const separatorIndex = title.indexOf(separator);
  if (separatorIndex === -1) return title;

  return (
    <>
      {title.slice(0, separatorIndex)}
      {' '}
      <span className="flow-strip-card__title-connector">from</span>
      {' '}
      {title.slice(separatorIndex + separator.length)}
    </>
  );
}

export function flowPreviewIndexFromSearch(
  search: string,
  flowId: string,
  screenCount: number,
): number | null {
  if (!screenCount) return null;
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  const flowView = params.get('flowView');
  const hasPreviewMode = tab === 'screens'
    || tab === 'prototype'
    || tab === 'document'
    || flowView === 'visual'
    || flowView === 'document';
  if (
    params.get('flow') !== flowId
    || !hasPreviewMode
  ) return null;
  const legacyStep = Number(params.get('step'));
  const parsed = params.has('screen')
    ? Number(params.get('screen'))
    : Number.isInteger(legacyStep) && legacyStep > 0
      ? legacyStep - 1
      : 0;
  return Number.isInteger(parsed) && parsed >= 0 && parsed < screenCount ? parsed : 0;
}

export function flowPreviewModeFromSearch(
  search: string,
  flowId: string,
): FlowPreviewMode {
  const params = new URLSearchParams(search);
  if (params.get('flow') !== flowId) return 'screens';
  const tab = params.get('tab');
  if (params.get('flowView') === 'document') return 'document';
  return tab === 'prototype' || tab === 'document' ? tab : 'screens';
}

function writeFlowPreviewUrl(flowId: string, screenIndex: number, mode: FlowPreviewMode) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('flow', flowId);
  url.searchParams.set('tab', mode);
  url.searchParams.set('screen', String(screenIndex));
  url.searchParams.delete('flowView');
  url.searchParams.delete('step');
  window.history.replaceState(window.history.state, '', url);
}

function clearFlowPreviewUrl(flowId: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('flow') !== flowId) return;
  url.searchParams.delete('flow');
  url.searchParams.delete('tab');
  url.searchParams.delete('screen');
  url.searchParams.delete('flowView');
  url.searchParams.delete('step');
  window.history.replaceState(window.history.state, '', url);
}

export function FlowCard({
  flow,
  onOpen,
  anchorId,
  platform = 'web',
  screenCount: screenCountOverride,
  metaLabel,
  contextLabel,
  sourceAppName,
  sourceAppIconUrl,
  documentSource,
  userRole = 'user',
  onOpenSourceApp,
  previewVariant = 'full',
  fullAccessLabel,
  onRequestFullAccess,
  syncPreviewUrl = true,
  iconTooltips = false,
}: {
  flow: DesignFlow<EvidenceView>;
  onOpen: () => void;
  anchorId?: string;
  platform?: Platform;
  screenCount?: number;
  metaLabel?: string;
  contextLabel?: string;
  sourceAppName?: string;
  sourceAppIconUrl?: string | null;
  documentSource?: FlowPreviewDocumentSource;
  userRole?: 'admin' | 'user';
  onOpenSourceApp?: () => void;
  previewVariant?: FlowPreviewVariant | 'none';
  fullAccessLabel?: string;
  onRequestFullAccess?: () => void;
  syncPreviewUrl?: boolean;
  iconTooltips?: boolean;
}) {
  const trackRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);
  const screens = flowScreenItems(flow);
  const previewItems = screens.length
    ? screens
    : [{ evidence: undefined, label: flow.title, stepNumber: 1 }];
  const [previewIndex, setPreviewIndex] = useState<number | null>(() => (
    typeof window === 'undefined' || !syncPreviewUrl
      ? null
      : flowPreviewIndexFromSearch(window.location.search, flow.id, screens.length)
  ));
  const [previewMode, setPreviewMode] = useState<FlowPreviewMode>(() => (
    typeof window === 'undefined' || !syncPreviewUrl
      ? 'screens'
      : flowPreviewModeFromSearch(window.location.search, flow.id)
  ));
  const [carouselEdges, setCarouselEdges] = useState({
    canScrollLeft: false,
    canScrollRight: previewItems.length > 1,
  });
  const screenCount = screenCountOverride ?? (screens.length || flow.steps.length);
  const countLabel = `${screenCount} ${screenCount === 1 ? 'screen' : 'screens'}`;
  const syncCarouselEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const next = flowCarouselEdges(track);
    setCarouselEdges((current) => (
      current.canScrollLeft === next.canScrollLeft
      && current.canScrollRight === next.canScrollRight
        ? current
        : next
    ));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const frame = window.requestAnimationFrame(syncCarouselEdges);
    track.addEventListener('scroll', syncCarouselEdges, { passive: true });
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncCarouselEdges);
    observer?.observe(track);
    return () => {
      window.cancelAnimationFrame(frame);
      track.removeEventListener('scroll', syncCarouselEdges);
      observer?.disconnect();
    };
  }, [previewItems.length, syncCarouselEdges]);

  const scrollTrack = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    scrollToAdjacentFlowScreen(track, direction);
  };

  const openPreview = (event: MouseEvent<HTMLButtonElement>) => {
    if (previewVariant === 'none') {
      onOpen();
      return;
    }
    const indexedItem = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-flow-preview-index]')
      : null;
    const index = Number(indexedItem?.dataset.flowPreviewIndex ?? 0);
    if (!Number.isInteger(index) || !previewItems[index]?.evidence) {
      onOpen();
      return;
    }
    setPreviewIndex(index);
    setPreviewMode('screens');
    if (syncPreviewUrl) writeFlowPreviewUrl(flow.id, index, 'screens');
  };

  const updatePreviewIndex = (index: number) => {
    setPreviewIndex(index);
    if (syncPreviewUrl) writeFlowPreviewUrl(flow.id, index, previewMode);
  };

  const updatePreviewMode = (mode: FlowPreviewMode, index = previewIndex ?? 0) => {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(0, screens.length - 1));
    setPreviewIndex(nextIndex);
    setPreviewMode(mode);
    if (syncPreviewUrl) writeFlowPreviewUrl(flow.id, nextIndex, mode);
  };

  const closePreview = () => {
    if (syncPreviewUrl) clearFlowPreviewUrl(flow.id);
    setPreviewIndex(null);
  };

  const copyFlowLink = async () => {
    if (typeof window === 'undefined') throw new Error('Clipboard is unavailable');
    await copyShareLink(flowShareUrl(window.location.href, flow.id));
  };

  const openSourceAppFromPreview = onOpenSourceApp
    ? () => {
      if (syncPreviewUrl) clearFlowPreviewUrl(flow.id);
      onOpenSourceApp();
    }
    : undefined;

  return (
    <>
      <article
        className="flow-strip-card"
        data-flow-strip-card="true"
        data-flow-gallery-id={flow.id}
        data-flow-preview-url-sync={syncPreviewUrl ? 'true' : 'false'}
        id={anchorId}
      >
        <div className="flow-strip-card__stage" data-platform={platform}>
          <Button
            ref={trackRef}
            label={`Preview ${flow.title} flow screens`}
            variant="ghost"
            className="flow-strip-card__track"
            onClick={openPreview}
          >
            {previewItems.map(({ evidence, label, stepNumber }, index) => (
              <span
                className="flow-strip-card__screen"
                data-flow-carousel-item
                data-flow-preview-index={index}
                key={`${flow.id}-${stepNumber}-${evidence?.imageId ?? label}`}
              >
              <PlaceholderImage
                src={evidence?.imageUrl ?? evidence?.thumbnailUrl}
                accent="#111"
                // Flow cards show captured evidence. Keeping the full Web viewport
                // is more useful than cropping it to fill the 8:5 card frame.
                style={{ objectFit: 'contain' }}
              />
              </span>
            ))}
          </Button>
          {carouselEdges.canScrollLeft ? (
            <IconButton
              label="Previous flow screens"
              tooltip={iconTooltips ? 'Previous flow screens' : undefined}
              icon={<Icon icon="chevronLeft" size="md" />}
              variant="secondary"
              className="flow-strip-card__arrow flow-strip-card__arrow--left"
              onClick={() => scrollTrack(-1)}
            />
          ) : null}
          {carouselEdges.canScrollRight ? (
            <IconButton
              label="Next flow screens"
              tooltip={iconTooltips ? 'Next flow screens' : undefined}
              icon={<Icon icon="chevronRight" size="md" />}
              variant="secondary"
              className="flow-strip-card__arrow flow-strip-card__arrow--right"
              onClick={() => scrollTrack(1)}
            />
          ) : null}
        </div>
        <footer className="flow-strip-card__footer">
          <div className="flow-strip-card__identity">
            {sourceAppName && onOpenSourceApp ? (
              <Button
                label={`Open ${sourceAppName} app`}
                variant="ghost"
                className="flow-strip-card__app-icon flow-strip-card__app-icon--interactive"
                onClick={onOpenSourceApp}
              >
                {sourceAppIconUrl ? (
                  <img src={sourceAppIconUrl} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">{sourceAppName.slice(0, 1).toUpperCase()}</span>
                )}
              </Button>
            ) : null}
            <div className="flow-strip-card__meta">
              <h2>
                {flowTitle(flow.title)}
                {contextLabel ? (
                  <>
                    {' '}
                    <span className="flow-strip-card__title-connector">from</span>
                    {' '}
                    {contextLabel}
                  </>
                ) : null}
              </h2>
              <p>{metaLabel ?? countLabel}</p>
            </div>
          </div>
          <div className="flow-strip-card__actions">
            <Button
              label={saved ? 'Saved' : 'Save'}
              variant="primary"
              size="sm"
              className="flow-strip-card__save"
              clickAction={() => setSaved((value) => !value)}
            />
            <CopyButton
              label="Copy flow link"
              successMessage="Flow link copied"
              action={copyFlowLink}
              variant="secondary"
              size="sm"
              className="flow-strip-card__copy"
            />
            <IconButton
              label="More flow actions"
              tooltip={iconTooltips ? 'More flow actions' : undefined}
              icon={<Icon icon="moreHorizontal" size="md" />}
              variant="secondary"
              className="flow-strip-card__more"
              onClick={() => undefined}
            />
          </div>
        </footer>
      </article>
      {previewIndex !== null && screens[previewIndex] ? (
        <FlowPreviewDialog
          flowId={flow.id}
          flowTitle={flow.title}
          flow={flow}
          screens={screens}
          activeIndex={previewIndex}
          activeMode={previewVariant === 'public' ? 'screens' : previewMode}
          platform={platform}
          sourceAppName={sourceAppName}
          sourceAppIconUrl={sourceAppIconUrl}
          documentSource={documentSource}
          userRole={userRole}
          previewVariant={previewVariant}
          totalScreenCount={screenCount}
          fullAccessLabel={fullAccessLabel}
          onRequestFullAccess={onRequestFullAccess}
          onActiveIndexChange={updatePreviewIndex}
          onModeChange={updatePreviewMode}
          onClose={closePreview}
          onOpenSourceApp={openSourceAppFromPreview}
          iconTooltips={iconTooltips}
        />
      ) : null}
    </>
  );
}
