export function BrandLogo({ className = "" }) {
  return (
    <span className={`brand-logo ${className}`.trim()} aria-label="Vitrines">
      <span className="brand-logo__mark" aria-hidden="true" />
      <span className="brand-logo__word" aria-hidden="true">Vitrines</span>
    </span>
  );
}
