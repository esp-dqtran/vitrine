import { useEffect, useRef, type KeyboardEvent } from 'react';
import { AndroidLogo, AppleLogo, GlobeSimple } from '@phosphor-icons/react';
import { LayoutGroup, motion, useReducedMotion, type PanInfo } from 'motion/react';
import type { Platform } from '../../platformFromUrl';
import { PLATFORM_LABEL } from '../../platformFromUrl';

const PLATFORM_ORDER: readonly Platform[] = ['web', 'ios', 'android'];

interface AppsPlatformSwitcherProps {
  value: Platform;
  platforms?: readonly Platform[];
  onChange: (platform: Platform) => void;
  ariaLabel?: string;
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const iconProps = {
    'aria-hidden': true,
    className: 'apps-platform-switcher__icon',
    'data-platform-icon': platform,
    size: 17,
  } as const;

  if (platform === 'ios') return <AppleLogo {...iconProps} weight="regular" />;
  if (platform === 'android') return <AndroidLogo {...iconProps} weight="regular" />;
  return <GlobeSimple {...iconProps} weight="regular" />;
}

export function AppsPlatformSwitcher({
  value,
  platforms = PLATFORM_ORDER,
  onChange,
  ariaLabel = 'App platform',
}: AppsPlatformSwitcherProps) {
  const buttonRefs = useRef<Partial<Record<Platform, HTMLButtonElement>>>({});
  const pendingFocusRef = useRef<Platform | null>(null);
  const available = PLATFORM_ORDER.filter((platform) => platforms.includes(platform));
  const options = available.length > 0 ? available : [value];
  const activeIndex = Math.max(0, options.indexOf(value));
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (pendingFocusRef.current !== value) return;
    buttonRefs.current[value]?.focus();
    pendingFocusRef.current = null;
  }, [value]);

  const selectPlatform = (platform: Platform) => {
    if (platform === value) return;
    pendingFocusRef.current = platform;
    onChange(platform);
  };

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
    selectPlatform(nextPlatform);
  };

  const selectBySwipe = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const horizontalTravel = Math.abs(info.offset.x) >= 22;
    const horizontalFlick = Math.abs(info.velocity.x) >= 360;
    if (!horizontalTravel && !horizontalFlick) return;
    const step = info.offset.x < 0 || info.velocity.x < -360 ? 1 : -1;
    selectPlatform(options[(activeIndex + step + options.length) % options.length]);
  };

  return (
    <LayoutGroup id="apps-platform-switcher">
      <motion.div
        role="radiogroup"
        aria-label={ariaLabel}
        className="apps-platform-switcher"
        data-active-platform={value}
        drag={prefersReducedMotion ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.06}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 35 }}
        onDragEnd={selectBySwipe}
        style={{ touchAction: 'pan-y' }}
      >
        {options.map((platform, index) => (
          <motion.button
            key={platform}
            ref={(node) => { buttonRefs.current[platform] = node ?? undefined; }}
            layout
            transition={prefersReducedMotion ? { duration: 0 } : {
              layout: {
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.72,
              },
            }}
            type="button"
            className="apps-platform-switcher__option"
            title={PLATFORM_LABEL[platform]}
            role="radio"
            aria-checked={platform === value}
            aria-label={PLATFORM_LABEL[platform]}
            tabIndex={platform === value ? 0 : -1}
            onClick={() => selectPlatform(platform)}
            onKeyDown={(event) => selectByKeyboard(event, index)}
          >
            {platform === value ? (
              <motion.span
                aria-hidden="true"
                className="apps-platform-switcher__active-pill"
                layoutId="apps-platform-active-pill"
                transition={prefersReducedMotion ? { duration: 0 } : {
                  type: 'spring',
                  stiffness: 420,
                  damping: 34,
                  mass: 0.72,
                }}
              />
            ) : null}
            <span className="apps-platform-switcher__icon-wrap">
              <PlatformIcon platform={platform} />
            </span>
            <span aria-hidden="true" className="apps-platform-switcher__label">
              {PLATFORM_LABEL[platform]}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}
