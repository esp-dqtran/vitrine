import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { Button, Heading, Text, TextInput, type InputStatus } from '@astryxdesign/core';
import type { AuthUser } from './authApi';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.7a2.5 2.5 0 003.5 3.5" />
          <path d="M6.6 6.7C4.5 8.1 3 10 3 12c0 0 3.5 7 9 7 1.7 0 3.2-.5 4.5-1.3" />
          <path d="M9.9 4.6A9.7 9.7 0 0112 4c5.5 0 9 7 9 7-.5 1-1.3 2.2-2.4 3.3" />
        </>
      ) : (
        <>
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
          <circle cx={12} cy={12} r={2.6} />
        </>
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 13 10 18 19 7" style={{ strokeDasharray: 32, strokeDashoffset: 32, animation: 'vtDraw .5s .15s cubic-bezier(.65,0,.35,1) forwards' }} />
    </svg>
  );
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <div style={{ width: 11, height: 11, borderRadius: 3, background: '#fff' }} />
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#171717' }}>Vitrine</span>
    </div>
  );
}

function PasswordField({ value, onChange, status }: { value: string; onChange: (v: string) => void; status?: InputStatus }) {
  const [show, setShow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // TextInput's own layout (label height, description, status message) isn't
  // part of its public API, so a hardcoded `top` guess drifts out of line with
  // the actual <input> box. Measure the real input instead and center against it.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    const input = wrap?.querySelector('input');
    if (!wrap || !btn || !input) return;
    const wrapRect = wrap.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    btn.style.top = `${inputRect.top - wrapRect.top + inputRect.height / 2}px`;
    btn.style.right = `${wrapRect.right - inputRect.right}px`;
  });

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <TextInput label="Password" type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder="••••••••" status={status} />
      <button
        ref={btnRef}
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'transparent',
          borderRadius: 7,
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
        }}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

function SuccessPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18, animation: 'vtFadeUp .45s cubic-bezier(.16,1,.3,1) both' }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#16a34a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 26px rgba(22,163,74,0.28)',
          animation: 'vtRingPop .5s cubic-bezier(.16,1,.3,1) both',
        }}
      >
        <CheckIcon />
      </div>
      <Heading level={1}>You&rsquo;re in</Heading>
      <Text type="large" color="secondary">
        Signed in successfully. Taking you to your library&hellip;
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid var(--color-border-emphasized)',
            borderTopColor: 'var(--color-text-primary)',
            animation: 'vtSpin .7s linear infinite',
          }}
        />
        <Text type="supporting" color="secondary">
          Redirecting
        </Text>
      </div>
    </div>
  );
}

// Cards echoing the rest of Vitrine's catalog on the right-hand showcase panel.
// These are marketing placeholders (no real screenshot to load), not live data.
const SHOWCASE = [
  { app: 'Ledgerly', id: 'si-ledgerly', accent: '#3b6ef6', type: 'Dashboard' },
  { app: 'Cadence', id: 'si-cadence', accent: '#6b5bd6', type: 'Board' },
  { app: 'Beacon', id: 'si-beacon', accent: '#0891b2', type: 'Reports' },
  { app: 'Palette', id: 'si-palette', accent: '#e0518a', type: 'Editor' },
];

function slidePos(i: number, index: number, count: number) {
  if (i === index) return { tx: 0, rot: 0, scale: 1, opacity: 1, z: 3 };
  const diff = (i - index + count) % count;
  if (diff === 1) return { tx: 38, rot: -12, scale: 0.94, opacity: 0, z: 1 };
  if (diff === count - 1) return { tx: -38, rot: 12, scale: 0.94, opacity: 0, z: 1 };
  return { tx: 0, rot: 0, scale: 0.88, opacity: 0, z: 0 };
}

function SlidePlaceholder({ accent, app, type }: { accent: string; app: string; type: string }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg,${accent}33,#101012 68%)` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', padding: 24 }}>
        {app} {type.toLowerCase()}
      </div>
    </>
  );
}

// Brand marks vendored from simple-icons (CC0). ChatGPT's was pulled from that
// set over trademark, so it comes from the official SVG: one petal path rotated
// six times about the viewBox centre.
const CHATGPT_PETAL =
  'M1107.3 299.1c-197.999 0-373.9 127.3-435.2 315.3L650 743.5v427.9c0 21.4 11 40.4 29.4 51.4l344.5 198.515V833.3h.1v-27.9L1372.7 604c33.715-19.52 70.44-32.857 108.47-39.828L1447.6 450.3C1361 353.5 1237.1 298.5 1107.3 299.1zm0 117.5-.6.6c79.699 0 156.3 27.5 217.6 78.4-2.5 1.2-7.4 4.3-11 6.1L952.8 709.3c-18.4 10.4-29.4 30-29.4 51.4V1248l-155.1-89.4V755.8c-.1-187.099 151.601-338.9 339-339.2z';

