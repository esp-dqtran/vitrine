import { Button, Spinner } from "@astryxdesign/core";
import type { CatalogSearchResultItem } from "../../catalogResearch";
import type { ResearchCollection } from "../../db";
import { CollectionPicker } from "./CollectionPicker";
import { InspirationResults } from "./InspirationResults";
import { PlaceholderImage } from "./PlaceholderImage";

interface InspirationPreviewProps {
  item: CatalogSearchResultItem;
  related: CatalogSearchResultItem[];
  relatedLoading: boolean;
  relatedError?: string;
  collections: ResearchCollection[];
  plan: 'free' | 'pro';
  onUpgrade?: () => void;
  onCollectionsChange: (collections: ResearchCollection[]) => void;
  onBack: () => void;
  onOpen: (item: CatalogSearchResultItem) => void;
  onCompare: (item: CatalogSearchResultItem) => void;
  onSelectRelated: (item: CatalogSearchResultItem) => void;
  onRetryRelated?: () => void;
}

export function InspirationPreview(props: InspirationPreviewProps) {
  const { item } = props;
  const flowContext = props.related.filter((candidate) => candidate.kind === "flow" && candidate.app === item.app);
  const relatedAcrossApps = props.related.filter((candidate) => candidate.app !== item.app);

  return (
    <section className="inspiration-preview" aria-label={`Preview ${item.title}`}>
      <Button label="Back to results" variant="ghost" size="sm" onClick={props.onBack} />
      <div className="inspiration-preview-layout">
        <div className="inspiration-preview-media">
          <PlaceholderImage src={item.imageUrl ?? item.thumbnailUrl ?? ""} accent="var(--color-accent)" />
        </div>
        <div className="inspiration-preview-copy">
          <span>{item.kind} · {item.app}</span>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <div className="inspiration-preview-actions">
            <Button label="Open" variant="primary" size="sm" onClick={() => props.onOpen(item)} />
            <Button label="Compare" size="sm" onClick={() => props.onCompare(item)} />
            <CollectionPicker
              reference={{ kind: item.kind, app: item.app, referenceId: item.id, title: item.title }}
              collections={props.collections}
              onCollectionsChange={props.onCollectionsChange}
              plan={props.plan}
              onUpgrade={props.onUpgrade}
            />
          </div>
        </div>
      </div>
      <section aria-label="Flow context">
        <h3>Flow context</h3>
        {flowContext.length
          ? <InspirationResults items={flowContext} onPreview={props.onSelectRelated} />
          : <p>No observed flow context for this reference.</p>}
      </section>
      <section aria-label="Related references">
        <h3>Related references</h3>
        {props.relatedLoading ? <Spinner size="sm" aria-label="Loading related references" /> : null}
        {props.relatedError ? <Button label="Retry related references" size="sm" onClick={props.onRetryRelated} /> : null}
        {!props.relatedLoading && !props.relatedError
          ? <InspirationResults items={relatedAcrossApps} onPreview={props.onSelectRelated} />
          : null}
      </section>
    </section>
  );
}
