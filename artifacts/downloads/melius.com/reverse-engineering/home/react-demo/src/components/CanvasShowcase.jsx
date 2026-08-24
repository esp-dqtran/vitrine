import { useEffect, useRef, useState } from "react";

import { CanvasScene } from "./CanvasScene";
import { useMeliusScroll } from "./MeliusScrollProvider";

const categories = [
  { id: "advertising", label: "Advertising", prompt: "Create a Melius Mints campaign from product packaging and a studio-shot reference", background: "31e3db1c5e47daa7d22d.webp", width: 1100, media: [["node-1", 64, 150, 300, "Product Mockup", "GPT Image 2", "Image", "95caea352ed126fa508d.webp"], ["node-2-image", 460, 266, 220, "Studio Shot", "Nano Banana Pro", "Image", "88872a5492cfd32bb64e.webp"], ["node-2-video", 760, 15, 270, "Lifestyle Moment", "Seedance 2.0", "Video", "0b35cf63739d10344eb0.webm"]], connections: [["node-1", "node-2-image"], ["node-1", "node-2-video"]] },
  { id: "ecommerce", label: "E-commerce", prompt: "Create a PDP-ready product image from product, home environment, prop, and natural-light references", background: "43a22d7ff031ad3d8798.webp", width: 1200, media: [["node-1-1", 64, 15, 190, "Model", "Nano Banana Pro", "Image", "3819d63fe9fcb6c7ebbc.webp"], ["node-1-2", 64, 280, 190, "Pack Shot", "GPT Image 2", "Image", "26ff88bb49305d60c8c6.webp"], ["node-2", 350, 110, 300, "PDP Image", "GPT Image 2", "Image", "2aeda84b43e0d0c9d2f1.webp"], ["node-3", 790, 75, 300, "Product Motion", "Kling 3.0 Omni", "Video", "ee59325a84147e4f85ba.webm"]], connections: [["node-1-1", "node-2"], ["node-1-2", "node-2"], ["node-2", "node-3"]] },
  { id: "filmmaking", label: "Filmmaking", prompt: "Create a cinematic trailer frame from character, environment, camera, lens, lighting, and atmosphere references", background: "a78fee5757a232636c5c.webp", width: 1820, media: [["node-1", 56, 164, 300, "Still Sketch", "GPT Image 2", "Image", "d519f0f0f4dffe267e6b.webp"], ["node-2", 445, 143, 380, "Character Study", "Nano Banana 2", "Image", "8cf4de374884d268ea40.webp"], ["node-3", 915, 115, 380, "Movie Cut 1", "Seedance 2.0", "Video", "ca5fdf49f591c096e51a.webm"], ["node-4", 1385, 185, 380, "Movie Cut 2", "Seedance 2.0", "Video", "b602c016faa4f4f54810.webm"]], connections: [["node-1", "node-2"], ["node-2", "node-3"], ["node-3", "node-4"]] },
  { id: "fashion", label: "Fashion", prompt: "Turn a fabric swatch and croquis into a technical flat and campaign-ready garment images", background: "72b4130962ae4ae5c15b.webp", width: 1020, media: [["node-1-1", 54, 15, 135, "Croquis", "Ideogram 4", "Image", "f2effb7d3c9b4909f3b8.webp"], ["node-1-2", 54, 285, 135, "Fabric Swatch", "GPT Image 2", "Image", "770764d8ebceca5147f9.webp"], ["node-2", 280, 56, 300, "Garment Mockup", "Nano Banana Pro", "Image", "1df271b14f106572138e.webp"], ["node-3", 645, 56, 300, "Campaign Garment", "Nano Banana Pro", "Image", "4e86fccb23b6aefa65e6.webp"]], connections: [["node-1-1", "node-2"], ["node-1-2", "node-2"], ["node-2", "node-3"]] },
  { id: "branding", label: "Branding", prompt: "Turn icon variations into a selected mark, website mockup, and out-of-home billboard", background: "341dd0e93efae794a628.webm", width: 1190, media: [["node-1-1", 40, 30, 180, "Icon 01", "Ideogram 4", "Image", "02c53d2f2e584516de4f.webp"], ["node-1-2", 244, 30, 180, "Icon 02", "Ideogram 4", "Image", "7b62a071d0398b376f98.webp"], ["node-1-3", 40, 275, 180, "Icon 03", "Ideogram 4", "Image", "49ae8909c0fc469b4a21.webp"], ["node-1-4", 244, 275, 180, "Icon 04", "Ideogram 4", "Image", "84419ad9f8e99cfa5a20.webp"], ["node-2-1", 520, 15, 190, "Selected Mark", "Ideogram 4", "Image", "92751b5b588b5cf8dcf3.webp"], ["node-2-2", 520, 290, 190, "Website Mockup", "Nano Banana Pro", "Image", "ba77c2f656172fcb4f95.webp"], ["node-3", 810, 92, 320, "OOH Billboard", "Nano Banana Pro", "Image", "2652bedf10ca87e3ef5c.webp"]], connections: [["node-1-1", "node-1-2"], ["node-1-3", "node-1-4"], ["node-1-2", "node-2-1"], ["node-1-4", "node-2-2"], ["node-2-1", "node-3"], ["node-2-2", "node-3"]] },
];