const LOGOS = {
  linear: {
    viewBox: '0 0 24 24',
    body: <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />,
  },
  airbnb: {
    viewBox: '0 0 24 24',
    body: <path d="M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z" />,
  },
  atlassian: {
    viewBox: '0 0 24 24',
    body: <path d="M7.12 11.084a.683.683 0 00-1.16.126L.075 22.974a.703.703 0 00.63 1.018h8.19a.678.678 0 00.63-.39c1.767-3.65.696-9.203-2.406-12.52zM11.434.386a15.515 15.515 0 00-.906 15.317l3.95 7.9a.703.703 0 00.628.388h8.19a.703.703 0 00.63-1.017L12.63.38a.664.664 0 00-1.196.006z" />,
  },
  chatgpt: {
    viewBox: '0 0 2406 2406',
    body: (
      <>
        <path id="vt-gpt" d={CHATGPT_PETAL} />
        {[60, 120, 180, 240, 300].map((deg) => (
          <use key={deg} href="#vt-gpt" transform={`rotate(${deg} 1203 1203)`} />
        ))}
      </>
    ),
  },
  claude: {
    viewBox: '0 0 24 24',
    body: <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />,
  },
  stripe: {
    viewBox: '0 0 24 24',
    body: <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />,
  },
} as const;

const APP_ICONS = [
  { logo: 'linear', label: 'Linear', color: '#5e6ad2', size: 46, rotate: -8, top: '4%', right: '8%', duration: 4.2, delay: 0, dx: 26, dy: -34, rswing: 12 },
  { logo: 'airbnb', label: 'Airbnb', color: '#ff5a5f', size: 32, rotate: 10, top: '15%', right: '24%', duration: 3.6, delay: 0.3, dx: -22, dy: -28, rswing: 14 },
  { logo: 'atlassian', label: 'Atlassian', color: '#0052cc', size: 40, rotate: -6, top: '42%', left: '2%', duration: 4.6, delay: 0.6, dx: 24, dy: 30, rswing: 10 },
  { logo: 'chatgpt', label: 'ChatGPT', color: '#74aa9c', size: 44, rotate: 9, top: '58%', right: '2%', duration: 3.9, delay: 0.9, dx: -26, dy: 26, rswing: 13 },
  { logo: 'claude', label: 'Claude', color: '#d97757', size: 34, rotate: -11, top: '78%', left: '5%', duration: 5.0, delay: 0.15, dx: 20, dy: -30, rswing: 9 },
  { logo: 'stripe', label: 'Stripe', color: '#635bff', size: 30, rotate: -5, top: '80%', right: '16%', duration: 4.4, delay: 0.45, dx: -24, dy: -22, rswing: 11 },
] satisfies ReadonlyArray<{ logo: keyof typeof LOGOS } & Record<string, unknown>>;

function FloatingIcon({ logo, label, color, size, rotate, style, duration, delay, dx, dy, rswing }: (typeof APP_ICONS)[number] & { style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  // The drift lives on this inner tile, never on the wrapper: the wrapper's
  // vtFadeUp entrance animates transform with fill-mode `both`, and a CSS
  // animation's applied value outranks inline styles — it would pin whatever
  // we write here (GSAP or otherwise) at identity for good.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.set(el, { rotate, x: 0, y: 0 });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // One yoyo'd sinusoid per axis, rather than a single `keyframes` tween:
    // keyframes' per-segment ease (`easeEach`) defaults to power1.inOut, which
    // parks the tile at a dead stop on every keyframe boundary. A yoyo'd
    // sine.inOut is a true sinusoid — velocity passes through the reversal
    // continuously, so there is no stutter anywhere in the loop.
    //
    // The periods are deliberately incommensurate (1 : 1.32 : 0.86). Equal
    // periods would let all three axes hit their extremes together and freeze
    // the tile in lockstep; detuned, the composite path never repeats exactly
    // and never fully stops. Amplitudes are centred on the authored position
    // (±half) so the icon drifts around where it was placed, not away from it.
    const spin = (from: object, to: object, period: number, offset: number) =>
      gsap.fromTo(el, from, {
        ...to,
        duration: period,
        delay: delay + offset,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

    const tweens = [
      spin({ y: -dy / 2 }, { y: dy / 2 }, duration, 0),
      spin({ x: -dx / 2 }, { x: dx / 2 }, duration * 1.32, 0.21),
      spin({ rotate: rotate - rswing }, { rotate: rotate + rswing }, duration * 0.86, 0.13),
    ];
    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, [rotate, dx, dy, rswing, duration, delay]);

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 1,
        animation: `vtFadeUp .6s cubic-bezier(.16,1,.3,1) ${delay * 0.3 + 0.15}s both`,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        ref={ref}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
          willChange: 'transform',
        }}
      >
        <svg
          role="img"
          aria-label={label}
          viewBox={LOGOS[logo].viewBox}
          width={Math.round(size * 0.54)}
          height={Math.round(size * 0.54)}
          fill="#fff"
        >
          {LOGOS[logo].body}
        </svg>
      </div>
    </div>
  );
}

