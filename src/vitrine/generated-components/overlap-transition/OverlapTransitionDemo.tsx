import { useState } from 'react';
import { Button } from '@astryxdesign/core';
import { OverlapTransitionStage, type OverlapTransitionDirection } from './OverlapTransitionStage.tsx';

const SCENES = [
  {
    eyebrow: 'Collection 01',
    title: 'Interfaces with rhythm.',
    copy: 'A component-sized page transition with a stable shell and overlapping content layers.',
  },
  {
    eyebrow: 'Collection 02',
    title: 'Motion with hierarchy.',
    copy: 'The incoming surface rises above the outgoing one while navigation remains untouched.',
  },
] as const;

export function OverlapTransitionDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [direction, setDirection] = useState<OverlapTransitionDirection>('forward');
  const scene = SCENES[sceneIndex];

  const selectScene = (nextIndex: number) => {
    setDirection(nextIndex > sceneIndex ? 'forward' : 'backward');
    setSceneIndex(nextIndex);
  };

  return (
    <div className="overlap-transition-demo" data-live-component="OverlapTransitionStage">
      <header className="overlap-transition-demo__shell">
        <strong>Vitrines</strong>
        <div aria-label="Demo pages" role="group">
          {SCENES.map((_, index) => (
            <Button
              aria-pressed={sceneIndex === index}
              key={index}
              label={String(index + 1).padStart(2, '0')}
              onClick={() => selectScene(index)}
              variant="ghost"
            />
          ))}
        </div>
      </header>

      <OverlapTransitionStage direction={direction} transitionKey={String(sceneIndex)}>
        <section className={`overlap-transition-demo__scene overlap-transition-demo__scene--${sceneIndex + 1}`}>
          <span>{scene.eyebrow}</span>
          <h3>{scene.title}</h3>
          <p>{scene.copy}</p>
          <i aria-hidden="true" />
        </section>
      </OverlapTransitionStage>
    </div>
  );
}
