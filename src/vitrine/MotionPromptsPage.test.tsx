import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MOTION_PROMPTS,
  MotionPromptsPage,
} from './components/MotionPromptsPage.tsx';
import {
  MotionPromptDialog,
  motionPromptForAgent,
} from './components/MotionPromptDialog.tsx';

test('renders a Motion prompt catalogue with shared media cards and no duplicate search field', () => {
  const html = renderToStaticMarkup(<MotionPromptsPage />);

  assert.match(html, /Motion prompt controls/);
  assert.match(html, /All motion/);
  assert.match(html, /Scroll &amp; parallax/);
  assert.match(html, /Cinematic scroll story/);
  assert.deepEqual(
    MOTION_PROMPTS.map((prompt) => prompt.previewVideoUrl),
    [
      '/motion/cinematic-scroll-story.mp4',
      '/motion/magnetic-product-cards.mp4',
      '/motion/editorial-page-transition.mp4',
      '/motion/kinetic-type-marquee.mp4',
      '/motion/depth-led-hero.mp4',
      '/motion/staged-content-reveal.mp4',
    ],
  );
  assert.match(html, /Open Cinematic scroll story prompt/);
  assert.match(html, /data-motion-prompt-card="cinematic-scroll-story"/);
  assert.match(html, /Open Cinematic scroll story prompt/);
  assert.doesNotMatch(html, /Search Motion prompts/);
});

test('uses the Flow-style modal with Site and Prompt tabs', () => {
  const html = renderToStaticMarkup(
    <MotionPromptDialog prompt={MOTION_PROMPTS[0]!} onClose={() => undefined} initialMode="prompt" />,
  );

  assert.match(html, /role="tab"[\s\S]*?Site/);
  assert.match(html, /role="tab"[\s\S]*?Prompt/);
  assert.match(html, /Copy prompt/);
  assert.match(html, /Claude Code/);
  assert.match(html, /motion-agent-icon/);
  assert.match(html, /brand-icons\/claude\.svg/);
  assert.match(html, /cursor\.com\/favicon\.svg/);
  assert.doesNotMatch(html, /Ready to build/);
  assert.match(html, /data-motion-prompt-dialog="cinematic-scroll-story"/);
});

test('keeps the Site tab focused on its reference image', () => {
  const html = renderToStaticMarkup(
    <MotionPromptDialog prompt={MOTION_PROMPTS[0]!} onClose={() => undefined} />,
  );

  assert.match(html, /Cinematic scroll story site reference/);
  assert.doesNotMatch(html, /A full-viewport scene that advances through a product narrative/);
});

test('adapts the canonical prompt to the selected agent', () => {
  assert.match(motionPromptForAgent(MOTION_PROMPTS[0]!, 'cursor'), /existing React codebase/);
  assert.match(motionPromptForAgent(MOTION_PROMPTS[0]!, 'cursor'), /cinematic scroll-driven landing-page hero/);
});
