import type { KeyboardEvent } from 'react';
import type { AppsDiscoveryScreenResult } from '../appsDiscovery.ts';
import { AppIcon } from './AppIcon.tsx';
import { PlaceholderImage } from './PlaceholderImage.tsx';

interface AppsDiscoveryScreenCardProps {
  result: AppsDiscoveryScreenResult;
  onOpen: () => void;
}

export function AppsDiscoveryScreenCard({
  result: { app, screen },
  onOpen,
}: AppsDiscoveryScreenCardProps) {
  const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpen();
  };
  return (
    <article
      className="apps-discovery-screen-card"
      data-apps-discovery-screen-card="true"
      role="link"
      tabIndex={0}
      aria-label={`Open ${screen.type} from ${app.app}`}
      onClick={onOpen}
      onKeyDown={openFromKeyboard}
    >
      <div className="apps-discovery-screen-card__media">
        <PlaceholderImage
          src={screen.url}
          accent={app.accent}
          style={{ objectFit: 'contain' }}
        />
      </div>
      <div className="apps-discovery-screen-card__identity">
        <AppIcon
          name={app.app}
          iconUrl={app.iconUrl}
          accent={app.accent}
          size={36}
          className="apps-discovery-screen-card__logo"
        />
        <span>
          <strong>{app.app}</strong>
          <small>{screen.type}</small>
        </span>
      </div>
    </article>
  );
}
