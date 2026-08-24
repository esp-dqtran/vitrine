import { useEffect, useRef, useState } from "react";
import { SHOWCASE_GLYPH_DATA } from "../recovered/glyph/glyphData.js";
import { GlyphFieldBackdrop } from "../recovered/glyph/GlyphFieldBackdrop.jsx";

export function TestimonialsCarousel({ reviews }) {
  const trackRef = useRef(null);
  const frameRef = useRef(0);
  const [active, setActive] = useState(0);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const updateActive = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      const slides = Array.from(track.children);
      let closest = 0;
      let distance = Infinity;
      slides.forEach((slide, index) => {
        const nextDistance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
      setActive(closest);
    });
  };

  const goTo = (index) => {
    const track = trackRef.current;
    const slide = track?.children[index];
    if (!track || !slide) return;
    const left = Math.max(0, slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2);
    track.scrollTo({
      left,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setActive(index);
  };

  return (
      <div className="reviews-carousel" role="group" aria-label="Testimonials">
        <div ref={trackRef} className="reviews-track" onScroll={updateActive}>
          {reviews.map((review, index) => (
            <div
              className={`review-slide${index === 0 ? " is-first" : ""}${index === reviews.length - 1 ? " is-last" : ""}`}
              key={review.name}
              role="group"
              aria-label={`${index + 1} of ${reviews.length}: ${review.name}`}
            >
              <div className="review-card-shell">
                <figure className="review-card">
                  <blockquote data-studio-field={`items.${index}.quote`}>“{review.quote}”</blockquote>
                  <figcaption>
                    <img data-studio-field={`items.${index}.avatar`} src={review.image} alt="" />
                    <p><strong data-studio-field={`items.${index}.author`}>{review.name}</strong><span>{review.role}</span></p>
                  </figcaption>
                </figure>
              </div>
            </div>
          ))}
        </div>
        <div className="reviews-controls">
          <button
            type="button"
            aria-label="Previous slide"
            disabled={active === 0}
            onClick={() => goTo(active - 1)}
          >[&lt;]</button>
          <span>{String(active + 1).padStart(2, "0")} / 03</span>
          <button
            type="button"
            aria-label="Next slide"
            disabled={active === reviews.length - 1}
            onClick={() => goTo(active + 1)}
          >[&gt;]</button>
        </div>
        <p className="sr-only" aria-live="polite">Slide {active + 1} of {reviews.length}</p>
      </div>
  );
}

export function ReviewsSection({ reviews }) {
  return (
    <div
      id="reviews"
      className="reviews-section"
      data-page-builder-section="testimonialsSection"
    >
      <GlyphFieldBackdrop data={SHOWCASE_GLYPH_DATA} />
      <TestimonialsCarousel reviews={reviews} />
    </div>
  );
}
