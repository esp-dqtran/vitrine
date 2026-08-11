import { Button } from '@astryxdesign/core';
import { useMemo, useState } from 'react';
import { AstryxSingleSelectDropdown } from './AstryxDropdown.tsx';
import { DiscoveryPageLayout } from './DiscoveryPageLayout.tsx';
import { MediaGridCard } from './MediaGridCard.tsx';
import { MotionPromptDialog } from './MotionPromptDialog.tsx';
import { ReferenceDiscoveryFacetGroup } from './ReferenceDiscoveryFacetGroup.tsx';

type MotionType = 'all' | 'scroll' | 'hover' | 'transition' | 'text' | 'three-d' | 'reveal';

export interface MotionPrompt {
  id: string;
  title: string;
  type: Exclude<MotionType, 'all'>;
  typeLabel: string;
  description: string;
  imageUrl: string;
  previewVideoUrl?: string;
  tileAspectRatio: string;
  prompt: string;
}

const MOTION_TYPES: ReadonlyArray<{ value: MotionType; label: string }> = [
  { value: 'all', label: 'All motion' },
  { value: 'scroll', label: 'Scroll & parallax' },
  { value: 'hover', label: 'Hover & cursor' },
  { value: 'transition', label: 'Page transitions' },
  { value: 'text', label: 'Text & marquee' },
  { value: 'three-d', label: '3D / WebGL' },
  { value: 'reveal', label: 'Loaders & reveals' },
];

const QUICK_FILTERS: readonly MotionType[] = ['all', 'scroll', 'hover', 'transition', 'three-d'];

export const MOTION_PROMPTS: readonly MotionPrompt[] = [
  {
    id: 'cinematic-scroll-story',
    title: 'Cinematic scroll story',
    type: 'scroll',
    typeLabel: 'Scroll & parallax',
    description: 'A full-viewport scene that advances through a product narrative as the page scrolls.',
    imageUrl: '/animated-sites/astryx-descent/frames/desktop/frame-0064.webp',
    previewVideoUrl: '/motion/cinematic-scroll-story.mp4',
    tileAspectRatio: '4 / 5',
    prompt: 'Build a cinematic scroll-driven landing-page hero in React. Keep one full-viewport visual stage sticky while the visitor scrolls through five narrative beats. Crossfade and subtly scale the visual between beats, preserve readable copy, support keyboard navigation, respect prefers-reduced-motion, and keep the first frame fast to load.',
  },
  {
    id: 'magnetic-product-cards',
    title: 'Magnetic product cards',
    type: 'hover',
    typeLabel: 'Hover & cursor',
    description: 'Cards react softly to pointer position, then settle cleanly when focus leaves.',
    imageUrl: '/animated-sites/astryx/frames/desktop/frame-0087.webp',
    previewVideoUrl: '/motion/magnetic-product-cards.mp4',
    tileAspectRatio: '4 / 3',
    prompt: 'Create a responsive product-card grid in React with subtle pointer-following tilt and image parallax. The interaction must be decorative only: keep cards fully usable by keyboard, remove the pointer effect for touch and reduced-motion users, and return every card to its resting state on blur or pointer leave.',
  },
  {
    id: 'editorial-page-transition',
    title: 'Editorial page transition',
    type: 'transition',
    typeLabel: 'Page transitions',
    description: 'A restrained route transition that carries colour and hierarchy between pages.',
    imageUrl: '/animated-sites/astryx-v3/frames/desktop/frame-0091.webp',
    previewVideoUrl: '/motion/editorial-page-transition.mp4',
    tileAspectRatio: '4 / 3',
    prompt: 'Implement an editorial page transition for a React site. On navigation, animate the outgoing content down to 96% opacity and reveal the incoming page with a short vertical rise. Do not delay navigation for more than 220ms, preserve browser focus, announce the new page title, and use an instant transition for reduced-motion users.',
  },
  {
    id: 'kinetic-type-marquee',
    title: 'Kinetic type marquee',
    type: 'text',
    typeLabel: 'Text & marquee',
    description: 'Large type moves with purpose to reinforce a campaign message without becoming noise.',
    imageUrl: '/animated-sites/astryx-descent/frames/desktop/frame-0101.webp',
    previewVideoUrl: '/motion/kinetic-type-marquee.mp4',
    tileAspectRatio: '1 / 1',
    prompt: 'Build a horizontal kinetic-type marquee for a landing page. Use semantic text, duplicate only the minimum content needed for a seamless loop, pause the animation on hover and keyboard focus, avoid autoplay for reduced-motion users, and make the message understandable even when the animation is stopped.',
  },
  {
    id: 'depth-led-hero',
    title: 'Depth-led hero',
    type: 'three-d',
    typeLabel: '3D / WebGL',
    description: 'Layered product surfaces create depth while the hero stays legible and fast.',
    imageUrl: '/animated-sites/astryx-v3/frames/desktop/frame-0121.webp',
    previewVideoUrl: '/motion/depth-led-hero.mp4',
    tileAspectRatio: '4 / 3',
    prompt: 'Create a premium React landing-page hero with three layered product panels. Use CSS transforms for gentle depth and a small pointer response; avoid a heavy 3D runtime. Keep the headline and CTA above the artwork, cap movement on mobile, preserve a static fallback, and ensure text contrast remains strong over every panel.',
  },
  {
    id: 'staged-content-reveal',
    title: 'Staged content reveal',
    type: 'reveal',
    typeLabel: 'Loaders & reveals',
    description: 'A fast, deliberate entrance sequence that gives a product launch page energy.',
    imageUrl: '/animated-sites/astryx/frames/desktop/frame-0137.webp',
    previewVideoUrl: '/motion/staged-content-reveal.mp4',
    tileAspectRatio: '4 / 5',
    prompt: 'Build a staged hero reveal in React: eyebrow, headline, supporting copy, then CTA. Use transform and opacity only, complete within 420ms, do not hide content from assistive technology, make the CTA immediately keyboard reachable, and render the fully visible end state when prefers-reduced-motion is enabled.',
  },
];

