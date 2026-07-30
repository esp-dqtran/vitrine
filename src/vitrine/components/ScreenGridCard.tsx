import { Icon, IconButton } from '@astryxdesign/core';
import type { ResearchCollection } from '../../db.ts';
import type { Screen } from '../types';
import { screenAspectRatio } from '../screenAspect';
import { copyScreenImageAsPng } from '../screenActions.ts';
import { CollectionPicker } from './CollectionPicker.tsx';
import { CopyButton } from './CopyButton.tsx';
import { MediaGridCard } from './MediaGridCard';

interface ScreenGridCardProps {
  screen: Screen;
  accent: string;
  delay: number;
  onOpen: () => void;
  appName?: string;
  appId?: string;
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
  plan?: 'free' | 'pro';
  flowNames?: string[];
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onActionStatus?: (message: string) => void;
}

const cleanLabel = (value: string | null | undefined) => {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= 100 ? normalized : null;
};

export function screenAccessibleLabel(
  screen: Screen,
  appName?: string,
  flowNames: string[] = [],
) {
  const visibleText = screen.visibleText
    ?.map(cleanLabel)
    .find((value): value is string => Boolean(value));
  const detail = [
    cleanLabel(screen.description),
    screen.type !== 'Unclassified' ? cleanLabel(screen.type) : null,
    screen.productArea !== 'Unclassified' ? cleanLabel(screen.productArea) : null,
    cleanLabel(screen.stateContext),
    visibleText,
    cleanLabel(flowNames[0]),
  ].find((value): value is string => Boolean(value))
    ?? `${screen.platform || 'app'} screen`;
  return appName ? `${appName}, ${detail}` : detail;
}

export function ScreenGridCard({
  screen,
  accent,
  delay,
  onOpen,
  appName,
  appId,
  collections,
  onCollectionsChange,
  plan = 'free',
  flowNames = [],
  selected = false,
  onSelectedChange,
  onActionStatus,
}: ScreenGridCardProps) {
  const screenLabel = screenAccessibleLabel(screen, appName, flowNames);
  const actions = (
    <div
      className="screen-grid-card__actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {appId && collections && onCollectionsChange ? (
        <CollectionPicker
          reference={{
            kind: 'screen',
            app: appId,
            referenceId: String(screen.id),
            title: flowNames[0] ?? screenLabel,
          }}
          collections={collections}
          onCollectionsChange={onCollectionsChange}
          plan={plan}
          dark
          buttonLabel="Save"
          buttonClassName="screen-grid-card__save"
          buttonVariant="primary"
          onStatus={onActionStatus}
        />
      ) : null}
      <CopyButton
        label="Copy image"
        successMessage="Image copied as PNG"
        action={() => copyScreenImageAsPng(screen.url)}
        variant="secondary"
        size="sm"
        className="screen-grid-card__copy"
      />
    </div>
  );
  return (
    <article className="screen-grid-card" data-selected={selected || undefined}>
      <div className="screen-grid-card__media">
        <MediaGridCard
          label={`Open ${screenLabel}`}
          kind="image"
          url={screen.url}
          thumbnailUrl={screen.thumbnailUrl}
          accent={accent}
          aspectRatio={screenAspectRatio(screen.platform)}
          imageFit="contain"
          badges={[
            screen.productArea,
            ...(screen.visibleStates ?? []).slice(0, 1),
          ].filter((label) => Boolean(label) && label !== 'Unclassified')}
          delay={delay}
          onOpen={onOpen}
        />
        {actions}
        {onSelectedChange ? (
          <IconButton
            label={selected ? `Deselect ${screenLabel}` : `Select ${screenLabel}`}
            icon={<Icon icon="check" size="sm" />}
            variant="secondary"
            size="sm"
            className="screen-grid-card__select"
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation();
              onSelectedChange(!selected);
            }}
          />
        ) : null}
      </div>
    </article>
  );
}
