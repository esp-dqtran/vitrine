import { Fragment, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const ODOMETER_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function MeliusButton({
  children,
  href,
  size = 'header',
  variant = 'outline',
}: {
  children: ReactNode;
  href: string;
  size?: 'header' | 'menu';
  variant?: 'outline' | 'yellow' | 'orange';
}) {
  return <a className={`melius-button melius-button--${size} melius-button--${variant}`} href={href}>{children}</a>;
}

function Arrow({ previous = false }: { previous?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={previous ? 'model-carousel-controls__arrow model-carousel-controls__arrow--previous' : 'model-carousel-controls__arrow'}
      fill="#fff"
      viewBox="0 0 24 24"
    >
      <path d="M3 11.001h15.5v2H3z" />
      <path d="m14.201 18.701-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4 6.7 6.7z" />
    </svg>
  );
}

export function ModelCarouselControls({
  onNext,
  onPrevious,
  progress,
}: {
  onNext: () => void;
  onPrevious: () => void;
  progress: number;
}) {
  return (
    <div className="model-carousel-controls" style={{ '--model-progress': progress } as CSSProperties}>
      <button aria-label="Show previous card" onClick={onPrevious} type="button"><Arrow previous /></button>
      <div aria-hidden="true" className="model-carousel-controls__rail"><i /></div>
      <button aria-label="Show next card" onClick={onNext} type="button"><Arrow /></button>
    </div>
  );
}

export function OdometerWord({ children }: { children: ReactNode }) {
  const word = String(children);
  return (
    <span className="split-button__word">
      <span className="sr-only">{word}</span>
      <span className="split-button__letters" aria-hidden="true">
        {Array.from(word).map((character, index) => {
          const displayCharacter = character === ' ' ? '\u00a0' : character;
          const seed = character.charCodeAt(0) + (index * 11);
          const alternatives = Array.from(
            { length: 4 },
            (_, offset) => ODOMETER_GLYPHS[(seed + (offset * 7)) % ODOMETER_GLYPHS.length],
          );
          const glyphs = [displayCharacter, ...alternatives, displayCharacter];
          return (
            <span className="split-button__glyph" key={`${character}-${index}`}>
              <em>{displayCharacter}</em>
              <span
                className="split-button__glyph-track"
                style={{ '--glyph-delay': `calc(var(--odometer-progress) * ${index * 28}ms)` } as CSSProperties}
              >
                {glyphs.map((glyph, glyphIndex) => <b key={`${glyph}-${glyphIndex}`}>{glyph}</b>)}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function SplitButton({ children, href }: { children: ReactNode; href: string }) {
  const words = String(children).split(' ');
  return (
    <a className="split-button" href={href} aria-label={String(children)}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <OdometerWord>{word}</OdometerWord>
          {index < words.length - 1 ? <i aria-hidden="true" /> : null}
        </Fragment>
      ))}
      <b className="split-button__status" aria-hidden="true" />
    </a>
  );
}

export function ReconstructedButtonPreview({ name }: { name: string }) {
  const [modelIndex, setModelIndex] = useState(0);
  const linkTarget = useRef(`#component-preview-${name.toLowerCase()}`).current;

  if (name === 'MeliusButton') {
    return (
      <div className="component-preview component-preview--melius-button">
        <MeliusButton href={linkTarget} size="menu">Sign in</MeliusButton>
        <MeliusButton href={linkTarget} variant="yellow">Sign in</MeliusButton>
        <MeliusButton href={linkTarget} variant="orange">Start for free</MeliusButton>
      </div>
    );
  }
  if (name === 'ModelCarouselControls') {
    return (
      <div className="component-preview component-preview--model-controls">
        <ModelCarouselControls
          progress={modelIndex / 3}
          onPrevious={() => setModelIndex((value) => (value + 3) % 4)}
          onNext={() => setModelIndex((value) => (value + 1) % 4)}
        />
      </div>
    );
  }
  if (name === 'SplitButton') {
    return <div className="component-preview component-preview--split-button"><SplitButton href={linkTarget}>Get access</SplitButton></div>;
  }
  return null;
}
