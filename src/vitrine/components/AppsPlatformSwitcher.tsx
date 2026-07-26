import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Button } from '@astryxdesign/core';
import type { Platform } from '../../platformFromUrl';
import { PLATFORM_LABEL } from '../../platformFromUrl';

const PLATFORM_ORDER: readonly Platform[] = ['web', 'ios', 'android'];

interface AppsPlatformSwitcherProps {
  value: Platform;
  platforms?: readonly Platform[];
  onChange: (platform: Platform) => void;
  ariaLabel?: string;
}

export function AppsPlatformSwitcher({
  value,
  platforms = PLATFORM_ORDER,
  onChange,
  ariaLabel = 'App platform',
}: AppsPlatformSwitcherProps) {
  const buttonRefs = useRef<Partial<Record<Platform, HTMLButtonElement>>>({});
  const available = PLATFORM_ORDER.filter((platform) => platforms.includes(platform));
  const options = available.length > 0 ? available : [value];
  const activeIndex = Math.max(0, options.indexOf(value));
  const style = {
    '--apps-platform-indicator-width': `calc((100% - ${6 + ((options.length - 1) * 2)}px) / ${options.length})`,
    '--apps-platform-indicator-shift': `calc(${activeIndex * 100}% + ${activeIndex * 2}px)`,
  } as CSSProperties;

  const selectByKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const targetIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : offset
          ? (index + offset + options.length) % options.length
          : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const nextPlatform = options[targetIndex];
    onChange(nextPlatform);
    buttonRefs.current[nextPlatform]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="apps-platform-switcher"
      style={style}
    >
      {options.map((platform, index) => (
        <Button
          key={platform}
          ref={(node) => { buttonRefs.current[platform] = node ?? undefined; }}
          label={PLATFORM_LABEL[platform]}
          variant="ghost"
          size="sm"
          role="radio"
          aria-checked={platform === value}
          aria-label={PLATFORM_LABEL[platform]}
          tabIndex={platform === value ? 0 : -1}
          onClick={() => onChange(platform)}
          onKeyDown={(event) => selectByKeyboard(event, index)}
        />
      ))}
    </div>
  );
}
