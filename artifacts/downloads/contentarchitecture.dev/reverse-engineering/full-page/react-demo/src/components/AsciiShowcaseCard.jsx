import { useEffect, useRef, useState } from "react";
import { AsciiImage } from "./AsciiImage.jsx";
import "./ShowcaseCard.css";

const COLS = 120;
const ROWS = 37;
const LEVELS = 64;

function useImageCells(src) {
  const [cells, setCells] = useState("");

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = COLS;
      canvas.height = ROWS;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, COLS, ROWS);
      const pixels = context.getImageData(0, 0, COLS, ROWS).data;
      let next = "";
      for (let index = 0; index < COLS * ROWS; index += 1) {
        const offset = index * 4;
        const luminance =
          0.2126 * pixels[offset] +
          0.7152 * pixels[offset + 1] +
          0.0722 * pixels[offset + 2];
        const level = Math.max(0, Math.min(LEVELS - 1, Math.round((luminance / 255) * (LEVELS - 1))));
        next += String.fromCharCode(33 + level);
      }
      if (!cancelled) setCells(next);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return cells;
}

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
        const midpoint = entry.rootBounds.top + entry.rootBounds.height / 2;
        setActive(
          entry.boundingClientRect.top <= midpoint &&
            entry.boundingClientRect.bottom >= midpoint,
        );
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return active;
}

export function AsciiShowcaseCard({ href, imageAlt, imageSrc, studioIndex, title }) {
  const cardRef = useRef(null);
  const touchActive = useTouchActivation(cardRef);
  const cells = useImageCells(imageSrc);

  return (
    <a
      ref={cardRef}
      href={href}
      className="showcase-card"
      data-active={touchActive ? "true" : undefined}
      data-studio-item={`items.${studioIndex}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="showcase-card__media" data-studio-field={`items.${studioIndex}.appMedia`}>
        {cells ? (
          <AsciiImage
            active={touchActive}
            cells={cells}
            label={title}
            cols={COLS}
            rows={ROWS}
            levels={LEVELS}
            aspect={16 / 9}
          />
        ) : null}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="showcase-card__image"
          width="1440"
          height="810"
          loading="lazy"
          decoding="async"
        />
      </div>
      <h3 className="showcase-card__title" data-studio-field={`items.${studioIndex}.title`}>
        <span className="showcase-card__title-mask">
          <span className="showcase-card__title-line">{title}</span>
        </span>
      </h3>
    </a>
  );
}
