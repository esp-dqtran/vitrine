import { useEffect, useRef, useState } from "react";

export function CanvasMediaFrame({ alt, aspectRatio, play = true, src, type = "image" }) {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef(null);
  const className = `canvas-media-frame__asset${loaded ? " is-loaded" : ""}`;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (play) video.play().catch(() => {});
    else video.pause();
    return () => video.pause();
  }, [loaded, play]);
  return <div className="canvas-media-frame" style={{ aspectRatio }}>{type === "video" ? <video aria-label={alt} className={className} loop muted onCanPlay={() => setLoaded(true)} playsInline preload="metadata" ref={videoRef} src={src} /> : <img alt={alt} className={className} decoding="async" loading="lazy" onLoad={() => setLoaded(true)} src={src} />}</div>;
}
