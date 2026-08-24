import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Source-matched Radix AccordionContent lifecycle: the region remains in the
 * DOM while closed, animates its measured height, then becomes display:none.
 */
export function AccordionContent({ children, id, labelledBy, open }) {
  const contentRef = useRef(null);
  const closeTimerRef = useRef(null);
  const initialRenderRef = useRef(true);
  const [visible, setVisible] = useState(open);
  const [state, setState] = useState(open ? "open" : "closed");
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (visible) setHeight(contentRef.current?.scrollHeight ?? 0);
  }, [children, visible]);

  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);

    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => setState("open"));
      initialRenderRef.current = false;
      return () => window.cancelAnimationFrame(frame);
    }

    setState("closed");
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      setVisible(false);
      return undefined;
    }

    closeTimerRef.current = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(closeTimerRef.current);
  }, [open]);

  return <div ref={contentRef} id={id} role="region" aria-labelledby={labelledBy} data-state={state} className={`accordion-content${visible ? "" : " is-hidden"}`} style={{ "--accordion-content-height": `${height}px` }}>{children}</div>;
}
