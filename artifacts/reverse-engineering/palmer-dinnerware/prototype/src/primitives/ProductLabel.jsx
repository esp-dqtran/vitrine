import { Plus } from "./Icons";

export function ProductLabel({ item }) {
  return (
    <span className="product-label">
      <Plus size={10} strokeWidth={2.2} />
      {item.collection}
    </span>
  );
}
