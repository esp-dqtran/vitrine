import { useRef, useState } from "react";

const WORDMARK_MASK = "/assets/a668d8cdad59095d755f.svg";

export function FooterWordmark({ className = "", maskUrl = WORDMARK_MASK }) {
  const rootRef = useRef(null);
  const [active, setActive] = useState(false);

  function updatePointer(event) {
    if (event.pointerType === "touch") return;
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    if (!root || !rect) return;

    // Component previews scale the whole source component with a transform.
    // Convert viewport coordinates back into the wordmark's native coordinate
    // space so the reveal remains directly beneath the pointer.
    const scaleX = rect.width / Math.max(1, root.clientWidth) || 1;
    const scaleY = rect.height / Math.max(1, root.clientHeight) || 1;
    const radius = Math.min(180, Math.max(90, root.clientWidth * 0.15));
    root.style.setProperty("--wordmark-x", `${(event.clientX - rect.left) / scaleX}px`);
    root.style.setProperty("--wordmark-y", `${(event.clientY - rect.top) / scaleY}px`);
    root.style.setProperty("--wordmark-radius", `${radius}px`);
  }

  return <div
    aria-hidden="true"
    className={`footer-wordmark ${className}`.trim()}
    data-active={active}
    onPointerEnter={(event) => { if (event.pointerType !== "touch") { updatePointer(event); setActive(true); } }}
    onPointerLeave={() => setActive(false)}
    onPointerMove={updatePointer}
    ref={rootRef}
  >
    <span className="footer-wordmark__static" style={{ "--wordmark-mask": `url("${maskUrl}")` }} />
    <span className="footer-wordmark__reveal" style={{ "--wordmark-mask": `url("${maskUrl}")` }} />
  </div>;
}
