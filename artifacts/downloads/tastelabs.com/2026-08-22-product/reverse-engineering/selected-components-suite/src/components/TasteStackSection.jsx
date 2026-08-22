import { useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

function TasteStackCard({ animationUrl, title, copy }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <article className="taste-stack-card">
      <div className="taste-stack-card__animation" aria-hidden="true">
        <DotLottieReact src={animationUrl} autoplay loop />
      </div>
      <div className="taste-stack-card__rule" />
      <h3>{title}</h3>
      <p>{copy}</p>
      <form
        className="taste-stack-card__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) setSent(true);
        }}
      >
        {sent ? (
          <p className="taste-stack-card__success" role="status">Success! We’ll be in touch soon.</p>
        ) : (
          <>
            <input
              aria-label={`Email for ${title}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@mail.com"
              required
            />
            <button type="submit">Get in touch</button>
          </>
        )}
      </form>
    </article>
  );
}

export function TasteStackSection({
  trainingAnimationUrl = '/assets/stack/training-models.lottie',
  agentsAnimationUrl = '/assets/stack/agents-apps.lottie',
}) {
  return (
    <section className="taste-stack" aria-label="Taste across the stack">
      <p className="taste-stack__eyebrow">Taste across the stack</p>
      <div className="taste-stack__grid">
        <TasteStackCard
          animationUrl={trainingAnimationUrl}
          title="Taste for Training Models"
          copy="We work with the top frontier labs to give their models taste, vision and design capabilities"
        />
        <TasteStackCard
          animationUrl={agentsAnimationUrl}
          title="Taste for Agents or Apps"
          copy="We work with app layer, coding agents and creative technology companies, providing the infra products for context, eval and verification, so they can output better, more beautiful, more personalized and on brand designs."
        />
      </div>
    </section>
  );
}