function makeScene(category) {
  return {
    width: category.width,
    media: category.media.map(([id, x, y, maxWidth, title, model, tag, asset]) => ({ id, x, y, maxWidth, title, model, tag, media: tag === "Video" ? { type: "video", video: { src: asset, width: 16, height: 9, label: title } } : { type: "image", image: { src: asset, width: 4, height: 3, alt: title } } })),
    connections: category.connections.map(([from, to]) => ({ from, to })),
  };
}

function CanvasBackgroundMedia({ active, assetBase, category }) {
  const videoRef = useRef(null);
  const isVideo = category.background.endsWith(".webm");
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (active && !reducedMotion) videoRef.current.play().catch(() => {});
    else videoRef.current.pause();
  }, [active, isVideo]);
  return isVideo
    ? <video loop muted playsInline ref={videoRef} src={`${assetBase}${category.background}`} />
    : <img alt="" src={`${assetBase}${category.background}`} />;
}

function CanvasBackground({ active, assetBase, visited }) {
  return <div aria-hidden="true" className="canvas-orchestrator__backgrounds">{categories.filter((category) => visited.has(category.id)).map((category, index) => {
    const isActive = categories[active].id === category.id;
    return <div className="canvas-orchestrator__background" data-active={isActive} key={category.id}><CanvasBackgroundMedia active={isActive} assetBase={assetBase} category={category} />{index === 0 ? null : null}</div>;
  })}<div className="canvas-orchestrator__noise" /></div>;
}

function CanvasDock({ active, dockRef, onSelect, text }) {
  const rowRef = useRef(null);
  const buttonRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const button = buttonRefs.current[active];
    const row = rowRef.current;
    if (!button || !row) return;
    setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
    row.scrollTo({ left: Math.max(0, button.offsetLeft - 20), behavior: "smooth" });
  }, [active]);
  const category = categories[active];
  const prompt = text || category.prompt;
  const complete = text === category.prompt;
  const signupUrl = `https://app.melius.com/signup?prompt=${encodeURIComponent(category.prompt)}`;

  return <aside className="canvas-orchestrator__dock" aria-label="Canvas showcase controls" data-docked="false" data-visible="false" ref={dockRef}>
    <div className="canvas-orchestrator__dock-shell">
      <div className="canvas-orchestrator__tabs" ref={rowRef} role="tablist">
        <i aria-hidden="true" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
        {categories.map((item, index) => <button aria-current={index === active ? "true" : undefined} key={item.id} onClick={() => onSelect(index)} ref={(element) => { buttonRefs.current[index] = element; }} role="tab" type="button"><span>{item.label}</span></button>)}
      </div>
      <div className="canvas-orchestrator__prompt" data-complete={complete}>
        <img alt="" aria-hidden="true" className="canvas-orchestrator__prompt-mark" src="/assets/melius-prompt-mark.svg" />
        <span className="canvas-orchestrator__prompt-text">{prompt}</span>
        <a aria-label="Sign up" className="canvas-orchestrator__prompt-cta" href={signupUrl} rel="noopener noreferrer" target="_blank">
          <img alt="" aria-hidden="true" src="/assets/melius-pixel-arrow.svg" />
        </a>
      </div>
    </div>
  </aside>;
}

