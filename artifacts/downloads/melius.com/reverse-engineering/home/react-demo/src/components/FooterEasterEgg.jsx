import { useEffect, useMemo, useRef, useState } from "react";

import { useMeliusScroll } from "./MeliusScrollProvider";

export const EASTER_EGG_ASSETS = [
  "ae48bdfd69c1883a4433.webp", "466149df6c01a85e5604.webp", "06ba3a8dc5a52baa94ba.webp", "b4740dccd1d1d48740d5.webp",
  "2bb9d3943bbb252f6026.webp", "8e5f0a5f882b9d276657.webp", "d76d1c9b9c07acf2ea99.webp", "c5bc4ee4b5de35dcaf68.webp",
  "f4c9cac8090ea2240921.webp", "b465e2aa9564d3d4e1ce.webp", "e316bee8f3d841ef6c30.webp", "d8fa6af08d0b45a4a870.webp",
  "5c4b261baebc788b0ef6.webp", "8b975817df73aa945f36.webp", "f70a8baec3ff9d04734a.webp", "b313a4a7ef11284435ac.webp",
  "f838a2038fe3d980140d.webp", "5195dbca6eabde50092b.webp", "437333e7a5749f5be859.webp", "7d330bb66a079121048e.webp",
  "6e5a1892b13e3496734a.webp", "1599fa08a6c8bbd4a9d2.webp", "70957fdf8a8486da43d5.webp", "b8991244adb7e412f55e.webp",
  "11ffa7a4f26ba7f601a7.webp", "f4a6ee528437462c23d4.webp", "b1c3bce78eb8b4f84c83.webp", "eff2e46764ade37d90a6.webp",
  "39e1603232116909191f.webp", "e7b31f05ad13923e6358.webp", "7014c8812fab9e661c3d.webp", "7db19f3aca33d1e79c79.webp",
  "9ab5e171aa3456cf1c68.webp", "9525dffef5e1992bd507.webp", "bc030f7741cbb3b91043.webp", "c091d7aa1b666d8a8d2c.webp",
];

const CTA_LABEL = "Sign up for free";

const SHAPE_MASK = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -30.73 730 287.28' preserveAspectRatio='none'><path fill='#fff' d='M692.04 7.7856L709.237 1.18375C730 -4.37955 730 10.4913 730 28.5651V201.295C730 219.369 730 234.24 709.237 228.677L692.04 222.075C617.468 193.431 541.179 178.964 464.629 178.964H265.372C188.821 178.964 112.532 193.431 37.9599 222.075L20.7627 228.713C2 233.74 0 219.405 0 201.295L0 28.5651C0 10.4913 0 -4.37961 20.7627 1.18375L37.9164 7.7856C112.467 36.4296 188.756 50.8599 265.285 50.8599L464.694 50.8599C541.222 50.8599 617.49 36.3936 692.04 7.7856Z'/></svg>")}`;

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function seededNoise(value) {
  const noise = 43758.5453 * Math.sin(value);
  return noise - Math.floor(noise);
}

function modulo(value, length) {
  return ((value % length) + length) % length;
}

function getCardMetrics(width, height) {
  const isMobile = width < 768;
  let cardWidth = Math.round(134 * Math.min(1, Math.max(isMobile ? 0.558 : 0.5, width / 1024)));
  let cardHeight = Math.round(cardWidth * 1.2388059701492537);
  const maxHeight = height * (isMobile ? 0.2 : 0.28);
  if (cardHeight > maxHeight) {
    cardHeight = Math.round(maxHeight);
    cardWidth = Math.round(cardHeight / 1.2388059701492537);
  }
  return { width: cardWidth, height: cardHeight, step: cardWidth * (isMobile ? 0.35 : 0.5), isMobile };
}

