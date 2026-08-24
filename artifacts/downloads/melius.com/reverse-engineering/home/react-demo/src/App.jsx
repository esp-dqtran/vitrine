import { useMemo, useState } from "react";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { CookiePreferencesDialog } from "./components/CookiePreferencesDialog";
import { ComponentShowcase } from "./components/ComponentShowcase";
import { CanvasShowcase as CanvasShowcaseComponent } from "./components/CanvasShowcase";
import { ModelWebGLCarousel } from "./components/ModelWebGLCarousel";
import { MeliusFooter } from "./components/MeliusFooter";
import { FaqSection } from "./components/FaqSection";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { PersonaStack } from "./components/PersonaStack";
import { PricingSection } from "./components/PricingSection";
import { SiteHeader } from "./components/SiteHeader";
import { HeroSection } from "./components/HeroSection";
import { MeliusScrollProvider } from "./components/MeliusScrollProvider";

const ASSET = "/assets/";

const modelCards = [
  ["Google", "d8a16ed11aa3a2fb404c.webp"], ["OpenAI", "3c5835ba0efc3539bbd4.webp"], ["ElevenLabs", "f11f5118fbe0f269f736.webp"], ["Sync Labs", "96906e71bcecf1f9148c.webp"],
  ["Mistral", "28d25b4b131f75ab8cdc.webp"], ["DeepSeek", "bdc48656e02c57768270.webp"], ["PixVerse", "50c956f451f3c0e63e52.webp"], ["ByteDance", "3053ee7bd66a498928e9.webp"],
  ["KlingAI", "6a2523e389e31cddbeea.webp"], ["Black Forest Labs", "be9d3f1f828c5bcaf77c.webp"], ["Topaz Labs", "b053db6f6fceeddc7baa.webp"], ["MultiTalk", "a3bf3502a6ebbf691085.webp"],
  ["HeyGen", "c2bef62c899cfb98dcce.webp"], ["Vidu", "e0fed2aed80704e798bc.webp"], ["Meta", "af3050fb7d311b286ce3.webp"], ["xAI", "d71fd7fb5ace372115c1.webp"], ["Lightricks", "ec355877de633fbb52ef.webp"],
];

const scenes = [
  { id: "advertising", label: "Advertising", prompt: "Generate ad creative for a summer skincare collection…", background: "31e3db1c5e47daa7d22d.webp", nodes: [
    { title: "Product Mockup", model: "GPT Image 2", type: "Image", asset: "95caea352ed126fa508d.webp", x: -10, y: 27, width: 19 },
    { title: "Studio Shot", model: "Nano Banana Pro", type: "Image", asset: "88872a5492cfd32bb64e.webp", x: 20, y: 52, width: 29 },
    { title: "Lifestyle Moment", model: "Seedance 2.0", type: "Video", asset: "0b35cf63739d10344eb0.webm", x: 57, y: 6, width: 37 },
  ] },
  { id: "ecommerce", label: "E-commerce", prompt: "Build a product shoot that feels ready for every storefront…", background: "43a22d7ff031ad3d8798.webp", nodes: [
    { title: "Model", model: "Nano Banana Pro", type: "Image", asset: "3819d63fe9fcb6c7ebbc.webp", x: 7, y: 12, width: 21 },
    { title: "Pack Shot", model: "GPT Image 2", type: "Image", asset: "26ff88bb49305d60c8c6.webp", x: 32, y: 38, width: 20 },
    { title: "PDP Image", model: "GPT Image 2", type: "Image", asset: "2aeda84b43e0d0c9d2f1.webp", x: 57, y: 12, width: 22 },
    { title: "Product Motion", model: "Kling 3.0 Omni", type: "Video", asset: "ee59325a84147e4f85ba.webm", x: 79, y: 38, width: 17 },
  ] },
  { id: "filmmaking", label: "Filmmaking", prompt: "Develop a sequence from the first still to the final movie cut…", background: "a78fee5757a232636c5c.webp", nodes: [
    { title: "Still Sketch", model: "GPT Image 2", type: "Image", asset: "d519f0f0f4dffe267e6b.webp", x: 8, y: 12, width: 22 },
    { title: "Character Study", model: "Nano Banana 2", type: "Image", asset: "8cf4de374884d268ea40.webp", x: 35, y: 38, width: 21 },
    { title: "Movie Cut 1", model: "Seedance 2.0", type: "Video", asset: "ca5fdf49f591c096e51a.webm", x: 62, y: 12, width: 22 },
    { title: "Movie Cut 2", model: "Seedance 2.0", type: "Video", asset: "b602c016faa4f4f54810.webm", x: 77, y: 47, width: 18 },
  ] },
  { id: "fashion", label: "Fashion", prompt: "Turn a sketch into a campaign garment and its complete visual world…", background: "72b4130962ae4ae5c15b.webp", nodes: [
    { title: "Croquis", model: "Ideogram 4", type: "Image", asset: "f2effb7d3c9b4909f3b8.webp", x: 6, y: 15, width: 19 },
    { title: "Fabric Swatch", model: "GPT Image 2", type: "Image", asset: "770764d8ebceca5147f9.webp", x: 29, y: 41, width: 19 },
    { title: "Garment Mockup", model: "Nano Banana Pro", type: "Image", asset: "1df271b14f106572138e.webp", x: 53, y: 12, width: 22 },
    { title: "Campaign Garment", model: "Nano Banana Pro", type: "Image", asset: "4e86fccb23b6aefa65e6.webp", x: 78, y: 38, width: 19 },
  ] },
  { id: "branding", label: "Branding", prompt: "Turn icon variations into a selected mark, website mockup, and out-of-home billboard…", background: "341dd0e93efae794a628.webm", nodes: [
    { title: "Icon 01", model: "Ideogram 4", type: "Image", asset: "02c53d2f2e584516de4f.webp", x: 4, y: 12, width: 15 },
    { title: "Icon 02", model: "Ideogram 4", type: "Image", asset: "7b62a071d0398b376f98.webp", x: 21, y: 12, width: 15 },
    { title: "Selected Mark", model: "Ideogram 4", type: "Image", asset: "92751b5b588b5cf8dcf3.webp", x: 43, y: 12, width: 19 },
    { title: "Website Mockup", model: "Nano Banana Pro", type: "Image", asset: "ba77c2f656172fcb4f95.webp", x: 43, y: 47, width: 19 },
    { title: "OOH Billboard", model: "Nano Banana Pro", type: "Image", asset: "2652bedf10ca87e3ef5c.webp", x: 71, y: 29, width: 24 },
  ] },
];

