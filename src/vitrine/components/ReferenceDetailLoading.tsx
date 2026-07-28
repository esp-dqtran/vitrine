import { Spinner } from '@astryxdesign/core';

interface ReferenceDetailLoadingProps {
  kind: 'app' | 'site';
  label: string;
}

export function ReferenceDetailLoading({
  kind,
  label,
}: ReferenceDetailLoadingProps) {
  return (
    <main
      className={`vitrine-page reference-detail-loading reference-detail-loading--${kind}`}
      data-reference-detail-loading={kind}
      role="status"
      aria-label={label}
    >
      <Spinner size="md" />
      <span>{label}</span>
    </main>
  );
}
