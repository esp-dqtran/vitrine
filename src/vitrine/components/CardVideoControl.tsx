import type { MouseEvent } from 'react';

interface CardVideoControlProps {
  paused: boolean;
  progress: number;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function CardVideoControl({ paused, progress, onToggle }: CardVideoControlProps) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const progressPercent = normalizedProgress * 100;

  return (
    <button
      type="button"
      className="discovery-card__video-control"
      aria-label={`${paused ? 'Play' : 'Pause'} video preview`}
      aria-pressed={paused}
      onClick={onToggle}
    >
      <span className="discovery-card__video-control-ring" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <circle className="discovery-card__video-progress-track" cx="16" cy="16" r="13" pathLength="100" />
          <circle
            className="discovery-card__video-progress-value"
            cx="16"
            cy="16"
            r="13"
            pathLength="100"
            data-video-progress={Math.round(progressPercent)}
            style={{ strokeDasharray: `${progressPercent} 100` }}
          />
        </svg>
        <span className="discovery-card__play-icon" />
        <span className="discovery-card__pause-icon"><i /><i /></span>
      </span>
    </button>
  );
}
