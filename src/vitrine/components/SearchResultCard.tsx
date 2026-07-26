import { Button } from "@astryxdesign/core";
import type { SearchResultItem } from "../../searchTypes.ts";
import { PlaceholderImage } from "./PlaceholderImage.tsx";

export interface SearchResultCardProps {
  item: SearchResultItem;
  onPreview(item: SearchResultItem): void;
  selected?: boolean;
  onToggleCompare?(item: SearchResultItem): void;
}

const labels = {
  app: "App",
  site: "Site",
  screen: "Screen",
  flow: "Flow",
  component: "UI element",
  pattern: "Pattern",
};

export function SearchResultCard({
  item,
  onPreview,
  selected,
  onToggleCompare,
}: SearchResultCardProps) {
  const steps = Array.isArray(item.sourcePayload.steps)
    ? item.sourcePayload.steps as Array<{ label?: string }>
    : [];
  return (
    <article className={`advanced-search-card advanced-search-card--${item.entityType}`}>
      <Button
        className="advanced-search-card__preview"
        label={`Preview ${item.title}`}
        variant="ghost"
        onClick={() => onPreview(item)}
      >
        {item.entityType !== "app" ? (
          <div className="advanced-search-card__media">
            <PlaceholderImage src={item.thumbnailUrl ?? item.imageUrl} />
          </div>
        ) : null}
        <div className="advanced-search-card__body">
          <span className="advanced-search-card__kind">{labels[item.entityType]}</span>
          <h3>{item.title}</h3>
          <p>{item.catalogName} · {item.platform}</p>
          {item.pageType ? <span>{item.pageType}</span> : null}
          {item.entityType === "flow" ? (
            <ol>{steps.slice(0, 3).map((step, index) => (
              <li key={`${step.label}-${index}`}>{step.label ?? `Step ${index + 1}`}</li>
            ))}</ol>
          ) : null}
          {item.matchedContext.map((context) => (
            <small key={`${context.kind}:${context.value}`}>
              Matched {context.kind === "productArea" ? "product area" : context.kind}: {context.value}
            </small>
          ))}
        </div>
      </Button>
      {onToggleCompare && item.catalogScope === "apps" && item.appId !== undefined ? (
        <Button
          label={selected ? "Remove from compare" : "Compare app"}
          variant="secondary"
          size="sm"
          className="advanced-search-card__compare"
          aria-pressed={selected}
          onClick={() => onToggleCompare(item)}
        />
      ) : null}
    </article>
  );
}
