import { useEffect, useRef } from "react";

import { PersonaIndent } from "./PersonaIndent";

export function PersonaMedia({ active = true, alt, src, type = "video", useCases = [] }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (active) video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [active]);

  return <div className="persona-media">
    {type === "video" ? <video ref={videoRef} aria-label={alt} className="persona-media__asset" loop muted playsInline preload="metadata" src={src} /> : <img alt={alt} className="persona-media__asset" src={src} />}
    <PersonaIndent />
    <div className="persona-media__tags" aria-hidden="true">{useCases.map((useCase, index) => <span className="persona-media__tag" data-active={active} key={useCase} style={{ transitionDelay: `${350 + index * 100}ms` }}>{useCase}</span>)}</div>
  </div>;
}