export const personas = [
  { name: "Agencies", asset: "86ceab3c1a8e6d7c8eb3.webm", tags: ["Concept Boards", "Campaign Variants", "Treatment Decks", "Spec Ads"], copy: "Concept work that wins the pitch. Variant work that runs the campaign. The same canvas does both — treatments and concept art at the brief's pace, ad variants and campaign creative at the campaign's volume.", useCaseMedia: [{ label: "Concept Boards", asset: "9ab1791c82e8b5118a0f.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "Campaign Variants", asset: "524ef669e285a2d12913.webm", type: "video", provider: "BLACK FOREST LABS", model: "FLUX 1.1" }, { label: "Treatment Decks", asset: "15fb23f585d138088f26.webp", type: "image", provider: "OPENAI", model: "GPT-5.6, Sora 2" }, { label: "Spec Ads", asset: "8adfd178303a7f7c2468.webp", type: "image", provider: "GOOGLE", model: "Veo 3.1" }] },
  { name: "CD/Filmmakers", asset: "f089a69a71176a8ae33d.webm", tags: ["Storyboards", "AI Shorts", "Lookbooks", "Reference Boards"], copy: "You can see the shot. You can describe it. Single-model tools can't make it. Work with tunable, multimodal nodes until the frame matches what you imagined.", useCaseMedia: [{ label: "Storyboards", asset: "663495bd745ae82b2459.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "AI Shorts", asset: "e148028004057326eea5.webm", type: "video", provider: "GOOGLE", model: "Veo 3.1" }, { label: "Lookbooks", asset: "65d5ca138e9a26878d9d.webm", type: "video", provider: "BLACK FOREST LABS", model: "FLUX 1.1" }, { label: "Reference Boards", asset: "9e338c301274ba16a325.webp", type: "image", provider: "KLING AI", model: "Kling 2.0" }] },
  { name: "Marketers", asset: "c4cc64e83773df97deab.webp", tags: ["LCM Creatives", "Ad Variants", "Animated Statics", "Localized Copy"], copy: "The hero shot in minutes. The thousand-variant cascade in an afternoon. Localized for every market, sized for every channel, brand-checked before every approval.", useCaseMedia: [{ label: "LCM Creatives", asset: "b84374cbfe666051c7c6.webp", type: "image", provider: "BLACK FOREST LABS", model: "FLUX 1.1" }, { label: "Ad Variants", asset: "ef84a1bf379c21a8a55f.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "Animated Statics", asset: "a3775b876db6d172f73d.webm", type: "video", provider: "GOOGLE", model: "Veo 3.1" }, { label: "Localized Copy", asset: "f573361c3b27b554b3b6.webp", type: "image", provider: "OPENAI", model: "GPT-5.6" }] },
  { name: "E-commerce", asset: "f2758066c19787742055.webp", tags: ["Pack Shots", "On-Model Imagery", "Lifestyle Heroes", "PDP Variants"], copy: "The shoot that used to take three weeks, an afternoon on the canvas. Pack shots, on-model, hero imagery, all brand-consistent across every frame, at the pace of your ambitions.", useCaseMedia: [{ label: "Pack Shots", asset: "e3b6d7b3a631d4536d18.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "On-Model Imagery", asset: "992d3ce395238214f636.webp", type: "image", provider: "BLACK FOREST LABS", model: "FLUX 1.1, FLUX Kontext" }, { label: "Lifestyle Heroes", asset: "21dd0ec66133c95165e3.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "PDP Variants", asset: "82f54587b8e77b891593.webp", type: "image", provider: "TOPAZ LABS", model: "Gigapixel" }] },
  { name: "GTM / Growth", asset: "91ccac182a31c629b5be.webp", tags: ["Event Graphics", "Conference Posters", "Sales Decks", "Blog Heroes"], copy: "Skip the design ticket. Event graphics, blog heroes, conference posters, decks that don't look like they were made in five minutes — all on the fly, without learning a single tool or writing a single prompt.", useCaseMedia: [{ label: "Event Graphics", asset: "b3fa3398fa27f421f93d.webp", type: "image", provider: "GOOGLE", model: "Nano Banana" }, { label: "Conference Posters", asset: "d1ca3e696ce88b797a36.webp", type: "image", provider: "BLACK FOREST LABS", model: "FLUX 1.1" }, { label: "Sales Decks", asset: "6c31cf6fb9422880db84.webp", type: "image", provider: "OPENAI", model: "GPT-5.6" }, { label: "Blog Heroes", asset: "c9965e43bc84ae57be8a.webp", type: "image", provider: "GOOGLE", model: "Gemini 2.5, Nano Banana" }] },
];

const plans = [
  { name: "Creator", description: "Explore possibilities on Melius", annual: 17, monthly: 20, credits: "20,000 credits/mo", output: "≈ 275 images or 55s of video", features: ["Access to all models", "Up to 1 agent skill", "Unlimited seats", "Unlimited agent usage", "Shared workspaces"] },
  { name: "Growth", description: "Scale your creative workflows", annual: 43, monthly: 50, credits: "50,000 credits/mo", output: "≈ 700 images or 140s of video", features: ["Everything in Creator", "Up to 3 agent skills"] },
  { name: "Professional", description: "Build a team of creative agents", annual: 240, monthly: 300, credits: "300,000 credits/mo", output: "≈ 4,200 images or 830s of video", features: ["Everything in Growth", "Up to 10 agent skills", "Slack agent access", "Semantic Assets Manager", "AI prompt enhancement", "Better fonts", "And more…"] },
  { name: "Enterprise", description: "For higher limits", credits: "Custom credits", output: "", features: ["Everything in Professional", "Unlimited agent skills", "Priority queue access", "Dedicated Slack channel", "Real-time support", "Volume discounts", "And more…"] },
];

const faq = [
  ["What is Melius?", "Melius is a node-based creative canvas for AI image, video, and audio. Every prompt, image, video, and audio clip is a node on an infinite canvas, and edges connect them so one node's output feeds the next."],
  ["What is a node-based AI canvas?", "A node-based canvas represents creative work as a graph instead of a chat thread. Every step is a node with its own model, settings, and version history."],
  ["What kind of work is the Melius canvas best for?", "Anything that takes more than one generation to get right: video production, campaigns, e-commerce, brand work, and shared creative workflows."],
  ["How does AI video generation work on Melius?", "Start from a text prompt or image, choose a video model or let Mel choose one, then guide the result with references, frames, or footage."],
  ["Is Melius free?", "It is free to sign up and explore. Generating images, video, or audio uses credits available through paid plans or one-time purchases."],
  ["What AI models does Melius support?", "Melius provides leading image, video, audio, and text models from providers including OpenAI, Google, ByteDance, and Black Forest Labs."],
  ["Who owns the content I create, and can I use it commercially?", "You own the content you create and may use it commercially, subject to the underlying model providers' terms."],
  ["How is Melius different from single-model tools like Midjourney?", "Melius preserves an editable, re-runnable graph that combines many models across image, video, and audio under one subscription."],
];

function CanvasNode({ node }) {
  const video = node.type === "Video";
  return <article className="canvas-node" style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%` }}><div className="node-title"><span>{node.title}</span><small>{node.model}</small></div>{video ? <video src={ASSET + node.asset} autoPlay muted loop playsInline /> : <img src={ASSET + node.asset} alt={node.title} />}<div className="node-type">{node.type}</div></article>;
}

function CanvasShowcase() { return <CanvasShowcaseComponent assetBase={ASSET} />; }

function PersonaCarousel() {
  const cards = personas.map((persona) => ({
    description: persona.copy,
    title: persona.name,
    useCases: persona.tags,
    useCaseMedia: persona.useCaseMedia,
    [persona.asset.endsWith(".webm") ? "video" : "image"]: ASSET + persona.asset,
  }));
  return <section className="personas" id="personas"><h2 className="sr-only">Personas</h2><PersonaStack assetBase={ASSET} cards={cards} /></section>;
}

function ModelMarquee() { return <ModelWebGLCarousel assetBase={ASSET} />; }

function PricingCard({ annual, plan }) {
  return <article className="price-card"><div><h3>{plan.name}</h3><p>{plan.description}</p></div>{plan.monthly ? <div className="price"><sup>$</sup>{annual ? plan.annual : plan.monthly}<small>{annual ? `$${plan.monthly}` : ""}<br />Per month</small>{annual && <em>Save 15%</em>}</div> : <div className="price price--enterprise">Custom<small>credits &amp; limits</small></div>}<img src={ASSET + "1b4e42070f482e4b80d6.webp"} alt="Melius Coin" /><strong>{plan.credits}</strong><span className="muted">{plan.output}</span><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><a href={plan.name === "Enterprise" ? "/book-intro" : "https://app.melius.com/billing"}>{plan.name === "Enterprise" ? "Contact Sales" : `Start with ${plan.name}`} <b>↗</b></a></article>;
}

function Pricing() { return <PricingSection assetBase={ASSET} />; }

function Faq() { return <FaqSection items={faq.map(([question, answer]) => ({ question, answer }))} />; }

function NewsletterFooter() { const [email, setEmail] = useState(""); const [status, setStatus] = useState(""); function submit(event) { event.preventDefault(); setStatus(/\S+@\S+\.\S+/.test(email) ? "Thanks for subscribing!" : "Enter a valid email address."); } return <section className="newsletter"><div><h2>Don't miss out</h2><p>Enter your email for news and updates</p></div><form onSubmit={submit}><label><span className="sr-only">Enter your email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" /></label><button type="submit">Subscribe</button>{status && <small>{status}</small>}</form></section>; }

function Footer({ onOpenCookiePreferences }) { return <MeliusFooter onOpenCookiePreferences={onOpenCookiePreferences} />; }

function FloatingSignupButton() { return <a className="floating-cta" href="https://app.melius.com/signup">Sign up for free <span>↗</span></a>; }

export function App() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentSelection, setConsentSelection] = useState({ necessary: true, measurement: true, marketing: true });
  const [consentBannerVisible, setConsentBannerVisible] = useState(true);
  if (window.location.pathname === "/components") return <MeliusScrollProvider><ComponentShowcase assetBase={ASSET} /></MeliusScrollProvider>;
  if (["/models", "/slider"].includes(window.location.pathname)) return <MeliusScrollProvider><ModelWebGLCarousel assetBase={ASSET} /></MeliusScrollProvider>;
  if (window.location.pathname === "/footer") return <MeliusScrollProvider stopped={consentOpen}><MeliusFooter assetBase={ASSET} onOpenCookiePreferences={() => setConsentOpen(true)} /><CookiePreferencesDialog onAcceptAll={() => setConsentSelection({ necessary: true, measurement: true, marketing: true })} onOpenChange={setConsentOpen} onRejectAll={() => setConsentSelection({ necessary: true, measurement: false, marketing: false })} onSave={setConsentSelection} onSelectionChange={setConsentSelection} open={consentOpen} selection={consentSelection} /></MeliusScrollProvider>;
  return <MeliusScrollProvider stopped={consentOpen}><div id="top"><AnnouncementBar /><SiteHeader assetBase={ASSET} /><main><HeroSection assetBase={ASSET} /><CanvasShowcase /><PersonaCarousel /><ModelMarquee /><Pricing /><Faq /></main><Footer onOpenCookiePreferences={() => setConsentOpen(true)} /><FloatingSignupButton /><span className="year-mark">{year}</span><CookieConsentBanner onAccept={() => { setConsentSelection({ necessary:true, measurement:true, marketing:true }); setConsentBannerVisible(false); }} onCustomize={() => { setConsentBannerVisible(false); setConsentOpen(true); }} onReject={() => { setConsentSelection({ necessary:true, measurement:false, marketing:false }); setConsentBannerVisible(false); }} visible={consentBannerVisible} /><CookiePreferencesDialog onAcceptAll={() => setConsentSelection({ necessary: true, measurement: true, marketing: true })} onOpenChange={setConsentOpen} onRejectAll={() => setConsentSelection({ necessary: true, measurement: false, marketing: false })} onSave={setConsentSelection} onSelectionChange={setConsentSelection} open={consentOpen} selection={consentSelection} /></div></MeliusScrollProvider>;
}