export function MotionPromptsPage() {
  const [motionType, setMotionType] = useState<MotionType>('all');
  const [selectedPrompt, setSelectedPrompt] = useState<MotionPrompt | null>(null);

  const visiblePrompts = useMemo(
    () => MOTION_PROMPTS.filter((prompt) => motionType === 'all' || prompt.type === motionType),
    [motionType],
  );

  return (
    <>
      <DiscoveryPageLayout
        kind="sites"
        header={null}
        taxonomyLabel="Motion prompt filters"
        taxonomy={(
          <ReferenceDiscoveryFacetGroup label="Build with motion" className="motion-prompts__facet">
            {QUICK_FILTERS.map((type) => {
              const option = MOTION_TYPES.find(({ value }) => value === type)!;
              return (
                <Button
                  key={type}
                  label={option.label}
                  variant="ghost"
                  size="sm"
                  aria-pressed={motionType === type}
                  onClick={() => setMotionType(type)}
                />
              );
            })}
          </ReferenceDiscoveryFacetGroup>
        )}
        toolbar={(
          <div className="motion-prompts__toolbar" aria-label="Motion prompt controls">
            <AstryxSingleSelectDropdown
              ariaLabel="Motion type"
              value={motionType}
              options={MOTION_TYPES}
              triggerClassName="motion-prompts__dropdown"
              menuWidth={232}
              onChange={(value) => setMotionType(value as MotionType)}
            />
          </div>
        )}
        resultLabel="motion prompts"
        singularResultLabel="motion prompt"
        totalCount={visiblePrompts.length}
        renderedCount={visiblePrompts.length}
        loading={false}
        error={null}
        loadMoreError={null}
        onRetry={() => undefined}
        onRetryLoadMore={() => undefined}
        onReset={() => {
          setMotionType('all');
        }}
      >
        <div className="reference-discovery__grid sites-discovery__grid motion-prompts__grid">
          {visiblePrompts.map((prompt) => (
            <article
              key={prompt.id}
              className="motion-video-card"
              data-motion-prompt-card={prompt.id}
            >
              <MediaGridCard
                label={`Open ${prompt.title} prompt`}
                kind={prompt.previewVideoUrl ? 'video' : 'image'}
                url={prompt.previewVideoUrl ?? prompt.imageUrl}
                posterUrl={prompt.imageUrl}
                imageFit="cover"
                aspectRatio={prompt.tileAspectRatio}
                deferMedia
                autoPlay={Boolean(prompt.previewVideoUrl)}
                loop={Boolean(prompt.previewVideoUrl)}
                onOpen={() => setSelectedPrompt(prompt)}
              />
              <div className="motion-video-card__copy">
                <h2>{prompt.title}</h2>
              </div>
            </article>
          ))}
        </div>
      </DiscoveryPageLayout>
      {selectedPrompt ? <MotionPromptDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} /> : null}
    </>
  );
}
