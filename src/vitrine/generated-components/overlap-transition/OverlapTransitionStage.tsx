import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

export type OverlapTransitionDirection = 'forward' | 'backward' | 'neutral';

export interface OverlapTransitionStageProps {
  children: ReactNode;
  className?: string;
  direction?: OverlapTransitionDirection;
  transitionKey: string;
}

const DIRECTION_VALUE: Record<OverlapTransitionDirection, number> = {
  backward: -1,
  forward: 1,
  neutral: 0,
};

const layerVariants: Variants = {
  enter: (direction: number) => ({
    clipPath: direction === 0 ? 'inset(0% 0 0)' : 'inset(58% 0 0)',
    opacity: direction === 0 ? 0 : 1,
    scale: 1,
    y: direction === 0 ? 16 : direction * 116,
    zIndex: 2,
  }),
  center: {
    clipPath: 'inset(0% 0 0)',
    opacity: 1,
    scale: 1,
    y: 0,
    zIndex: 2,
  },
  exit: (direction: number) => ({
    clipPath: 'inset(0% 0 0)',
    opacity: 0.42,
    scale: 0.985,
    y: direction === 0 ? -12 : direction * -52,
    zIndex: 1,
  }),
};

export function OverlapTransitionStage({
  children,
  className = '',
  direction = 'forward',
  transitionKey,
}: OverlapTransitionStageProps) {
  const reduceMotion = useReducedMotion();
  const directionValue = DIRECTION_VALUE[direction];

  return (
    <div
      className={`overlap-transition-stage ${className}`.trim()}
      data-overlap-transition-stage="true"
    >
      <AnimatePresence custom={directionValue} initial={false} mode="sync">
        <motion.div
          animate="center"
          className="overlap-transition-stage__layer"
          custom={directionValue}
          data-transition-key={transitionKey}
          exit="exit"
          initial="enter"
          key={transitionKey}
          transition={reduceMotion
            ? { duration: 0.16, ease: 'linear' }
            : { duration: 0.78, ease: [0.4, 0.3, 0, 1] }}
          variants={reduceMotion ? {
            enter: { opacity: 0 },
            center: { opacity: 1 },
            exit: { opacity: 0 },
          } : layerVariants}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
