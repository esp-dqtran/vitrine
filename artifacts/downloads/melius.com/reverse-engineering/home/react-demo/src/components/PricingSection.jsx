import { useEffect, useRef, useState } from "react";
import { BillingToggle } from "./primitives/BillingToggle";

const plans = [
  {
    name: "Creator", description: "Explore possibilities on Melius", annual: 17, monthly: 18, list: 20,
    credits: "20,000 credits/mo", output: "≈ 275 images or 55s of video",
    features: ["Access to all models", "Up to 1 agent skill", "Unlimited seats", "Unlimited agent usage", "Shared workspaces"],
  },
  {
    name: "Growth", description: "Scale your creative workflows", annual: 43, monthly: 45, list: 50,
    credits: "50,000 credits/mo", output: "≈ 700 images or 140s of video",
    features: ["Everything in Creator", "Up to 3 agent skills"],
  },
  {
    name: "Professional", description: "Build a team of creative agents", annual: 240, monthly: 255, list: 300,
    credits: "300,000 credits/mo", output: "≈ 4,200 images or 830s of video",
    features: ["Everything in Growth", "Up to 10 agent skills", "Slack agent access", "Semantic Assets Manager", "Import/create ElevenLabs custom voices", "AI prompt enhancement", "Better fonts", "And more..."],
  },
  {
    name: "Enterprise", description: "For teams with higher limits", credits: "Custom credits",
    features: ["Everything in Professional", "Unlimited agent skills", "Priority queue access", "Dedicated Slack channel", "Real-time support", "Volume discounts", "And more..."],
  },
];

function savings(plan, annual) {
  if (!plan.list) return null;
  if (annual && plan.name === "Growth") return 15;
  return Math.round((1 - (annual ? plan.annual : plan.monthly) / plan.list) * 100);
}

function PricingValue({ annual, plan }) {
  const price = annual ? plan.annual : plan.monthly;
  return <div className="pricing-source-card__price">
    <span className="pricing-source-card__amount"><sup>$</sup>{price}</span>
    <span className="pricing-source-card__list">${plan.list}</span>
    <small>Per month</small>
    <em>Save {savings(plan, annual)}%</em>
  </div>;
}

function CreditAllowance({ assetBase, plan }) {
  return <div className="pricing-source-card__credits">
    <img alt="Melius coin" src={`${assetBase}1b4e42070f482e4b80d6.webp`} />
    <div><strong>{plan.credits}</strong>{plan.output && <span>{plan.output}</span>}</div>
  </div>;
}

function PricingCard({ active, annual, assetBase, onActivate, plan }) {
  const enterprise = !plan.list;
  return <article
    className="pricing-source-card"
    data-active={active}
    data-notch={plan.name === "Professional" || enterprise}
    data-plan={plan.name.toLowerCase()}
    onMouseEnter={onActivate}
  >
    {(plan.name === "Professional" || enterprise) && <img alt="" aria-hidden="true" className="pricing-source-card__notch-coin" src={`${assetBase}1b4e42070f482e4b80d6.webp`} />}
    <div className="pricing-source-card__heading"><h3>{plan.name}</h3><p>{plan.description}</p></div>
    {!enterprise && <PricingValue annual={annual} plan={plan} />}
    <CreditAllowance assetBase={assetBase} plan={plan} />
    <div className="pricing-source-card__features"><span>Features</span><ul>{plan.features.map((feature) => <li key={feature}><svg aria-hidden="true" height="8" viewBox="0 0 10 8" width="10"><path d="M2.99996 5.28547L0.901199 3.1867L0 4.0879L2.99996 7.08786L9.18663 0.901199L8.28543 0L2.99996 5.28547Z" /></svg><span>{feature}</span></li>)}</ul></div>
    <a className={enterprise ? "pricing-source-card__cta pricing-source-card__cta--enterprise" : "pricing-source-card__cta"} href={enterprise ? "/book-intro" : "https://app.melius.com/billing"}>{enterprise ? "Contact Sales" : `Start with ${plan.name}`}</a>
  </article>;
}

export function PricingSection({ assetBase = "/assets/", id = "pricing" }) {
  const [annual, setAnnual] = useState(true);
  const [activePlan, setActivePlan] = useState("Creator");
  const [entered, setEntered] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setEntered(true); observer.disconnect(); } }, { rootMargin: "-10% 0px" });
    const node = rootRef.current;
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <section className="pricing-source" data-entered={entered} id={id} onMouseLeave={() => setActivePlan("Creator")} ref={rootRef}>
    <div className="pricing-source__header"><h2>Our Pricing</h2><BillingToggle annual={annual} onChange={setAnnual} /></div>
    <div className="pricing-source__grid">{plans.map((plan, index) => <PricingCard active={activePlan === plan.name} annual={annual} assetBase={assetBase} key={plan.name} onActivate={() => setActivePlan(plan.name)} plan={plan} style={{ "--pricing-stagger": `${index * .12}s` }} />)}</div>
  </section>;
}
