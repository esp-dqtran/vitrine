import { memo } from "react";
import { ProductImage } from "../primitives/ProductImage";

function ExperienceProductView({ item, onOpen, onHoverStart, onHoverEnd, eager = false }) {
  const productKey = `${item.collectionSlug}-${item.index}`;
  const openProduct = (target) => {
    onHoverEnd();
    const rect = target.querySelector(".product-image").getBoundingClientRect();
    onOpen({
      ...item,
      originKey: productKey,
      originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="experience-product"
      data-product-key={productKey}
      data-instance-key={item.instanceKey}
      aria-label={`${item.name}. Open app.`}
      onPointerEnter={(event) => onHoverStart(item, event)}
      onPointerLeave={onHoverEnd}
      onClick={(event) => openProduct(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openProduct(event.currentTarget);
      }}
    >
      <ProductImage item={item} eager={eager} />
    </div>
  );
}

export const ExperienceProduct = memo(ExperienceProductView);
