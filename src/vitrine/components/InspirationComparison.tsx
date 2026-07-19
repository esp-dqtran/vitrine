import { Button } from "@astryxdesign/core";
import type { CSSProperties } from "react";
import type { CatalogComparison, ComparisonRow } from "../../catalogResearch";

function ComparisonSection({ title, rows, apps }: { title: string; rows: ComparisonRow[]; apps: string[] }) {
  if (!rows.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div
        className="inspiration-comparison-table"
        role="table"
        style={{ "--comparison-columns": apps.length } as CSSProperties}
      >
        <div role="row"><strong role="columnheader">Reference</strong>{apps.map((app) => <strong role="columnheader" key={app}>{app}</strong>)}</div>
        {rows.map((row) => (
          <div role="row" key={row.id}>
            <span role="rowheader">{row.label}</span>
            {row.values.map((value, index) => <span role="cell" key={`${row.id}-${apps[index]}`}>{value ?? "—"}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function InspirationComparison({ comparison, onBack }: { comparison: CatalogComparison; onBack: () => void }) {
  return (
    <section className="inspiration-comparison" aria-label="App comparison">
      <Button label="Back to preview" variant="ghost" size="sm" onClick={onBack} />
      <h2>Compare inspiration</h2>
      <ComparisonSection title="Foundations" rows={comparison.foundations} apps={comparison.apps} />
      <ComparisonSection title="Components" rows={comparison.components} apps={comparison.apps} />
      <ComparisonSection title="Flows" rows={comparison.flows} apps={comparison.apps} />
    </section>
  );
}
