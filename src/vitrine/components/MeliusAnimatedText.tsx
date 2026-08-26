import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

export interface MeliusAnimatedTextProps {
  ariaLabel?: string;
  className?: string;
  text: string;
}

export function MeliusAnimatedText({
  ariaLabel,
  className = '',
  text,
}: MeliusAnimatedTextProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [entered, setEntered] = useState(false);
  const textScale = Math.min(1, Math.max(0.45, 10 / Math.max(1, text.trim().length)));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    if (!root || !rect) return;

    const scaleX = rect.width / Math.max(1, root.clientWidth) || 1;
    const scaleY = rect.height / Math.max(1, root.clientHeight) || 1;
    const radius = Math.min(220, Math.max(90, root.clientWidth * 0.2));
    root.style.setProperty('--melius-text-x', `${(event.clientX - rect.left) / scaleX}px`);
    root.style.setProperty('--melius-text-y', `${(event.clientY - rect.top) / scaleY}px`);
    root.style.setProperty('--melius-text-radius', `${radius}px`);
  };

  return (
    <div
      aria-label={ariaLabel ?? text}
      className={`melius-animated-text ${className}`.trim()}
      data-active={active}
      data-entered={entered}
      data-melius-animated-text={text}
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return;
        updatePointer(event);
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onPointerMove={updatePointer}
      ref={rootRef}
      role="img"
      style={{ '--melius-text-scale': textScale } as CSSProperties}
    >
      <span aria-hidden="true" className="melius-animated-text__layer melius-animated-text__layer--static">{text}</span>
      <span aria-hidden="true" className="melius-animated-text__layer melius-animated-text__layer--reveal">{text}</span>
    </div>
  );
}
