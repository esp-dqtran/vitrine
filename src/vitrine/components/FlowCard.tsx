import type { DesignFlow, EvidenceView } from '../../designSystem';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useCallback, useEffect, useRef, useState } from 'react';
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

export function FlowCard({
  flow,
  onOpen,
  anchorId,
  screenCount: screenCountOverride,
  metaLabel,
  sourceAppName,
  sourceAppIconUrl,
  onOpenSourceApp,
}: {
  flow: DesignFlow<EvidenceView>;
  onOpen: () => void;
  anchorId?: string;
  screenCount?: number;
  metaLabel?: string;
  sourceAppName?: string;
  sourceAppIconUrl?: string | null;
  onOpenSourceApp?: () => void;
}) {
  const trackRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);
  const screens = flowScreenItems(flow);
  const previewItems = screens.length
    ? screens
    : [{ evidence: undefined, label: flow.title, stepNumber: 1 }];
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

  return (
    <article
      className="flow-strip-card"
      data-flow-strip-card="true"
      data-flow-gallery-id={flow.id}
      id={anchorId}
    >
      <div className="flow-strip-card__stage">
        <Button
          ref={trackRef}
          label={`Open ${flow.title} flow`}
          variant="ghost"
          className="flow-strip-card__track"
          onClick={onOpen}
        >
          {previewItems.map(({ evidence, label, stepNumber }) => (
            <span
              className="flow-strip-card__screen"
              data-flow-carousel-item
              key={`${flow.id}-${stepNumber}-${evidence?.imageId ?? label}`}
            >
              <PlaceholderImage
                src={evidence?.thumbnailUrl ?? evidence?.imageUrl}
                srcSet={evidence?.thumbnailUrl && evidence.imageUrl && evidence.thumbnailUrl !== evidence.imageUrl
                  ? `${evidence.thumbnailUrl} 1x,${evidence.imageUrl} 2x`
                  : undefined}
                accent="#111"
                style={{ objectFit: 'contain', background: '#fff' }}
              />
            </span>
          ))}
        </Button>
        {carouselEdges.canScrollLeft ? (
          <IconButton
            label="Previous flow screens"
            icon={<Icon icon="chevronLeft" size="md" />}
            variant="secondary"
            className="flow-strip-card__arrow flow-strip-card__arrow--left"
            onClick={() => scrollTrack(-1)}
          />
        ) : null}
        {carouselEdges.canScrollRight ? (
          <IconButton
            label="Next flow screens"
            icon={<Icon icon="chevronRight" size="md" />}
            variant="secondary"
            className="flow-strip-card__arrow flow-strip-card__arrow--right"
            onClick={() => scrollTrack(1)}
          />
        ) : null}
      </div>
      <footer className="flow-strip-card__footer">
        <div className="flow-strip-card__identity">
          {sourceAppName ? (
            onOpenSourceApp ? (
              <button
                type="button"
                className="flow-strip-card__app-icon flow-strip-card__app-icon--interactive"
                aria-label={`Open ${sourceAppName} app`}
                onClick={onOpenSourceApp}
              >
                {sourceAppIconUrl ? (
                  <img src={sourceAppIconUrl} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">{sourceAppName.slice(0, 1).toUpperCase()}</span>
                )}
              </button>
            ) : (
              <span className="flow-strip-card__app-icon">
                {sourceAppIconUrl ? (
                  <img
                    src={sourceAppIconUrl}
                    alt={`${sourceAppName} app`}
                    loading="lazy"
                  />
                ) : (
                  <span aria-label={`${sourceAppName} app`}>
                    {sourceAppName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
            )
          ) : null}
          <div className="flow-strip-card__meta">
            <h2>{flowTitle(flow.title)}</h2>
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
          <Button
            label="Copy"
            icon={<Icon icon="copy" size="sm" />}
            variant="secondary"
            size="sm"
            className="flow-strip-card__copy"
            clickAction={() => undefined}
          />
          <IconButton
            label="More flow actions"
            icon={<Icon icon="moreHorizontal" size="md" />}
            variant="secondary"
            className="flow-strip-card__more"
            onClick={() => undefined}
          />
        </div>
      </footer>
    </article>
  );
}
