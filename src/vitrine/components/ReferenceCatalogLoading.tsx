import { Spinner } from '@astryxdesign/core';

interface ReferenceCatalogLoadingProps {
  label: string;
  compact?: boolean;
}

export function ReferenceCatalogLoading({
  label,
  compact = false,
}: ReferenceCatalogLoadingProps) {
  return (
    <div
      className={`reference-catalog-loading${compact ? ' reference-catalog-loading--compact' : ''}`}
      data-reference-catalog-loading="true"
      role="status"
      aria-label={label}
    >
      <Spinner size={compact ? 'sm' : 'md'} />
      <span>{label}</span>
    </div>
  );
}
