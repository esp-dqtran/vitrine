import { useEffect, useRef, useState } from "react";
import { FooterEasterEgg } from "./FooterEasterEgg";
import { FooterLinkGroup } from "./FooterLinkGroup";
import { FooterMeta } from "./FooterMeta";
import { FooterWordmark } from "./FooterWordmark";
import { NewsletterForm } from "./NewsletterForm";

const FOOTER_DOT_PATTERN = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='15' height='15'><rect x='6.5' y='6.5' width='2' height='2' rx='1' ry='1' fill='rgb(255,255,255)' fill-opacity='.08'/></svg>")}`;

const groups = [
  { title: "Product", links: [{ label:"Web App", href:"https://app.melius.com/", newTab:true }, { label:"Desktop App", href:"/desktop-app" }, { label:"Pricing", href:"/pricing" }, { label:"Models", href:"/models" }, { label:"Enterprise", href:"/enterprise" }, { label:"Docs", href:"https://docs.melius.com/", newTab:true }, { label:"MCP", href:"https://docs.melius.com/mcp/overview", newTab:true }] },
  { title: "Company", links: [{ label:"About", href:"/about" }, { label:"Blog", href:"/blog" }, { label:"Manifesto", href:"/manifesto" }, { label:"Brand", href:"/brand" }, { label:"Contact", href:"/contact" }, { label:"Careers", href:"https://jobs.ashbyhq.com/melius", newTab:true }] },
  { title: "Community", links: [{ label:"X", href:"https://x.com/trymelius", newTab:true }, { label:"LinkedIn", href:"https://www.linkedin.com/company/meliusai/", newTab:true }, { label:"Instagram", href:"https://www.instagram.com/trymelius", newTab:true }, { label:"Discord", href:"https://discord.gg/hkvwjteArP", newTab:true }] },
];

export function FooterDotBackground() {
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!field || !canvas || !context) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let offsetY = 0;
    let lastDraw = 0;

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      offsetY = -(((field.getBoundingClientRect().top + window.scrollY) % 15 + 15) % 15);
      field.style.backgroundPosition = `0 ${offsetY}px`;
      context.clearRect(0, 0, width, height);
    };

    const draw = (clientX, clientY) => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const fieldBox = field.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      const fieldWidth = Math.max(1, field.clientWidth);
      const fieldHeight = Math.max(1, field.clientHeight);
      const scaleX = fieldBox.width / fieldWidth || 1;
      const scaleY = fieldBox.height / fieldHeight || 1;
      const proximity = 200;
      const localX = (clientX - fieldBox.left) / scaleX;
      const localY = (clientY - fieldBox.top) / scaleY;
      if (localX < -proximity || localX > fieldWidth + proximity || localY < -proximity || localY > fieldHeight + proximity) {
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        return;
      }

      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const canvasX = (canvasBox.left - fieldBox.left) / scaleX;
      const canvasY = (canvasBox.top - fieldBox.top) / scaleY;
      const startColumn = Math.floor((localX - 7.5 - proximity) / 15);
      const endColumn = Math.ceil((localX - 7.5 + proximity) / 15);
      const startRow = Math.floor((localY - 7.5 - offsetY - proximity) / 15);
      const endRow = Math.ceil((localY - 7.5 - offsetY + proximity) / 15);

      for (let row = startRow; row <= endRow; row += 1) {
        const dotY = 7.5 + offsetY + 15 * row;
        if (dotY < 0 || dotY > fieldHeight) continue;
        for (let column = startColumn; column <= endColumn; column += 1) {
          const dotX = 7.5 + 15 * column;
          if (dotX < 0 || dotX > fieldWidth) continue;
          const distance = Math.hypot(dotX - localX, dotY - localY);
          if (distance >= proximity) continue;
          const strength = 1 - distance / proximity;
          const opacity = strength * strength;
          if (opacity <= 0.01) continue;
          const size = 2 + 2 * strength;
          const radius = 1 + strength;
          const x = dotX - canvasX - size / 2;
          const y = dotY - canvasY - size / 2;
          context.beginPath();
          context.fillStyle = `rgba(26,22,22,${opacity})`;
          context.roundRect(dotX - canvasX - 1, dotY - canvasY - 1, 2, 2, 1);
          context.fill();
          context.beginPath();
          context.fillStyle = `rgba(255,255,255,${0.05 + (0.25 - 0.05) * opacity})`;
          context.roundRect(x, y, size, size, radius);
          context.fill();
        }
      }
    };

    const pointerMove = (event) => {
      const now = performance.now();
      if (now - lastDraw < 16) return;
      lastDraw = now;
      draw(event.clientX, event.clientY);
    };
    const clear = (event) => {
      if (!event.relatedTarget) context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(field);
    resize();
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerout", clear, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerout", clear);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <div className="melius-footer__dot-field" ref={fieldRef} style={{ backgroundImage: `url("${FOOTER_DOT_PATTERN}")` }}><canvas aria-hidden="true" ref={canvasRef} /></div>;
}

export function MeliusFooter({ assetBase = "/assets/", enableEasterEgg = true, initiallyEntered = false, onOpenCookiePreferences, wordmarkMaskUrl }) {
  const footerRef = useRef(null);
  const [entered, setEntered] = useState(initiallyEntered);

  useEffect(() => {
    if (entered) return undefined;
    const node = footerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEntered(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [entered]);

  return <footer className="melius-footer" data-background="black" id="footer" ref={footerRef}>
    <div aria-hidden="true" className="melius-footer__background"><FooterDotBackground /></div>
    <div className="melius-footer__scroll-target" data-footer-scroll-target>
      <div className="melius-footer__inner">
        <div className="melius-footer__wordmark" data-entered={entered}><FooterWordmark maskUrl={wordmarkMaskUrl} /></div>
        <div className="melius-footer__panel">
          <div className="melius-footer__top">
            <section className="melius-footer__newsletter"><h3>Don't miss out</h3><p>Enter your email for news and updates</p><NewsletterForm dataId="footer-newsletter" /></section>
            <nav aria-label="Footer" className="melius-footer__groups">{groups.map((group) => <FooterLinkGroup {...group} key={group.title} />)}</nav>
          </div>
          <FooterMeta legalLinks={[{ label:"Terms of Service", href:"/terms" }, { label:"Privacy Policy", href:"/privacy" }]} onOpenCookiePreferences={onOpenCookiePreferences} />
        </div>
      </div>
    </div>
    {enableEasterEgg && <FooterEasterEgg assetBase={assetBase} />}
  </footer>;
}
