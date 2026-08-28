import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { CollectionFocus } from "../composites/CollectionFocus";
import { appFacets, relatedCategoryItems } from "../data/apps";
import { useAppCatalog } from "../hooks/useAppCatalog";
import { duration, gsap, palmerMotion } from "../motion/palmerMotion";
import { ExperienceCanvasSection } from "../sections/ExperienceCanvasSection";
import { GlobalChrome } from "../sections/GlobalChrome";

const allSizes = appFacets.sizes.map(Number);

export function PalmerHomePage({ catalogSessionKey, onGuestLimitReached, onOpenApp } = {}) {
  const {
    initialItems,
    allItems,
    loading,
    error,
    hasMore,
    canAutoLoadMore,
    loadNextPage,
  } = useAppCatalog({
    catalogSessionKey,
    onGuestLimitReached,
  });
  const [entering, setEntering] = useState(true);
  const [focusedCollection, setFocusedCollection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPanel, setFilterPanel] = useState(null);
  const [colors, setColors] = useState([]);
  const [types, setTypes] = useState([]);
  const [sizeRange, setSizeRange] = useState([allSizes[0], allSizes.at(-1)]);
  const appRef = useRef(null);

  const filterItems = useCallback((candidateItems) => candidateItems.filter((item) => {
    const size = Number(item.size);
    return (
      (!colors.length || colors.includes(item.color))
      && (!types.length || types.includes(item.type))
      && size >= sizeRange[0]
      && size <= sizeRange[1]
    );
  }), [colors, types, sizeRange]);

  const collection = focusedCollection
    ? {
        name: focusedCollection.name,
        slug: focusedCollection.id,
        products: relatedCategoryItems(allItems, focusedCollection),
      }
    : null;

  useLayoutEffect(() => {
    if (!entering || !appRef.current || !initialItems.length) return undefined;

    const scope = gsap.context(() => {
      const controls = appRef.current.querySelectorAll(".control-dock, .drag-hint, .zoom-control");
      const items = appRef.current.querySelectorAll(".experience-product");
      const stage = appRef.current.querySelector(".experience-stage");
      const origin = appRef.current.querySelector(".experience-origin");
      const reveal = palmerMotion.initialReveal;
      const timeline = gsap.timeline({ onComplete: () => setEntering(false) });

      timeline
        .set(stage, { pointerEvents: "none" }, 0)
        .set(origin, { scale: 0.5, transformOrigin: "50vw 50vh" }, 0)
        .fromTo(items, { scale: 0, autoAlpha: 1 }, {
          scale: 1,
          autoAlpha: 1,
          delay: duration(reveal.itemDelay),
          duration: duration(reveal.itemDuration),
          ease: "back.out",
          stagger: { amount: duration(reveal.itemStagger), from: "random" },
          clearProps: "opacity,visibility",
        }, 0)
        .to(origin, {
          scale: 1,
          delay: duration(reveal.zoomDelay),
          duration: duration(reveal.zoomDuration),
          ease: "expo.inOut",
          clearProps: "scale,transformOrigin",
        }, 0)
        .fromTo(controls, { y: 18, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: duration(reveal.controlsDuration),
          ease: "cubic.inOut",
          stagger: duration(reveal.controlsStagger),
          clearProps: "transform,opacity,visibility",
        }, duration(reveal.controlsAt))
        .set(stage, { pointerEvents: "all" }, duration(reveal.zoomDelay + reveal.zoomDuration));
    }, appRef);

    return () => scope.revert();
  }, [entering, initialItems.length]);

  const menu = { open: menuOpen, onOpenChange: setMenuOpen };
  const filters = {
    open: filterOpen,
    onOpenChange: setFilterOpen,
    panel: filterPanel,
    onPanelChange: setFilterPanel,
    colors,
    onColorsChange: setColors,
    types,
    onTypesChange: setTypes,
    sizeRange,
    onSizeRangeChange: setSizeRange,
  };

  return (
    <div className="palmer-app experience" id="top" ref={appRef}>
      <GlobalChrome />
      <ExperienceCanvasSection
        items={initialItems}
        loading={loading}
        error={error}
        hasMore={hasMore}
        canAutoLoadMore={canAutoLoadMore}
        loadNextPage={loadNextPage}
        filterItems={filterItems}
        menu={menu}
        filters={filters}
        onOpenCollection={setFocusedCollection}
      />
      {collection && (
        <CollectionFocus
          collection={collection}
          initialProduct={focusedCollection}
          onClose={() => setFocusedCollection(null)}
          onOpenApp={onOpenApp}
        />
      )}
    </div>
  );
}
