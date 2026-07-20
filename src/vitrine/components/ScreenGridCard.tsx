import type { Screen } from '../types';
import { screenAspectRatio } from '../screenAspect';
import { MediaGridCard } from './MediaGridCard';

interface ScreenGridCardProps {
  screen: Screen;
  accent: string;
  delay: number;
  onOpen: () => void;
}

export function ScreenGridCard({ screen, accent, delay, onOpen }: ScreenGridCardProps) {
  return (
    <MediaGridCard
      label={`Open ${screen.type} screen`}
      kind="image"
      url={screen.url}
      thumbnailUrl={screen.thumbnailUrl}
      accent={accent}
      aspectRatio={screenAspectRatio(screen.platform)}
      badges={[screen.productArea, ...(screen.visibleStates ?? []).slice(0, 1)].filter((label) => Boolean(label) && label !== 'Unclassified')}
      delay={delay}
      onOpen={onOpen}
    />
  );
}