export function FooterEasterEgg({ assetBase = "/assets/", assetUrls, initiallyRevealed = false, viewportSize }) {
  const { prefersReducedMotion, scrollTo } = useMeliusScroll();
  const [revealed, setRevealed] = useState(false);
  const [viewport, setViewport] = useState(() => viewportSize ?? ({ width: window.innerWidth, height: window.innerHeight }));
  const accumulatedDelta = useRef(0);
  const cardRefs = useRef([]);
  const rootRef = useRef(null);
  const touchY = useRef(null);
  const images = useMemo(() => shuffled(EASTER_EGG_ASSETS), []);
  const metrics = useMemo(() => getCardMetrics(viewport.width, viewport.height), [viewport]);
  const cards = useMemo(() => {
    if (!viewport.width) return [];
    const count = Math.ceil((viewport.width + 2 * metrics.width) / metrics.step) + 1;
    const start = -metrics.width;
    return Array.from({ length: count }, (_, index) => {
      const left = start + index * metrics.step;
      const center = left + metrics.width / 2;
      const topRatio = (metrics.isMobile ? 0.75 : 0.7) - (metrics.isMobile ? 0.1 : 0.2) * Math.sin((center / viewport.width) * 1.5 * Math.PI * 2);
      return { asset: images[index % images.length], left, topRatio };
    });
  }, [images, metrics, viewport.width]);

  useEffect(() => {
    if (!initiallyRevealed) return undefined;
    const frame = window.requestAnimationFrame(() => setRevealed(true));
    return () => window.cancelAnimationFrame(frame);
  }, [initiallyRevealed]);

  useEffect(() => {
    if (viewportSize) {
      setViewport(viewportSize);
      return undefined;
    }
    function updateViewport() { setViewport({ width: window.innerWidth, height: window.innerHeight }); }
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [viewportSize]);

  useEffect(() => {
    function consume(delta) {
      if (revealed) return;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
      if (delta <= 0 || !atBottom) {
        accumulatedDelta.current = 0;
        return;
      }
      accumulatedDelta.current += delta;
      if (accumulatedDelta.current >= 240) setRevealed(true);
    }

    function onWheel(event) { consume(event.deltaY); }
    function onTouchStart(event) { touchY.current = event.touches[0]?.clientY ?? null; }
    function onTouchMove(event) {
      const nextY = event.touches[0]?.clientY ?? 0;
      if (touchY.current !== null) consume((touchY.current - nextY) * 2.5);
      touchY.current = nextY;
    }
    function onTouchEnd() { touchY.current = null; }

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [revealed]);

  useEffect(() => {
    if (!revealed) return undefined;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        scrollTo("bottom", {
          duration: 1.05,
          easing: (value) => -(Math.cos(Math.PI * value) - 1) / 2,
          force: true,
          immediate: prefersReducedMotion(),
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [prefersReducedMotion, revealed, scrollTo]);

  useEffect(() => {
    if (!revealed || !cards.length || !viewport.width) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const baseSpeed = metrics.isMobile ? 28 : 42;
    const bobAmount = metrics.isMobile ? 7 : 12;
    const loopLength = cards.length * metrics.step;
    const start = -metrics.width;
    const curveCenter = metrics.isMobile ? 0.75 : 0.7;
    const curveDepth = metrics.isMobile ? 0.1 : 0.2;
    const characteristics = cards.map((_, index) => ({
      bob: bobAmount * (0.65 + 0.7 * seededNoise(index + 7)),
      rotation: 2.5 * (0.65 + 0.7 * seededNoise(index + 17)),
      phaseY: seededNoise(index + 43) * Math.PI * 2,
      phaseRotation: seededNoise(index + 53) * Math.PI * 2,
    }));
    const motion = cards.map(() => ({ cursorX: 0, y: 0, rotation: 0, scale: 1, streamLeft: null }));
    let pointerX = viewport.width / 2;
    let pointerY = viewport.height / 2;
    let pointerActive = false;
    let lastPointerMove = -Infinity;
    let hovering = false;
    let hoverInfluence = 0;
    let speed = baseSpeed;
    let offset = 0;
    let previousTime = null;
    let frame = 0;

    function onPointerMove(event) {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerActive = true;
      lastPointerMove = event.timeStamp;
    }
    function onPointerOut(event) { if (!event.relatedTarget) pointerActive = false; }

    function animate(now) {
      const delta = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const rootBox = rootRef.current?.getBoundingClientRect();
      if (!rootBox) {
        frame = window.requestAnimationFrame(animate);
        return;
      }

      let pointerOverCard = false;
      if (pointerActive) {
        for (let index = 0; index < cards.length; index += 1) {
          const card = cards[index];
          const item = motion[index];
          const streamLeft = start + modulo(card.left - start + offset, loopLength);
          const centerX = rootBox.left + streamLeft + metrics.width / 2 + item.cursorX;
          const centerY = rootBox.top + card.topRatio * rootBox.height + item.y;
          if (Math.abs(pointerX - centerX) <= metrics.width / 2 * item.scale && Math.abs(pointerY - centerY) <= metrics.height / 2 * item.scale) {
            pointerOverCard = true;
            break;
          }
        }
      }

      hovering = pointerOverCard && (hovering || now - lastPointerMove < 160);
      const targetSpeed = hovering ? 0 : baseSpeed;
      speed += (targetSpeed - speed) * (hovering ? 0.22 : 0.08);
      if (Math.abs(speed) < 0.01) speed = 0;
      offset += speed * delta;
      hoverInfluence += ((hovering ? 1 : 0) - hoverInfluence) * 0.14;
      const pointerForceX = (pointerX / window.innerWidth) * 2 - 1;
      const pointerForceY = (pointerY / window.innerHeight) * 2 - 1;

      cardRefs.current.forEach((node, index) => {
        if (!node) return;
        const card = cards[index];
        const item = motion[index];
        const characteristic = characteristics[index];
        const streamLeft = start + modulo(card.left - start + offset, loopLength);
        const wrapped = item.streamLeft !== null && streamLeft < item.streamLeft - loopLength / 2;
        const translateX = streamLeft - card.left;
        const curveY = (curveCenter - curveDepth * Math.sin(((streamLeft + metrics.width / 2) / viewport.width) * 1.5 * Math.PI * 2) - card.topRatio) * rootBox.height;
        const bobY = (Math.sin(0.025 * offset + characteristic.phaseY) - Math.sin(characteristic.phaseY)) * characteristic.bob;
        const targetY = curveY + bobY + 8 * pointerForceY * hoverInfluence;
        const targetRotation = (Math.sin(0.018 * offset + characteristic.phaseRotation) - Math.sin(characteristic.phaseRotation)) * characteristic.rotation;
        const targetCursorX = 8 * pointerForceX * hoverInfluence;
        const centerX = rootBox.left + streamLeft + metrics.width / 2;
        const centerY = rootBox.top + card.topRatio * rootBox.height + targetY;
        const targetScale = 1 + 0.3 * Math.max(0, 1 - Math.hypot(pointerX - centerX, pointerY - centerY) / 300) * hoverInfluence;

        item.cursorX += (targetCursorX - item.cursorX) * 0.1;
        item.y = wrapped ? targetY : item.y + (targetY - item.y) * 0.1;
        item.rotation = wrapped ? targetRotation : item.rotation + (targetRotation - item.rotation) * 0.1;
        item.scale += (targetScale - item.scale) * 0.08;
        item.streamLeft = streamLeft;
        node.style.transform = `translate(${translateX + item.cursorX}px, ${item.y}px) rotate(${item.rotation}deg) scale(${item.scale})`;
      });
      frame = window.requestAnimationFrame(animate);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.cancelAnimationFrame(frame);
    };
  }, [cards, metrics, revealed, viewport]);

  return <div className="footer-easter-egg" data-footer-easter-egg data-revealed={revealed} ref={rootRef}>
    <div className="footer-easter-egg__step" aria-hidden="true">
      <div className="footer-easter-egg__shape" style={{ WebkitMaskImage: `url("${SHAPE_MASK}")`, maskImage: `url("${SHAPE_MASK}")` }} />
      <div className="footer-easter-egg__coin-track"><div className="footer-easter-egg__coin"><img alt="Coin" src={assetUrls?.["782641dca23238877693.webp"] ?? `${assetBase}782641dca23238877693.webp`} /></div></div>
    </div>
    <div className="footer-easter-egg__cards" aria-hidden="true">
      {cards.map((card, index) => <span className="footer-easter-egg__card-reveal" key={`${card.asset}-${index}`} style={{ width: metrics.width, height: metrics.height, left: card.left, top: `calc(${card.topRatio * 100}% - ${metrics.height / 2}px)`, "--card-index": index }}>
        <span className="footer-easter-egg__card" data-footer-easter-egg-card={index} ref={(node) => { cardRefs.current[index] = node; }}><img alt="" src={assetUrls?.[card.asset] ?? `${assetBase}${card.asset}`} /></span>
      </span>)}
    </div>
    <a className="footer-easter-egg__cta" href="https://app.melius.com/signup" rel="noopener noreferrer" target="_blank">
      <span className="footer-easter-egg__cta-label" aria-label={CTA_LABEL}>
        {CTA_LABEL.split("").map((character, index) => character === " "
          ? " "
          : <span aria-hidden="true" className="footer-easter-egg__cta-letter" key={`${character}-${index}`} style={{ "--cta-letter-index": index }}>{character}</span>)}
      </span>
      <span className="footer-easter-egg__cta-icon-row">
        <span className="footer-easter-egg__cta-icon" aria-hidden="true">
          <span className="footer-easter-egg__pixel-arrow" />
        </span>
      </span>
    </a>
  </div>;
}
