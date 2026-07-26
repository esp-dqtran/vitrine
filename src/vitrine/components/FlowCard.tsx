import type { DesignFlow, EvidenceView } from '../../designSystem';
import { Button, Icon, IconButton } from '@astryxdesign/core';
import { useRef, useState } from 'react';
import { PlaceholderImage } from './PlaceholderImage';

function flowScreenItems(flow: DesignFlow<EvidenceView>) {
  return flow.steps.flatMap((step, index) => {
    const evidence = step.evidence[0];
    return evidence
      ? [{ evidence, label: step.label, stepNumber: index + 1 }]
      : [];
  });
}

export function FlowCard({ flow, onOpen }: { flow: DesignFlow<EvidenceView>; onOpen: () => void }) {
  const trackRef = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);
  const screens = flowScreenItems(flow);
  const previewItems = screens.length
    ? screens
    : [{ evidence: undefined, label: flow.title, stepNumber: 1 }];
  const screenCount = screens.length || flow.steps.length;
  const countLabel = `${screenCount} ${screenCount === 1 ? 'screen' : 'screens'}`;
  const scrollTrack = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.72, 360),
      behavior: 'smooth',
    });
  };

  return (
    <article className="flow-strip-card" data-flow-strip-card="true">
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
              key={`${flow.id}-${stepNumber}-${evidence?.imageId ?? label}`}
            >
              <PlaceholderImage
                src={evidence?.imageUrl}
                accent="#111"
                style={{ objectFit: 'contain', background: '#fff' }}
              />
            </span>
          ))}
        </Button>
        {previewItems.length > 1 && (
          <>
            <IconButton
              label="Previous flow screens"
              icon={<Icon icon="chevronLeft" size="md" />}
              variant="secondary"
              className="flow-strip-card__arrow flow-strip-card__arrow--left"
              onClick={() => scrollTrack(-1)}
            />
            <IconButton
              label="Next flow screens"
              icon={<Icon icon="chevronRight" size="md" />}
              variant="secondary"
              className="flow-strip-card__arrow flow-strip-card__arrow--right"
              onClick={() => scrollTrack(1)}
            />
          </>
        )}
      </div>
      <footer className="flow-strip-card__footer">
        <div className="flow-strip-card__meta">
          <h3>{flow.title}</h3>
          <p>{countLabel}</p>
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
