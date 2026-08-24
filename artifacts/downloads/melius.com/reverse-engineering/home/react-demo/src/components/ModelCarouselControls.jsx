function Arrow({ previous = false }) {
  return <svg aria-hidden="true" className={previous ? "model-carousel-controls__arrow model-carousel-controls__arrow--previous" : "model-carousel-controls__arrow"} fill="#fff" viewBox="0 0 24 24"><path d="M3 11.001h15.5v2H3z" /><path d="m14.201 18.701-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4 6.7 6.7z" /></svg>;
}

export function ModelCarouselControls({ className = "", onNext, onPrevious, shuttleRef }) {
  return <div className={`model-carousel-controls ${className}`.trim()}>
    <button aria-label="Show previous card" onClick={onPrevious} type="button"><Arrow previous /></button>
    <div aria-hidden="true" className="model-carousel-controls__rail"><i ref={shuttleRef} /></div>
    <button aria-label="Show next card" onClick={onNext} type="button"><Arrow /></button>
  </div>;
}
