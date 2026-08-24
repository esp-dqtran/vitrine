import { Fragment } from "react";

const ODOMETER_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function OdometerWord({ children }) {
  const word = String(children);

  return (
    <span className="split-button__word">
      <span className="sr-only">{word}</span>
      <span className="split-button__letters" aria-hidden="true">
        {Array.from(word).map((character, index) => {
          const displayCharacter = character === " " ? "\u00a0" : character;
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
                style={{ "--glyph-delay": `calc(var(--odometer-progress) * ${index * 28}ms)` }}
              >
                {glyphs.map((glyph, glyphIndex) => (
                  <b key={`${glyph}-${glyphIndex}`}>{glyph}</b>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function SplitButton({ children, external = false, href }) {
  const words = String(children).split(" ");

  return (
    <a
      className="split-button"
      href={href}
      aria-label={String(children)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
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
