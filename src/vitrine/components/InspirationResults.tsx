import { ClickableCard } from "@astryxdesign/core";
import type { CatalogSearchResultItem } from "../../catalogResearch";
import { groupInspirationResults } from "../inspirationSearch";
import { PlaceholderImage } from "./PlaceholderImage";

interface InspirationResultsProps {
  items: CatalogSearchResultItem[];
  activeId?: string;
  onPreview: (item: CatalogSearchResultItem) => void;
}

export function InspirationResults({ items, activeId, onPreview }: InspirationResultsProps) {
  return (
    <div className="inspiration-results" role="listbox" aria-label="Design inspiration results">
      {groupInspirationResults(items).map((group) => (
        <section key={group.label} aria-labelledby={`inspiration-${group.label.toLowerCase()}`}>
          <h2 id={`inspiration-${group.label.toLowerCase()}`}>{group.label}</h2>
          <div className="inspiration-result-grid">
            {group.items.map((item) => (
              <div key={item.id} role="option" aria-selected={item.id === activeId} className="inspiration-result-card">
                <ClickableCard
                  label={`Preview ${item.title}`}
                  onClick={() => onPreview(item)}
                  padding={0}
                >
                  <div className="inspiration-result-media">
                    <PlaceholderImage src={item.thumbnailUrl ?? item.imageUrl ?? ""} accent="var(--color-accent)" />
                    <span>{item.kind}</span>
                  </div>
                  <div className="inspiration-result-copy">
                    <strong>{item.title}</strong>
                    <span>{item.app}</span>
                  </div>
                </ClickableCard>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