export function CanvasShowcase({ assetBase }) {
  const { onScroll, onVirtualScroll, prefersReducedMotion, scrollTo } = useMeliusScroll();
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState(() => new Set([categories[0].id]));
  const [typedPrompt, setTypedPrompt] = useState("");
  const rootRef = useRef(null);
  const dockRef = useRef(null);
  const sectionRefs = useRef([]);
  const idleTimerRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = Number(entry.target.dataset.canvasIndex);
      setActive(index);
      setVisited((current) => new Set(current).add(categories[index].id));
    }), { rootMargin: "-35% 0px -35% 0px" });
    sectionRefs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const prompt = categories[active].prompt;
    setTypedPrompt("");
    let cursor = 0;
    const timer = window.setInterval(() => { cursor += 1; setTypedPrompt(prompt.slice(0, cursor)); if (cursor >= prompt.length) window.clearInterval(timer); }, 22);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const motion = { current: 0, target: 0, velocity: 0, frame: 0, previousTime: 0 };

    function sectionProgress() {
      const root = rootRef.current;
      if (!root) return 0;
      const box = root.getBoundingClientRect();
      return Math.max(0, Math.min(1, (window.innerHeight - box.top) / (box.height + window.innerHeight)));
    }

    function renderDock(progress) {
      const root = rootRef.current;
      const dock = dockRef.current;
      if (!root || !dock) return;
      const rootBox = root.getBoundingClientRect();
      const slot = document.getElementById("hero-prompt-slot");
      const slotBox = slot?.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      const targetWidth = Math.min(353, window.innerWidth - 24);
      const targetX = mobile
        ? 12
        : Math.max(16, Math.min(window.innerWidth * 0.16875, window.innerWidth - targetWidth - 16));
      const targetY = mobile ? 66 : window.innerHeight * (195 / 812);
      const startX = slotBox?.left ?? targetX;
      const startY = slotBox?.top ?? targetY;
      const startWidth = slotBox?.width || targetWidth;
      const mix = (from, to) => from + (to - from) * progress;
      const visible = rootBox.top <= window.innerHeight * 1.15 && rootBox.bottom > targetY + 112;

      dock.style.setProperty("--dock-x", `${mix(startX, targetX)}px`);
      dock.style.setProperty("--dock-y", `${mix(startY, targetY)}px`);
      dock.style.setProperty("--dock-width", `${mix(startWidth, targetWidth)}px`);
      dock.style.setProperty("--dock-progress", String(progress));
      dock.dataset.docked = progress > 0.82 ? "true" : "false";
      dock.dataset.visible = visible ? "true" : "false";
    }

    function tick(now) {
      const delta = motion.previousTime ? Math.min((now - motion.previousTime) / 1000, 0.05) : 1 / 60;
      motion.previousTime = now;
      const acceleration = 140 * (motion.target - motion.current) - 26 * motion.velocity;
      motion.velocity += acceleration * delta;
      motion.current += motion.velocity * delta;
      if (Math.abs(motion.target - motion.current) < 0.001 && Math.abs(motion.velocity) < 0.001) {
        motion.current = motion.target;
        motion.velocity = 0;
        motion.frame = 0;
        renderDock(motion.current);
        return;
      }
      renderDock(Math.max(0, Math.min(1, motion.current)));
      motion.frame = window.requestAnimationFrame(tick);
    }

    function updateDock() {
      const root = rootRef.current;
      if (!root) return;
      const slot = document.getElementById("hero-prompt-slot");
      const box = root.getBoundingClientRect();
      motion.target = slot
        ? Math.max(0, Math.min(1, (window.innerHeight - box.top) / window.innerHeight))
        : 1;
      if (prefersReducedMotion()) {
        motion.current = motion.target;
        motion.velocity = 0;
        window.cancelAnimationFrame(motion.frame);
        motion.frame = 0;
        renderDock(motion.current);
      } else if (!motion.frame) {
        motion.previousTime = performance.now();
        motion.frame = window.requestAnimationFrame(tick);
      }
    }

    function clearIdleTimer() {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = 0;
    }

    function scheduleIdleReset(event) {
      clearIdleTimer();
      if (event.direction !== 1) return;
      const progress = sectionProgress();
      if (progress <= 0.05 || progress >= 0.82) return;
      idleTimerRef.current = window.setTimeout(() => {
        const nextProgress = sectionProgress();
        if (nextProgress > 0.05 && nextProgress < 0.82) {
          setActive(0);
          setVisited((current) => new Set(current).add(categories[0].id));
        }
      }, 5000);
    }

    const unsubscribeScroll = onScroll((event) => {
      updateDock();
      scheduleIdleReset(event);
    });
    const unsubscribeVirtualScroll = onVirtualScroll(clearIdleTimer);
    window.addEventListener("resize", updateDock, { passive: true });
    updateDock();
    return () => {
      clearIdleTimer();
      unsubscribeScroll();
      unsubscribeVirtualScroll();
      window.removeEventListener("resize", updateDock);
      window.cancelAnimationFrame(motion.frame);
    };
  }, [onScroll, onVirtualScroll, prefersReducedMotion]);

  const select = (index) => {
    setActive(index);
    setVisited((current) => new Set(current).add(categories[index].id));
    const scene = sectionRefs.current[index];
    if (!scene) return;
    scrollTo(scene, {
      offset: -window.innerHeight * (195 / 812),
      immediate: prefersReducedMotion(),
    });
  };

  return <><CanvasDock active={active} dockRef={dockRef} onSelect={select} text={typedPrompt} /><section className="canvas-orchestrator" id="canvas" ref={rootRef}><CanvasBackground active={active} assetBase={assetBase} visited={visited} /><div className="canvas-orchestrator__scenes">{categories.map((category, index) => <section aria-label={`${category.label} canvas`} className="canvas-orchestrator__scene" data-canvas-index={index} id={`canvas-showcase-${category.id}`} key={category.id} ref={(element) => { sectionRefs.current[index] = element; }}><CanvasScene active={index === active} assetBase={assetBase} scene={makeScene(category)} sequence={visited.has(category.id) ? 1 : 0} /></section>)}</div></section></>;
}
