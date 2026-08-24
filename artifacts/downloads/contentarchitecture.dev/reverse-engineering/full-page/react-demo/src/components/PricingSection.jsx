import { useEffect, useRef, useState } from "react";
import { SplitButton } from "./SplitButton.jsx";

const PLANS = [
  {
    name: "Next.js",
    description: "The Next.js 16 + Sanity v6 repo",
    audience: "For Next.js + Sanity engineers, not no-code",
    href: "https://www.contentarchitecture.dev/checkout?plan=next&code=ASTROLAUNCH",
  },
  {
    name: "Astro",
    description: "The Astro 7 + Sanity v6 repo",
    audience: "For Astro + Sanity engineers, not no-code",
    href: "https://www.contentarchitecture.dev/checkout?plan=astro&code=ASTROLAUNCH",
  },
];

const INCLUDED_FEATURES = [
  "One-time fee, no subscription",
  "Perpetual license, unlimited projects",
  "Commercial use, no attribution",
  "Lifetime updates, included",
  "Agent-ready: skills, MCP, llms.txt",
  "Private GitHub Discussions",
  "Direct line to the maintainer",
  "Full source on purchase, sales final",
  "All prices in EUR",
];

const AVATARS = [
  "avatar-goodfella.png",
  "avatar-elliott.png",
  "avatar-boldest.png",
  "avatar-malik.png",
  "avatar-minh.jpg",
];

function useEnteredViewport() {
  const ref = useRef(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setEntered(true);
      observer.disconnect();
    }, { threshold: 0.2 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, entered];
}

function OdometerDigit({ value }) {
  return (
    <span className="price-odometer__digit" style={{ "--price-digit": value }}>
      <span className="price-odometer__placeholder">{value}</span>
      <span className="price-odometer__track" aria-hidden="true">
        {Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}
      </span>
    </span>
  );
}

function PriceOdometer({ children, struck = false }) {
  const label = String(children);

  return (
    <span className={`price-odometer${struck ? " price-odometer--struck" : ""}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">€</span>
      {Array.from(label.replace("€", "")).map((digit, index) => (
        <OdometerDigit key={`${digit}-${index}`} value={Number(digit)} />
      ))}
    </span>
  );
}

function TrustedEngineers() {
  return (
    <div className="trusted-row">
      <div className="trusted-row__avatars" aria-hidden="true">
        {AVATARS.map((src, index) => (
          <span key={src} style={{ zIndex: AVATARS.length - index }}>
            <img loading="lazy" decoding="async" src={`/assets/${src}`} alt="" width="32" height="32" />
          </span>
        ))}
      </div>
      <p>Trusted by 30+ engineers</p>
    </div>
  );
}

function CardConnector() {
  return <div className="price-card__connector" aria-hidden="true"><span /></div>;
}

function PricingCard({ index, plan }) {
  return (
    <article className="price-card">
      <div className="price-card__summary">
        <div className="price-card__header">
          <span data-studio-field={`items.${index}.name`}>{plan.name}</span>
          <em><span className="availability-dot" aria-hidden="true"><i /><i /></span>Available now</em>
        </div>
        <div className="price-card__price">
          <PriceOdometer>€399</PriceOdometer>
          <PriceOdometer struck>€549</PriceOdometer>
        </div>
      </div>
      <CardConnector />
      <ul className="price-card__details">
        <li><b>001</b><span>{plan.description}</span></li>
        <li><b>002</b><span>{plan.audience}</span></li>
      </ul>
      <CardConnector />
      <div className="price-card__action">
        <SplitButton href={plan.href} external>Get access</SplitButton>
      </div>
    </article>
  );
}

function IncludedFeatures() {
  return (
    <aside className="pricing-includes">
      <h3 data-studio-field="sharedItemsTitle">Every edition includes</h3>
      <ul>
        {INCLUDED_FEATURES.map((item, index) => (
          <li key={item}><b>{String(index + 1).padStart(3, "0")}</b><span>{item}</span></li>
        ))}
      </ul>
      <p>Already own one edition? The second one is not full price. Email me and I will send you a code.</p>
    </aside>
  );
}

export function PricingSection() {
  const [sectionRef, entered] = useEnteredViewport();

  return (
    <section
      id="pricing"
      className={`pricing-section${entered ? " is-entered" : ""}`}
      data-component="PricingSection"
      data-page-builder-section="pricingSection"
      ref={sectionRef}
    >
      <div className="pricing-grid">
        <h2 data-studio-field="title">{"Two editions.\nOne architecture.\nLifetime updates."}</h2>
        <TrustedEngineers />
        <div className="pricing-cards">
          {PLANS.map((plan, index) => <PricingCard index={index} key={plan.name} plan={plan} />)}
        </div>
        <IncludedFeatures />
      </div>
    </section>
  );
}
