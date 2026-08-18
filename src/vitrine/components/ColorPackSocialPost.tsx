import type { CSSProperties } from 'react';
import type { ColorPalette } from '../../colorPalettes.ts';
import { ColorPackStack } from './ColorPackStack.tsx';

export interface ColorPackSocialPostProps {
  palette: ColorPalette;
  packNumber?: number;
  accountHandle?: string;
  className?: string;
}

/**
 * A 1080 × 1350 social frame that composes the production ColorPackStack.
 * Card visual rules remain in ColorPackStack so gallery and exported posts stay aligned.
 */
export function ColorPackSocialPost({
  palette,
  packNumber = 1,
  accountHandle = '@vitrines_ai',
  className,
}: ColorPackSocialPostProps) {
  const companion = palette.cards[2] ?? palette.cards[0];
  if (!companion) return null;

  return (
    <article
      className={['color-pack-social-post', className].filter(Boolean).join(' ')}
      aria-label={`${palette.name} Color Pack social image`}
      style={{
        '--color-pack-social-background': companion.color,
        '--color-pack-social-foreground': companion.foreground,
      } as CSSProperties}
    >
      <header className="color-pack-social-post__header">
        <div>
          <p>Color Pack {String(packNumber).padStart(3, '0')}</p>
          <h1>{palette.name}</h1>
        </div>
        <span>{accountHandle}</span>
      </header>

      <ColorPackStack
        cards={palette.cards}
        label={`${palette.name} color pack`}
        initiallyExpanded
        cardHeightScale={0.64}
        className="color-pack-social-post__stack"
      />

      <footer className="color-pack-social-post__footer">
        <span className="color-pack-social-post__brand"><i aria-hidden="true" />Vitrines</span>
        <span>Three colors. One atmosphere.</span>
      </footer>
    </article>
  );
}
