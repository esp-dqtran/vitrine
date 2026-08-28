import { useLayoutEffect, useRef } from "react";
import { X } from "../primitives/Icons";
import { ControlButton } from "../primitives/ControlButton";
import { duration, gsap } from "../motion/palmerMotion";

function MenuGlyph() {
  return <span className="menu-glyph" aria-hidden="true"><span /><span /><span /></span>;
}

export function MenuControl({ open, onOpenChange }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const links = rootRef.current?.querySelectorAll(".menu-links > *");
    const tween = gsap.fromTo(links, { y: 16, scale: 0.85, autoAlpha: 0 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: duration(0.45),
      ease: "back.out(1.6)",
      stagger: 0.065,
      clearProps: "transform,opacity,visibility",
    });
    return () => tween.kill();
  }, [open]);

  const toggle = () => {
    if (!open) {
      onOpenChange(true);
      return;
    }
    const links = rootRef.current?.querySelectorAll(".menu-links > *");
    gsap.to(links, {
      y: 12,
      scale: 0.9,
      autoAlpha: 0,
      duration: duration(0.25),
      ease: "power2.in",
      stagger: { each: 0.035, from: "end" },
      onComplete: () => onOpenChange(false),
    });
  };

  return (
    <nav ref={rootRef} className={`menu-control ${open ? "is-open" : ""}`} aria-label="Primary navigation">
      {open && (
        <div className="menu-links">
          <a href="https://vitrines.ai/about">about</a>
          <a href="https://vitrines.ai/contact">contact</a>
        </div>
      )}
      <ControlButton
        className="menu-button"
        icon={open ? <X size={18} /> : <MenuGlyph />}
        label={open ? null : "menu"}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={toggle}
      />
    </nav>
  );
}