const HEADLINE = 'The products you admire, taken apart.';
const SUBCOPY =
  'Browse real screens, UI elements, and end-to-end flows from the teams setting the standard. Save what inspires you.';

function HeroCopy() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const words = el.querySelectorAll('[data-word]');
    const sub = el.querySelector('[data-sub]');
    const targets = [...words, sub];

    // Both start hidden inline so there's no flash of unstyled copy before the
    // timeline takes over; reduced motion just reveals them in place.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(words, { opacity: 1, y: 0, duration: 0.7, stagger: 0.055 }, 0.15).to(
      sub,
      { opacity: 1, y: 0, duration: 0.6 },
      0.5,
    );
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div ref={root} style={{ position: 'relative', zIndex: 2, maxWidth: 460, marginBottom: 30 }}>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#fff' }}>
        {HEADLINE.split(' ').map((word, i) => (
          <span
            key={i}
            data-word
            style={{ display: 'inline-block', marginRight: '0.28em', opacity: 0, transform: 'translateY(18px)' }}
          >
            {word}
          </span>
        ))}
      </h2>
      <p
        data-sub
        style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: '#b4b4bb', maxWidth: 380, opacity: 0, transform: 'translateY(12px)' }}
      >
        {SUBCOPY}
      </p>
    </div>
  );
}

function Showcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = SHOWCASE.length;

  const cardStackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isFirstSlide = useRef(true);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 3600);
    return () => clearInterval(t);
  }, [paused, count]);

  // Animate the card stack to its new positions with GSAP instead of relying on
  // CSS transitions, matching the tab-indicator pattern in ScreenDetail.tsx.
  useLayoutEffect(() => {
    SHOWCASE.forEach((_, i) => {
      const el = slideRefs.current[i];
      if (!el) return;
      const p = slidePos(i, index, count);
      el.style.zIndex = String(p.z);
      el.style.pointerEvents = i === index ? 'auto' : 'none';
      const vars = { x: p.tx, rotateY: p.rot, scale: p.scale, opacity: p.opacity };
      if (isFirstSlide.current) gsap.set(el, vars);
      else gsap.to(el, { ...vars, duration: 0.6, ease: 'power3.out' });
    });
    isFirstSlide.current = false;
  }, [index, count]);

  useLayoutEffect(() => {
    const el = cardStackRef.current;
    if (!el) return;
    gsap.set(el, { transformPerspective: 900 });
  }, []);

  // quickTo can't resetTo() compound 3D-rotation props (same class of limitation
  // as borderRadius), so the tilt uses a plain .to() per move; GSAP's default
  // overwrite mode kills the prior in-flight tween on the same target/props.
  const tilt = (rotateX: number, rotateY: number) => {
    const el = cardStackRef.current;
    if (!el) return;
    gsap.to(el, { rotateX, rotateY, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tilt(py * -8, px * 8);
  };

  const active = SHOWCASE[index];
  const prevIdx = (index - 1 + count) % count;
  const nextIdx = (index + 1) % count;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        tilt(0, 0);
      }}
      onMouseMove={onMove}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'linear-gradient(160deg,#161618,#0c0c0e)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '32px 64px',
      }}
    >
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(107,91,214,0.28), transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,110,246,0.18), transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />

      {APP_ICONS.map((ic, i) => (
        <FloatingIcon key={i} {...ic} style={{ top: ic.top, left: ic.left, right: ic.right }} />
      ))}

      <HeroCopy />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 420, aspectRatio: '16/10', margin: '0 auto', animation: 'vtScaleIn .7s cubic-bezier(.16,1,.3,1) .1s both' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translate(-22px,10px) rotate(-6deg)',
            borderRadius: 16,
            overflow: 'hidden',
            background: `linear-gradient(160deg,${SHOWCASE[prevIdx].accent}26,#1c1c1f 70%)`,
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: 0.55,
            transition: 'transform .5s cubic-bezier(.16,1,.3,1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'translate(22px,14px) rotate(6deg)',
            borderRadius: 16,
            overflow: 'hidden',
            background: `linear-gradient(160deg,${SHOWCASE[nextIdx].accent}26,#1c1c1f 70%)`,
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: 0.4,
            transition: 'transform .5s cubic-bezier(.16,1,.3,1)',
          }}
        />

        <div
          ref={cardStackRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            overflow: 'hidden',
            background: '#101012',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            perspective: 1000,
          }}
        >
          {SHOWCASE.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <SlidePlaceholder accent={s.accent} app={s.app} type={s.type} />
            </div>
          ))}
          <div
            key={'pill-' + index}
            style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 999, background: 'rgba(255,255,255,0.94)', animation: 'vtFadeUp .4s cubic-bezier(.16,1,.3,1) .15s both' }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 5, background: active.accent }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{active.app}</span>
          </div>
          <div key={'badge-' + index} style={{ position: 'absolute', top: 12, right: 12, zIndex: 4, animation: 'vtFadeUp .4s cubic-bezier(.16,1,.3,1) .15s both' }}>
            <span style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)' }}>
              {active.type}
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 6, justifyContent: 'center', marginTop: 36, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .5s both' }}>
        {SHOWCASE.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setIndex(i)}
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: 3,
              cursor: 'pointer',
              background: i === index ? '#fff' : 'rgba(255,255,255,0.28)',
              transition: 'width .25s cubic-bezier(.16,1,.3,1), background .25s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function SignIn({
  authenticate,
  onSignedIn,
}: {
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  onSignedIn: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailStatus, setEmailStatus] = useState<InputStatus | undefined>(undefined);
  const [passwordStatus, setPasswordStatus] = useState<InputStatus | undefined>(undefined);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [success, setSuccess] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!success || !authenticatedUser) return;
    const timeout = setTimeout(() => onSignedIn(authenticatedUser), 1400);
    return () => clearTimeout(timeout);
  }, [success, authenticatedUser, onSignedIn]);

  const validate = () => {
    let ok = true;
    if (!email.trim() || !email.includes('@')) {
      setEmailStatus({ type: 'error', message: 'Enter a valid email address' });
      ok = false;
    } else setEmailStatus(undefined);
    if (!password) {
      setPasswordStatus({ type: 'error', message: 'Enter your password' });
      ok = false;
    } else setPasswordStatus(undefined);
    return ok;
  };

  const submitAction = async () => {
    if (!validate()) {
      setShakeNonce((nonce) => nonce + 1);
      return;
    }
    try {
      const user = await authenticate(email.trim(), password);
      setAuthenticatedUser(user);
      setSuccess(true);
    } catch {
      setPasswordStatus({ type: 'error', message: 'Invalid email or password' });
      setShakeNonce((nonce) => nonce + 1);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: '#fff' }}>
      <div style={{ flex: '1 1 480px', minWidth: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 44, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) both' }}>
            <Wordmark />
          </div>

          {success ? (
            <SuccessPanel />
          ) : (
            <>
              <div style={{ marginBottom: 30, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .05s both' }}>
                <Heading level={1}>Welcome back</Heading>
                <div style={{ marginTop: 8 }}>
                  <Text type="large" color="secondary">
                    Sign in to pick up your saved screens and boards.
                  </Text>
                </div>
              </div>

              <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div
                  key={'email-wrap-' + shakeNonce}
                  style={{ animation: shakeNonce ? 'vtShake .4s cubic-bezier(.36,.07,.19,.97) both, vtFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both' : 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .1s both' }}
                >
                  <TextInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" status={emailStatus} />
                </div>
                <div
                  key={'pw-wrap-' + shakeNonce}
                  style={{ animation: shakeNonce ? 'vtShake .4s .02s cubic-bezier(.36,.07,.19,.97) both, vtFadeUp .5s cubic-bezier(.16,1,.3,1) .15s both' : 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .15s both' }}
                >
                  <PasswordField value={password} onChange={setPassword} status={passwordStatus} />
                </div>

                <div style={{ marginTop: 6, animation: 'vtFadeUp .5s cubic-bezier(.16,1,.3,1) .2s both' }}>
                  <Button type="submit" variant="primary" size="lg" label="Sign in" clickAction={submitAction} style={{ width: '100%' }} />
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: '1 1 55%', minWidth: 0 }}>
        <Showcase />
      </div>
    </div>
  );
}
