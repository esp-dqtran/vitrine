import { useEffect } from "react";

function useHeroRuntime() {
  useEffect(() => {
    if (document.querySelector("script[data-hero-runtime]")) return;
    const script = document.createElement("script");
    script.src = "/hero-runtime.js";
    script.dataset.heroRuntime = "true";
    document.body.appendChild(script);
  }, []);
}

export function HeroExperience() {
  useHeroRuntime();

  return (
    <main className="hero-experience">
      <canvas id="hero-kv" aria-hidden="true" />
      <section className="hero" id="hero">
        <div className="hhead">
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
                  <img src="/assets/wild-logo.svg" alt="wild" width="42" height="18" />
                </span>
                <p className="htag">Award-winning websites, apps, and digital content, built with craft and AI.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="intro">
        <div className="wrap">
          <p className="lead">A short point of view from us on what actually changed in how we work and how the parts that matter didn't change at all. But first, here's some work:</p>
        </div>
      </section>
    </main>
  );
}
