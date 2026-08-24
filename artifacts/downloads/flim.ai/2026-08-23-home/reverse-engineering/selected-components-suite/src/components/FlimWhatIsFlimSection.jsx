import { useEffect, useState } from 'react';

export function FlimWhatIsFlimSection({
  introHeaderUrl,
  imageUrls,
  mobileImagesUrl,
  platformIconUrl,
  platformUrl,
  previewMode = 'full',
}) {
  const [phase, setPhase] = useState('reset');

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setPhase('merge');
      return undefined;
    }

    let enterTimer;
    let mergeTimer;
    let replayTimer;

    const play = () => {
      setPhase('reset');
      enterTimer = window.setTimeout(() => setPhase('enter'), 120);
      mergeTimer = window.setTimeout(() => setPhase('merge'), 2200);
      replayTimer = window.setTimeout(play, previewMode === 'card' ? 6800 : 7600);
    };

    play();
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(mergeTimer);
      window.clearTimeout(replayTimer);
    };
  }, [previewMode]);

  return (
    <section
      className={`flim-component flim-what-is-flim is-${phase}`}
      data-animation-phase={phase}
      data-flim-component="what-is-flim"
    >
      <div aria-hidden="true" className="flim-what-is-flim__floating-images">
        {imageUrls.map((src, index) => (
          <img alt="" className={`flim-what-is-flim__floating-image flim-what-is-flim__floating-image--${index + 1}`} key={src} src={src} />
        ))}
      </div>

      <div className="flim-what-is-flim__intro">
        <div className="flim-what-is-flim__copy">
          <span className="flim-kicker">WHAT IS FLIM</span>
          <h2>
            A new <span aria-hidden="true" className="flim-inline-mark flim-inline-mark--circle"><svg fill="none" viewBox="0 0 60 60"><circle cx="30" cy="30" fill="currentColor" r="30" /></svg></span> language of visual expression.<br />
            Built <span aria-hidden="true" className="flim-inline-mark flim-inline-mark--arrows"><svg fill="none" viewBox="0 0 54 54"><path d="M27 27L0 54V0L27 27Z" fill="currentColor" /><path d="M54 27L27 54V0L54 27Z" fill="currentColor" /></svg></span> on the most complete platform for storytelling.
          </h2>
        </div>
      </div>

      <div className="flim-what-is-flim__platform">
        <img alt="" className="flim-what-is-flim__platform-header" src={introHeaderUrl} />
        <img alt="" className="flim-what-is-flim__platform-screen" src={platformUrl} />
        <img alt="" className="flim-what-is-flim__platform-mobile" src={mobileImagesUrl} />
        <img alt="" className="flim-what-is-flim__platform-icon" src={platformIconUrl} />
        <div aria-hidden="true" className="flim-what-is-flim__merged-images">
          {imageUrls.map((src, index) => <img alt="" key={src} src={src} style={{ '--flim-merge-index': index }} />)}
        </div>
      </div>
    </section>
  );
}
