import { useLayoutEffect, useRef, useState } from "react";
import { SegmentedTab } from "./primitives/SegmentedTab";

export function SegmentedTabBar({ items, initialIndex = 0, onChange }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });
  const buttonRefs = useRef([]);
  const scrollerRef = useRef(null);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const button = buttonRefs.current[activeIndex];
      if (!button) return;
      setIndicator((current) => ({ x: button.offsetLeft, width: button.offsetWidth, ready: current.ready }));
      scrollerRef.current?.scrollTo({ left: Math.max(0, button.offsetLeft - 8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    if (scrollerRef.current) observer.observe(scrollerRef.current);
    return () => observer.disconnect();
  }, [activeIndex, items]);

  useLayoutEffect(() => {
    setIndicator((current) => ({ ...current, ready: true }));
  }, []);

  const select = (index) => {
    setActiveIndex(index);
    onChange?.(index);
  };

  return <nav className="segmented-tab-bar" aria-label="Showcase sections"><div className="segmented-tab-bar__scroller" ref={scrollerRef}><span aria-hidden="true" className="segmented-tab-bar__indicator" data-ready={indicator.ready} style={{ transform: `translateX(${indicator.x}px)`, width: indicator.width }} />{items.map((item, index) => <span className="segmented-tab-bar__item" key={item} ref={(element) => { buttonRefs.current[index] = element; }}><SegmentedTab active={index === activeIndex} onClick={() => select(index)}>{item}</SegmentedTab></span>)}</div><span className="segmented-tab-bar__mask" aria-hidden="true" /></nav>;
}
