import { useEffect, useRef, useState } from "react";
import { AsciiImage } from "./AsciiImage.jsx";
import { SERVE_ROBOTICS_CELLS } from "./serveRoboticsCells.js";
import "./ShowcaseCard.css";

function useTouchActivation(ref) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    const touchDevice =
      window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    if (!element || !touchDevice) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.rootBounds) return;
        setActive(entry.boundingClientRect.top <= entry.rootBounds.top);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return active;
}

export function ShowcaseCard({
  className = "",
  href,
  imageAlt,
  imageSrc,
  title,
}) {
  const cardRef = useRef(null);
  const touchActive = useTouchActivation(cardRef);

  return (
    <a
      ref={cardRef}
      href={href}
      className={`showcase-card ${className}`.trim()}
      data-active={touchActive ? "true" : undefined}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="showcase-card__media">
        <AsciiImage
          active={touchActive}
          cells={SERVE_ROBOTICS_CELLS}
          label={title}
          cols={120}
          rows={37}
          levels={64}
          aspect={16 / 9}
        />
        <img
          src={imageSrc}
          alt={imageAlt}
          className="showcase-card__image"
          width="2048"
          height="1152"
          loading="eager"
          decoding="async"
        />
      </div>
      <h3 className="showcase-card__title">
        <span className="showcase-card__title-mask">
          <span className="showcase-card__title-line">{title}</span>
        </span>
      </h3>
    </a>
  );
}
