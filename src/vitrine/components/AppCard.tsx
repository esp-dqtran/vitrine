import { useState } from 'react';
import { Badge, type BadgeVariant } from '@astryxdesign/core';
import type { App, RowStatus } from '../types';
import { ArrowButton } from './ArrowButton';
import { PlaceholderImage } from './PlaceholderImage';

const STATUS_VARIANT: Record<RowStatus, BadgeVariant> = {
  Queued: 'neutral',
  'In progress': 'info',
  Complete: 'success',
  'Needs attention': 'error',
  Cancelled: 'neutral',
};

interface AppCardProps {
  app: App;
  onOpen: () => void;
  /** Import/analysis status — omit or pass 'Complete' to render the card exactly as before. */
  status?: RowStatus;
  progressLabel?: string;
}

export function AppCard({ app, onOpen, status, progressLabel }: AppCardProps) {
  const [index, setIndex] = useState(0);
  const screens = app.screens.slice(0, 5);
  const active = screens[index];
  const go = (offset: number) => {
    if (screens.length === 0) return;
    setIndex((value) => (value + offset + screens.length) % screens.length);
  };

  return (
    <article
      data-app-discovery-card="true"
      className="app-discovery-card"
      role="link"
      tabIndex={0}
      aria-label={`Open ${app.app}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="app-discovery-card__media">
        <span className="app-discovery-card__preview">
          <PlaceholderImage src={active?.thumbnailUrl ?? active?.url} accent={app.accent} />
        </span>
        {status && status !== 'Complete' ? (
          <span className="app-discovery-card__badge">
            <Badge label={status} variant={STATUS_VARIANT[status]} />
          </span>
        ) : null}
        <span className="app-discovery-card__overlay">View screens</span>
        {screens.length > 1 ? (
          <>
            <ArrowButton direction="left" visible onClick={() => go(-1)} />
            <ArrowButton direction="right" visible onClick={() => go(1)} />
          </>
        ) : null}
      </span>
      <span className="app-discovery-card__identity">
        <span className="app-discovery-card__logo" aria-hidden="true">
          {app.iconUrl
            ? <img src={app.iconUrl} alt="" loading="lazy" />
            : app.app.slice(0, 1).toUpperCase()}
        </span>
        <span className="app-discovery-card__copy">
          <strong>{app.app}</strong>
          <span>{app.description || app.cat}</span>
          {progressLabel && status && status !== 'Complete' ? <small>{progressLabel}</small> : null}
        </span>
      </span>
    </article>
  );
}
