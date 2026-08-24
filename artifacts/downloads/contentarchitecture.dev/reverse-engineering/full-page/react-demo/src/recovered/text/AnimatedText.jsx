import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const RESIZE_DELAY = 200;

function normalizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function createMeasuredSegments(text) {
  const words = text.split(" ");

  return words.map((word, wordIndex) => ({
    key: `${wordIndex}-${word}`,
    text: word,
  }));
}

function groupMeasuredWords(probe) {
  const segments = Array.from(probe.querySelectorAll("[data-animated-text-segment]"));
  const groups = [];

  for (const segment of segments) {
    const top = Math.round(segment.offsetTop);
    const current = groups.at(-1);

    if (!current || Math.abs(current.top - top) > 1) {
      groups.push({ top, words: [segment.dataset.animatedTextSegment] });
    } else {
      current.words.push(segment.dataset.animatedTextSegment);
    }
  }

  return groups.map((group) => group.words.join(" "));
}

export function AnimatedText({
  ariaLabel,
  children,
  className = "",
  duration = 1,
  staggerDelay = 0.1,
  animationDelay = 0,
  onLineCountChange,
}) {
  const text = normalizeText(children);
  const measuredSegments = createMeasuredSegments(text);
  const rootRef = useRef(null);
  const probeRef = useRef(null);
  const resizeTimerRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const [lines, setLines] = useState([text]);
  const [entered, setEntered] = useState(false);

  const measure = useCallback(() => {
    const probe = probeRef.current;
    if (!probe || probe.offsetWidth === 0) return;

    const nextLines = groupMeasuredWords(probe);
    if (nextLines.length > 0) {
      setLines((current) => (
        current.length === nextLines.length && current.every((line, index) => line === nextLines[index])
          ? current
          : nextLines
      ));
    }
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;

    const measureWhenReady = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (!cancelled) measure();
    };

    measureWhenReady();

    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(measure, RESIZE_DELAY);
    });

    if (rootRef.current) observer.observe(rootRef.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(resizeTimerRef.current);
    };
  }, [measure, prefersReducedMotion, text]);

  useEffect(() => {
    onLineCountChange?.(lines.length);
  }, [lines.length, onLineCountChange]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setEntered(true);
      return undefined;
    }

    const element = rootRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEntered(true);
        observer.disconnect();
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <span
        ref={rootRef}
        className={`animated-text animated-text--static ${className}`.trim()}
        role="text"
        aria-label={ariaLabel || text}
      >
        <span className="animated-text__static" aria-hidden="true">{text}</span>
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      className={`animated-text ${className}`.trim()}
      role="text"
      aria-label={ariaLabel || text}
    >
      <span ref={probeRef} className="animated-text__probe" aria-hidden="true">
        {measuredSegments.map((segment, index) => (
          <Fragment key={segment.key}>
            <span data-animated-text-segment={segment.text}>{segment.text}</span>
            {index < measuredSegments.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </span>
      <span className="animated-text__lines" aria-hidden="true">
        {lines.map((line, index) => (
          <span className="animated-text__mask" data-animated-text-mask="" key={`${line}-${index}`}>
            <span
              className="animated-text__line line"
              data-animate={entered && !prefersReducedMotion ? "true" : undefined}
              data-visible={entered || prefersReducedMotion ? "true" : undefined}
              style={{
                "--animated-text-delay": `${animationDelay + (index * staggerDelay)}s`,
                "--animated-text-duration": `${duration}s`,
              }}
            >
              {line}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
