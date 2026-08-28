import { useLayoutEffect, useRef } from "react";
import { RotateCcw, X } from "../primitives/Icons";
import { appFacets, appSwatches } from "../data/apps";
import { ControlButton } from "../primitives/ControlButton";
import { duration, gsap } from "../motion/palmerMotion";

function FilterGlyph() {
  return <span className="filter-glyph" aria-hidden="true"><span /><span /><span /></span>;
}

function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function FilterChip({ children, swatch, onRemove }) {
  return (
    <button type="button" className="filter-chip" onClick={onRemove}>
      {children}
      {swatch && <span className="filter-chip__swatch" style={{ backgroundColor: swatch }} />}
      <X size={12} />
    </button>
  );
}

export function FilterControl({
  open,
  onOpenChange,
  panel,
  onPanelChange,
  colors,
  onColorsChange,
  types,
  onTypesChange,
  sizeRange,
  onSizeRangeChange,
}) {
  const rootRef = useRef(null);
  const allSizes = appFacets.sizes.map(Number);
  const minSize = allSizes[0];
  const maxSize = allSizes.at(-1);
  const sizeActive = sizeRange[0] !== minSize || sizeRange[1] !== maxSize;
  const active = colors.length > 0 || types.length > 0 || sizeActive;

  const reset = () => {
    onColorsChange([]);
    onTypesChange([]);
    onSizeRangeChange([minSize, maxSize]);
    onPanelChange(null);
  };

  const togglePanel = (next) => onPanelChange(panel === next ? null : next);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const controls = rootRef.current?.querySelectorAll(".filter-panel > *");
    const tween = gsap.fromTo(controls, { x: -12, scale: 0.9, autoAlpha: 0 }, {
      x: 0,
      scale: 1,
      autoAlpha: 1,
      duration: duration(0.38),
      ease: "back.out(1.5)",
      stagger: 0.045,
      clearProps: "transform,opacity,visibility",
    });
    return () => tween.kill();
  }, [open]);

  useLayoutEffect(() => {
    const options = rootRef.current?.querySelector(".filter-options");
    if (!options) return undefined;
    const tween = gsap.fromTo(options, { y: 14, scale: 0.94, autoAlpha: 0 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: duration(0.4),
      ease: "back.out(1.4)",
      clearProps: "transform,opacity,visibility",
    });
    return () => tween.kill();
  }, [panel]);

  const closeFilters = () => {
    const controls = rootRef.current?.querySelectorAll(".filter-panel > *");
    gsap.to(controls, {
      x: 10,
      scale: 0.92,
      autoAlpha: 0,
      duration: duration(0.24),
      ease: "power2.in",
      stagger: { each: 0.025, from: "end" },
      onComplete: () => {
        onOpenChange(false);
        onPanelChange(null);
      },
    });
  };

  return (
    <div ref={rootRef} className={`filter-control ${open ? "is-open" : ""}`}>
      {!open ? (
        <ControlButton
          className="filter-trigger"
          icon={<FilterGlyph />}
          label="filter"
          aria-expanded="false"
          onClick={() => onOpenChange(true)}
        />
      ) : (
        <div className="filter-panel" role="group" aria-label="Filter apps">
          <ControlButton
            className="circle-control"
            icon={<X size={17} />}
            aria-label="Close filters"
            onClick={closeFilters}
          />
          <div className="filter-category">
            <button type="button" className={panel === "color" ? "active" : ""} onClick={() => togglePanel("color")}>color <span>+</span></button>
            {panel === "color" && (
              <div className="filter-options color-options" aria-label="Color options">
                {appFacets.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={colors.includes(color) ? "selected" : ""}
                    style={{ backgroundColor: appSwatches[color] }}
                    aria-label={color}
                    aria-pressed={colors.includes(color)}
                    onClick={() => onColorsChange(toggleValue(colors, color))}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="filter-category">
            <button type="button" className={panel === "type" ? "active" : ""} onClick={() => togglePanel("type")}>category <span>+</span></button>
            {panel === "type" && (
              <div className="filter-options type-options" aria-label="App category options">
                {appFacets.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={types.includes(type) ? "selected" : ""}
                    aria-pressed={types.includes(type)}
                    onClick={() => onTypesChange(toggleValue(types, type))}
                  >{type}</button>
                ))}
              </div>
            )}
          </div>
          <div className="filter-category">
            <button type="button" className={panel === "size" ? "active" : ""} onClick={() => togglePanel("size")}>screens <span>+</span></button>
            {panel === "size" && (
              <div className="filter-options size-options" aria-label="Screen count range">
                <output>{sizeRange[0]} screens</output>
                <div className="dual-range">
                  <input
                    aria-label="Minimum screen count"
                    type="range"
                    min={minSize}
                    max={maxSize}
                    step="10"
                    value={sizeRange[0]}
                    onChange={(event) => onSizeRangeChange([Math.min(Number(event.target.value), sizeRange[1]), sizeRange[1]])}
                  />
                  <input
                    aria-label="Maximum screen count"
                    type="range"
                    min={minSize}
                    max={maxSize}
                    step="10"
                    value={sizeRange[1]}
                    onChange={(event) => onSizeRangeChange([sizeRange[0], Math.max(Number(event.target.value), sizeRange[0])])}
                  />
                </div>
                <output>{sizeRange[1]} screens</output>
              </div>
            )}
          </div>
          {active && (
            <ControlButton
              className="reset-button"
              icon={<RotateCcw size={14} />}
              label="reset"
              onClick={reset}
            />
          )}
        </div>
      )}
      {active && (
        <div className="active-filters" aria-label="Active filters">
          {colors.map((color) => (
            <FilterChip key={color} swatch={appSwatches[color]} onRemove={() => onColorsChange(colors.filter((candidate) => candidate !== color))}>{color}</FilterChip>
          ))}
          {types.map((type) => (
            <FilterChip key={type} onRemove={() => onTypesChange(types.filter((candidate) => candidate !== type))}>{type}</FilterChip>
          ))}
          {sizeActive && (
            <FilterChip onRemove={() => onSizeRangeChange([minSize, maxSize])}>{sizeRange[0]} - {sizeRange[1]} screens</FilterChip>
          )}
        </div>
      )}
    </div>
  );
}
