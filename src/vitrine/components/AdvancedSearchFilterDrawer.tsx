import { Button, Icon, IconButton } from "@astryxdesign/core";
import type { SearchFacets, SearchFilters } from "../../searchTypes.ts";
import { AdvancedSearchFilters } from "./AdvancedSearchFilters.tsx";
import { AstryxModal, AstryxModalSurface } from "./AstryxModal.tsx";

export function AdvancedSearchFilterDrawer({
  open,
  filters,
  facets,
  keys,
  onChange,
  onClose,
}: {
  open: boolean;
  filters: SearchFilters;
  facets: SearchFacets;
  keys?: Array<keyof SearchFilters>;
  onChange(filters: SearchFilters): void;
  onClose(): void;
}) {
  if (!open) return null;
  return (
    <AstryxModal
      isOpen
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      variant="fullscreen"
      purpose="info"
      padding={0}
      aria-label="Search filters"
    >
      <AstryxModalSurface className="advanced-search-drawer">
        <header>
          <h2>Filters</h2>
          <IconButton
            label="Close filters"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            className="astryx-modal__icon-action"
            onClick={onClose}
          />
        </header>
        <AdvancedSearchFilters filters={filters} facets={facets} keys={keys} onChange={onChange} />
        <footer>
          <Button label="Done" variant="primary" onClick={onClose} />
        </footer>
      </AstryxModalSurface>
    </AstryxModal>
  );
}
