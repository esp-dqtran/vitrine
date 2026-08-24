import { useEffect, useRef, useState } from "react";
import { GlyphField } from "./GlyphField.jsx";

function nearestScrollRoot(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
}

function DeferredGlyphField({ data }) {
  const hostRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mounted) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setMounted(true);
      },
      { rootMargin: "400px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mounted) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && !entry.isIntersecting) setMounted(false);
      },
      { root: nearestScrollRoot(host), rootMargin: "100%" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div ref={hostRef} className="glyph-field-backdrop__host">
      {mounted ? (
        <GlyphField
          backgroundOnly
          interactive={false}
          entrance={false}
          maxFps={30}
          backgroundColor="#232323"
          color="#ffffff"
          data={data}
        />
      ) : null}
    </div>
  );
}

export function GlyphFieldBackdrop({ data }) {
  return (
    <div aria-hidden="true" className="glyph-field-backdrop">
      <DeferredGlyphField data={data} />
      <div aria-hidden="true" className="glyph-field-backdrop__veil" />
    </div>
  );
}
