export function ProductImage({ item, className = "", eager = false }) {
  if (!item.localImage) return null;
  return (
    <img
      className={`product-image ${className}`.trim()}
      src={item.localImage}
      alt={item.name}
      draggable="false"
      loading={eager ? "eager" : "lazy"}
      width={item.image?.width || undefined}
      height={item.image?.height || undefined}
    />
  );
}
