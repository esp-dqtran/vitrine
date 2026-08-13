import { Button, Icon, IconButton } from "@astryxdesign/core";
import type { ResearchCollection } from "../../db.ts";
import type { Screen } from "../types";
import { screenAspectRatio } from "../screenAspect";
import { screenCategoryForType } from "../screenCategories";
import { copyScreenImageAsPng } from "../screenActions.ts";
import { CollectionPicker } from "./CollectionPicker.tsx";
import { CopyButton } from "./CopyButton.tsx";
import { MediaGridCard } from "./MediaGridCard";

interface ScreenGridCardProps {
  screen: Screen;
  accent: string;
  delay: number;
  onOpen: () => void;
  onSave?: () => void;
  onRemove?: () => void;
  isRemoveDisabled?: boolean;
  appName?: string;
  appId?: string;
  collections?: ResearchCollection[];
  onCollectionsChange?: (collections: ResearchCollection[]) => void;
  plan?: "free" | "pro";
  flowNames?: string[];
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

const cleanLabel = (value: string | null | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();
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
  const detail =
    [
      cleanLabel(screen.description),
      screen.type !== "Unclassified" ? cleanLabel(screen.type) : null,
      screen.productArea !== "Unclassified"
        ? cleanLabel(screen.productArea)
        : null,
      cleanLabel(screen.stateContext),
      visibleText,
      cleanLabel(flowNames[0]),
    ].find((value): value is string => Boolean(value)) ??
    `${screen.platform || "app"} screen`;
  return appName ? `${appName}, ${detail}` : detail;
}

export function ScreenGridCard({
  screen,
  accent,
  delay,
  onOpen,
  onSave,
  onRemove,
  isRemoveDisabled = false,
  appName,
  appId,
  collections,
  onCollectionsChange,
  plan = "free",
  flowNames = [],
  selected = false,
  onSelectedChange,
}: ScreenGridCardProps) {
  const screenLabel = screenAccessibleLabel(screen, appName, flowNames);
  // Source facets are intentionally many-to-many. Cards show only the single
  // canonical child category selected by Screen Analyze.
  const screenCategory = screenCategoryForType(screen.type)
    ? cleanLabel(screen.type)
    : null;
  const actions = (
    <div
      className="screen-grid-card__actions"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {onRemove ? (
        <Button
          label="Remove"
          variant="secondary"
          size="sm"
          className="screen-grid-card__remove"
          isDisabled={isRemoveDisabled}
          onClick={onRemove}
        />
      ) : onSave ? (
        <Button
          label="Save"
          variant="primary"
          size="sm"
          className="screen-grid-card__save"
          endContent={<Icon icon="chevronDown" size="sm" />}
          onClick={onSave}
        />
      ) : appId && collections && onCollectionsChange ? (
        <CollectionPicker
          reference={{
            kind: "screen",
            app: appId,
            referenceId: String(screen.id),
            title: flowNames[0] ?? screenLabel,
          }}
          canvasItems={[{
            appId,
            appName: appName ?? appId,
            screen,
          }]}
          collections={collections}
          onCollectionsChange={onCollectionsChange}
          plan={plan}
          dark
          buttonLabel="Save"
          buttonClassName="screen-grid-card__save"
          buttonVariant="primary"
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
          preferFullImage
          preserveNaturalAspectRatio={screen.platform !== 'web'}
          delay={delay}
          onOpen={onOpen}
        />
        {screenCategory ? (
          <div className="screen-grid-card__patterns" aria-label={`Screen category: ${screenCategory}`}>
            <span>{screenCategory}</span>
          </div>
        ) : null}
        {actions}
        {onSelectedChange ? (
          <IconButton
            label={
              selected ? `Deselect ${screenLabel}` : `Select ${screenLabel}`
            }
            tooltip={
              selected ? `Deselect ${screenLabel}` : `Select ${screenLabel}`
            }
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
