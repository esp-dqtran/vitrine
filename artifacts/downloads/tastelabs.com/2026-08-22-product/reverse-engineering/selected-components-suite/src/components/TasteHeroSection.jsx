import { useEffect, useRef, useState } from 'react';

export function TasteHeroSection({ videoUrl = '/assets/hero/home_hero_loop_desktop.webm' }) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = () => void video.play().catch(() => undefined);
    play();
    return () => video.pause();
  }, [videoUrl]);

  return (
    <section className="taste-hero" aria-label="Taste infrastructure hero">
      <video
        ref={videoRef}
        className={`taste-hero__video${ready ? ' is-ready' : ''}`}
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        onCanPlay={() => setReady(true)}
      />
      <div className="taste-hero__shade" />
      <div className="taste-hero__content">
        <h2 className="taste-hero__headline">
          <span>Decoding subjective domains</span>
          the Taste infra layer for AI
        </h2>
        <a className="taste-mono-link" href="https://tastelabs.com/careers" target="_blank" rel="noreferrer">
          Join our team <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
