import {
  BeakerIcon,
  BookmarkHollowIcon,
  CircleIcon,
  CloudIcon,
  CompassIcon,
  DiamondIcon,
  FaceHappyIcon,
  FlagIcon,
  GiftIcon,
  GlobeIcon,
  HeartIcon,
  LightningIcon,
  MoonIcon,
  PaintBrushIcon,
  RulerIcon,
  SparkleIcon,
  StarIcon,
  StickerIcon,
  SunIcon,
  SweepIcon,
  WandIcon,
} from '@storybook/icons';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type ColorPackRole = 'lead' | 'accent' | 'companion';

export interface ColorPackCard {
  id: string;
  name: string;
  hex: string;
  color: string;
  foreground: string;
  role?: ColorPackRole;
  gradient?: {
    angle: number;
    endHex: string;
  };
  icon?: ReactNode;
  outlined?: boolean;
}

export interface ColorPackStackProps {
  cards: readonly ColorPackCard[];
  label?: string;
  initiallyExpanded?: boolean;
  className?: string;
}

const iconPool: readonly ReactNode[] = [
  <HeartIcon />,
  <LightningIcon />,
  <StarIcon />,
  <MoonIcon />,
  <SunIcon />,
  <SparkleIcon />,
  <DiamondIcon />,
  <CloudIcon />,
  <CircleIcon />,
  <PaintBrushIcon />,
  <BeakerIcon />,
  <WandIcon />,
  <StickerIcon />,
  <SweepIcon />,
  <RulerIcon />,
  <CompassIcon />,
  <GlobeIcon />,
  <BookmarkHollowIcon />,
  <FlagIcon />,
  <GiftIcon />,
  <FaceHappyIcon />,
];

const iconSteps = [1, 2, 4, 5, 7, 8] as const;

function hashLabel(label: string) {
  let hash = 2166136261;
  for (const character of label) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A compact palette summary that fans out into three fully readable colour cards.
 * The palette belongs to the caller; this component only owns the display state.
 */
export function ColorPackStack({
  cards,
  label = 'Color pack',
  initiallyExpanded = true,
  className,
}: ColorPackStackProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [width, setWidth] = useState(620);
  const reduceMotion = useReducedMotion();
  const descriptionId = useId();
  const contentId = useId();
  const stackRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = stackRef.current;
    if (!element) return undefined;
    const sync = () => setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(sync);
    sync();
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!cards.length) return null;

  const cardHeight = Math.round(Math.min(Math.max(width * 0.596, 210), 650));
  const compactOffset = Math.round(cardHeight * 0.39);
  const expandedOverlap = Math.round(Math.min(cardHeight * 0.08, 42));
  const expandedGap = -expandedOverlap;
  const compactHeight = cardHeight + Math.max(cards.length - 1, 0) * compactOffset;
  const expandedHeight = cards.length * cardHeight + Math.max(cards.length - 1, 0) * expandedGap;
  const iconSeed = hashLabel(label);
  const iconStart = iconSeed % iconPool.length;
  const iconStep = iconSteps[(iconSeed >>> 4) % iconSteps.length];

  return (
    <section
      className={['color-pack-stack', className].filter(Boolean).join(' ')}
      aria-label={label}
      ref={stackRef}
      style={{ '--color-pack-card-height': `${cardHeight}px` } as CSSProperties}
    >
      <p id={descriptionId} className="color-pack-stack__sr-only">
        {expanded
          ? `${label} expanded. All ${cards.length} colors are visible.`
          : `${label} collapsed. Activate the card stack to expand it.`}
      </p>

      <motion.div
        className="color-pack-stack__cards"
        id={contentId}
        initial={false}
        animate={{ height: expanded ? expandedHeight : compactHeight }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
        aria-describedby={descriptionId}
      >
        {cards.map((card, index) => {
          const y = expanded ? index * (cardHeight + expandedGap) : index * compactOffset;
          const iconIndex = (iconStart + index * iconStep) % iconPool.length;
          const icon = card.icon ?? iconPool[iconIndex];

          return (
            <motion.article
              key={card.id}
              className="color-pack-stack__card"
              initial={false}
              animate={{ y, scale: expanded ? 1 : 1 - index * 0.006 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
              style={{
                '--color-pack-card': card.color,
                '--color-pack-foreground': card.foreground,
                zIndex: cards.length - index,
              } as CSSProperties}
              data-outlined={card.outlined ?? index === cards.length - 1}
            >
              <div className="color-pack-stack__card-copy">
                <span className="color-pack-stack__hex-value">
                  {card.gradient ? `${card.hex} → ${card.gradient.endHex}` : card.hex}
                </span>
                <h3>{card.name}</h3>
              </div>
              <span
                className="color-pack-stack__icon"
                aria-hidden="true"
                data-icon-index={card.icon ? undefined : iconIndex}
              >
                {icon}
              </span>
            </motion.article>
          );
        })}
        <button
          type="button"
          className="color-pack-stack__hit-area"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
        />
      </motion.div>
    </section>
  );
}
