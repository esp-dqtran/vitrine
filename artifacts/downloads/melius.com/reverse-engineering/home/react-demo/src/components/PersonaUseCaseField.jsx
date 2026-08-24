import { useEffect, useMemo, useRef } from "react";

function PersonaUseCaseCard({ active, assetBase, item, large, index }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (active) video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [active]);
  const media = `${assetBase}${item.asset}`;
  const mediaProps = { alt: "", className: "persona-use-case-card__media", src: media };

  return <article className="persona-use-case-card" data-index={index} data-size={large ? "large" : "small"} style={{ "--use-case-delay": `${index * .1}s` }}>
    <div className="persona-use-case-card__inner">
      <div className="persona-use-case-card__face persona-use-case-card__face--front">
        {item.type === "video" ? <video {...mediaProps} loop muted playsInline preload="metadata" ref={videoRef} /> : <img {...mediaProps} />}
        <span>{item.label}</span>
      </div>
      <div className="persona-use-case-card__face persona-use-case-card__face--back">
        {item.type === "video" ? <video aria-hidden="true" className="persona-use-case-card__media" loop muted playsInline preload="metadata" src={`${media}#t=0.1`} /> : <img alt="" className="persona-use-case-card__media" src={media} />}
        <div><span>{item.provider}</span><strong>{item.model}</strong></div>
      </div>
    </div>
  </article>;
}

export function PersonaUseCaseField({ active, activeIndex, assetBase, cards }) {
  const activeFields = useMemo(() => cards.map((card, index) => ({ ...card, index })), [cards]);
  return <div aria-hidden="true" className="persona-use-case-field">
    {activeFields.map(({ index, title, useCaseMedia = [] }) => <div className="persona-use-case-field__layer" data-active={active && index === activeIndex} key={title}>
      {useCaseMedia.map((item, itemIndex) => <PersonaUseCaseCard
        active={active && index === activeIndex}
        assetBase={assetBase}
        index={itemIndex}
        item={item}
        key={item.label}
        large={(index % 2 === 0) ? itemIndex === 1 || itemIndex === 2 : itemIndex === 0 || itemIndex === 3}
      />)}
    </div>)}
  </div>;
}
