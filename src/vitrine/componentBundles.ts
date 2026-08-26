export type ComponentEvidenceKind = 'observed' | 'reconstructed' | 'inferred' | 'unknown';

export interface ComponentBundleFile {
  language: 'tsx' | 'css' | 'ts' | 'md';
  path: string;
  source: string;
}

export interface ComponentBundleEvidence {
  detail: string;
  kind: ComponentEvidenceKind;
}

export interface ComponentBundle {
  assets: string[];
  componentId: string;
  confidence: number;
  dependencies: string[];
  evidence: ComponentBundleEvidence[];
  files: ComponentBundleFile[];
  name: string;
  sourceUrl: string;
  unknowns: string[];
  usage: string;
}

const OVERLAP_STAGE_SOURCE = [
  "import { AnimatePresence, motion, useReducedMotion } from 'motion/react';",
  "import type { ReactNode } from 'react';",
  '',
  "type Direction = 'forward' | 'backward' | 'neutral';",
  '',
  'export function OverlapTransitionStage({ children, direction = \'forward\', transitionKey }: {',
  '  children: ReactNode; direction?: Direction; transitionKey: string;',
  '}) {',
  '  const reduceMotion = useReducedMotion();',
  "  const axis = direction === 'backward' ? -1 : direction === 'forward' ? 1 : 0;",
  '  return (',
  '    <div className="overlap-transition-stage">',
  '      <AnimatePresence custom={axis} initial={false} mode="sync">',
  '        <motion.div',
  '          className="overlap-transition-stage__layer"',
  '          key={transitionKey}',
  '          custom={axis}',
  '          initial={reduceMotion ? { opacity: 0 } : { clipPath: \'inset(58% 0 0)\', y: axis * 116, zIndex: 2 }}',
  '          animate={{ clipPath: \'inset(0% 0 0)\', opacity: 1, scale: 1, y: 0, zIndex: 2 }}',
  '          exit={reduceMotion ? { opacity: 0 } : { opacity: 0.42, scale: 0.985, y: axis * -52, zIndex: 1 }}',
  '          transition={reduceMotion ? { duration: 0.16 } : { duration: 0.78, ease: [0.4, 0.3, 0, 1] }}',
  '        >',
  '          {children}',
  '        </motion.div>',
  '      </AnimatePresence>',
  '    </div>',
  '  );',
  '}',
].join('\n');

const OVERLAP_STAGE_CSS = [
  '.overlap-transition-stage {',
  '  position: relative;',
  '  display: grid;',
  '  min-height: 0;',
  '  overflow: hidden;',
  '  isolation: isolate;',
  '}',
  '',
  '.overlap-transition-stage__layer {',
  '  grid-area: 1 / 1;',
  '  min-width: 0;',
  '  transform-origin: 50% 0;',
  '  will-change: clip-path, opacity, transform;',
  '}',
  '',
  '.overlap-transition-stage__layer:not(:last-child) { pointer-events: none; }',
].join('\n');

const OVERLAP_STAGE_USAGE = [
  "import { OverlapTransitionStage } from './OverlapTransitionStage';",
  "import './overlapTransition.css';",
  '',
  '<OverlapTransitionStage',
  '  direction={nextIndex > currentIndex ? \'forward\' : \'backward\'}',
  '  transitionKey={activePlatform}',
  '>',
  '  <Results platform={activePlatform} />',
  '</OverlapTransitionStage>',
].join('\n');

const BUNDLES: readonly ComponentBundle[] = [
  {
    assets: [],
    componentId: 'details-so-overlaptransitionstage',
    confidence: 0.86,
    dependencies: ['react', 'motion'],
    evidence: [
      { kind: 'observed', detail: 'The reference keeps its shared header mounted while the page container transitions.' },
      { kind: 'observed', detail: 'Incoming and outgoing containers overlap with separate stacking levels.' },
      { kind: 'reconstructed', detail: 'Incoming content uses a clipped vertical reveal; outgoing content lifts, fades, and scales down.' },
      { kind: 'inferred', detail: 'Vitrines uses Motion instead of Swup so the effect can remain component-scoped inside React.' },
    ],
    files: [
      { language: 'tsx', path: 'OverlapTransitionStage.tsx', source: OVERLAP_STAGE_SOURCE },
      { language: 'css', path: 'overlapTransition.css', source: OVERLAP_STAGE_CSS },
      { language: 'tsx', path: 'usage.tsx', source: OVERLAP_STAGE_USAGE },
    ],
    name: 'Overlap Transition Stage',
    sourceUrl: 'https://www.details.so/vault/page-transition-03',
    unknowns: [
      'The reference production timing may vary by route and content height.',
      'Its optional GSAP, SplitText, ScrollTrigger, and Lenis layers are intentionally excluded.',
    ],
    usage: OVERLAP_STAGE_USAGE,
  },
];

export function componentBundleFor(componentId: string): ComponentBundle | null {
  return BUNDLES.find((bundle) => bundle.componentId === componentId) ?? null;
}

export const COMPONENT_BUNDLES = BUNDLES;
