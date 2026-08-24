import { useRef } from "react";
import { useCarousel } from "../hooks/useCarousel.js";
import { useReveal } from "../hooks/useReveal.js";

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "previous" ? "M19 12H5" : "M5 12h14"} />
      <path d={direction === "previous" ? "m12 19-7-7 7-7" : "m12 5 7 7-7 7"} />
    </svg>
  );
}

function Media({ item }) {
  if (item.kind === "image") {
    return <img src={item.media} alt={item.title} loading="lazy" />;
  }
  return (
    <video
      src={item.media}
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      style={item.mediaStyle}
    />
  );
}

function Slide({ item, actionLabel }) {
  return (
    <a className="slide cs" href={item.href} target="_blank" rel="noopener noreferrer">
      <div className="csm">
        <Media item={item} />
        <span className="reveal-cta" aria-hidden="true" />
        <span className="rc-clip" aria-hidden="true"><span className="rc-i">{actionLabel}</span></span>
      </div>
      <p className="t">{item.title}</p>
      <p className="d">{item.description}</p>
      {item.tags?.length ? (
        <div className="tags" aria-label="Tools used">
          {item.tags.map((tag) => <span className={tag.className} key={tag.label}>{tag.label}</span>)}
        </div>
      ) : null}
    </a>
  );
}

export function CarouselSection({ id, items, heading, description, actionLabel }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const headingRef = useRef(null);
  const headingVisible = useReveal(headingRef);
  const carousel = useCarousel(viewportRef, trackRef);

  return (
    <section className="caro" id={id} aria-label={heading || id}>
      {heading ? (
        <header className={`ch reveal${headingVisible ? " in" : ""}`} ref={headingRef}>
          <h2>{heading}</h2>
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      <div
        className={`track-wrap${carousel.dragging ? " drag" : ""}`}
        ref={viewportRef}
        {...carousel.handlers}
      >
        <div className="track" ref={trackRef} style={{ transform: `translate3d(${carousel.offset}px, 0, 0)` }}>
          {items.map((item) => <Slide item={item} actionLabel={actionLabel} key={item.title} />)}
        </div>
        <button className="sl-arrow prev" type="button" aria-label="Previous slides" disabled={!carousel.canPrevious} onPointerDown={(event) => event.stopPropagation()} onClick={carousel.previous}>
          <ArrowIcon direction="previous" />
        </button>
        <button className="sl-arrow next" type="button" aria-label="Next slides" disabled={!carousel.canNext} onPointerDown={(event) => event.stopPropagation()} onClick={carousel.next}>
          <ArrowIcon direction="next" />
        </button>
      </div>
    </section>
  );
}
