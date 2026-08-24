import { useRef } from "react";
import { useHeroField } from "../hooks/useHeroField.js";
import { useReveal } from "../hooks/useReveal.js";

export function HeroSection({ assetUrl = (path) => path }) {
  const canvasRef = useRef(null);
  const headerRef = useRef(null);
  const leadRef = useRef(null);
  const leadVisible = useReveal(leadRef);
  useHeroField(canvasRef, headerRef);

  return (
    <>
      <section className="hero" id="hero">
        <canvas className="hero__field" ref={canvasRef} aria-hidden="true" />
        <div className="hhead" ref={headerRef}>
          <div className="hgrid">
            <h1 className="hl">
              <span className="ln"><span>Craft,</span></span>
              <span className="ln"><span>engineered.</span></span>
            </h1>
            <div className="hcol">
              <p className="hdesc">
                <span className="ln"><span>A design &amp; technology</span></span>
                <span className="ln"><span>partner for modern brands</span></span>
              </p>
              <div className="hfoot">
                <span className="wlogo">
                  <img src={assetUrl("/assets/wild-logo.svg")} alt="Wild" width="42" height="18" />
                </span>
                <p className="htag">Award-winning websites, apps, and digital content, built with craft and AI.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="intro">
        <div className="wrap">
          <p className={`lead reveal${leadVisible ? " in" : ""}`} ref={leadRef}>
            A short point of view from us on what actually changed in how we work and how the parts that matter didn't change at all. But first, here's some work:
          </p>
        </div>
      </section>
    </>
  );
}
