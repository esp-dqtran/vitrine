import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function TasteMissionSection({ animationUrl = '/assets/mission/mission-animation.lottie' }) {
  return (
    <section className="taste-mission" aria-label="Taste Labs mission">
      <div className="taste-mission__art">
        <DotLottieReact src={animationUrl} autoplay loop aria-label="Three creative interfaces linked in a taste model" />
      </div>
      <div className="taste-mission__copy">
        <h2>Mission</h2>
        <p>Instead, there can be a world of<br className="taste-desktop-only" /> creativity, beauty and taste.</p>
        <p>That requires cracking how to measure,<br className="taste-desktop-only" /> classify, stir, search over and codify<br className="taste-desktop-only" /> subjective domains into data models<br className="taste-desktop-only" /> can learn from, and tools agents can use.</p>
        <p>So that models and agents can produce<br className="taste-desktop-only" /> not just outputs that are correct, but that<br className="taste-desktop-only" /> feel right.</p>
        <p>We’re making the unverifiable verifiable,<br className="taste-desktop-only" /> starting with design.</p>
      </div>
    </section>
  );
}
