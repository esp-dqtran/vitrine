import { useState } from "react";
import { AnnouncementBar } from "./AnnouncementBar";
import { CanvasNode } from "./CanvasNode";
import { CanvasScene } from "./CanvasScene";
import { FaqAccordionItem } from "./FaqAccordionItem";
import { FaqSection } from "./FaqSection";
import { FooterLinkGroup } from "./FooterLinkGroup";
import { FooterMeta } from "./FooterMeta";
import { CookiePreferencesDialog } from "./CookiePreferencesDialog";
import { PersonaCard } from "./PersonaCard";
import { PersonaStack } from "./PersonaStack";
import { PricingSection } from "./PricingSection";
import { ModelCarouselControls } from "./ModelCarouselControls";
import { NewsletterForm } from "./NewsletterForm";
import { SegmentedTabBar } from "./SegmentedTabBar";
import { SiteHeader } from "./SiteHeader";
import { CanvasMediaFrame } from "./primitives/CanvasMediaFrame";
import { BillingToggle } from "./primitives/BillingToggle";
import { CanvasNodeCaption } from "./primitives/CanvasNodeCaption";
import { HeroDescription } from "./primitives/HeroDescription";
import { HeroHeadline } from "./primitives/HeroHeadline";
import { MeliusButton } from "./primitives/MeliusButton";
import { MeliusLogo } from "./primitives/MeliusLogo";
import { MeliusTag } from "./primitives/MeliusTag";
import { MenuLink } from "./primitives/MenuLink";
import { MenuToggle } from "./primitives/MenuToggle";
import { SegmentedTab } from "./primitives/SegmentedTab";
import { TextLink } from "./primitives/TextLink";
import { PersonaIndent } from "./primitives/PersonaIndent";
import { PersonaMedia } from "./primitives/PersonaMedia";
import { FooterStatus } from "./primitives/FooterStatus";
import { advertisingCanvasScene } from "../data/advertisingCanvasScene";

const heroCopy = "Be the creative director. Let agents be your team.\nBrief our agent Mel, watch the work assemble, and steer any prompt until the output lands exactly as you imagined.";
const canvasCategories = ["Advertising", "E-commerce", "Filmmaking", "Fashion", "Branding"];
const productMockup = {
  alt: "Advertising: Product Mockup",
  aspectRatio: 1.5304878048780488,
  model: "GPT Image 2",
  src: "95caea352ed126fa508d.webp",
  title: "Product Mockup",
  type: "Image",
};
const personas = [
  { title: "Agencies", description: "Concept work that wins the pitch. Variant work that runs the campaign. The same canvas does both — treatments and concept art at the brief's pace, ad variants and campaign creative at the campaign's volume.", video: "86ceab3c1a8e6d7c8eb3.webm", useCases: ["Concept Boards", "Campaign Variants", "Treatment Decks", "Spec Ads"] },
  { title: "CD/Filmmakers", description: "You can see the shot. You can describe it. Single-model tools can't make it. Work with tunable, multimodal nodes until the frame matches what you imagined.", video: "f089a69a71176a8ae33d.webm", useCases: ["Storyboards", "AI Shorts", "Lookbooks", "Reference Boards"] },
  { title: "Marketers", description: "The hero shot in minutes. The thousand-variant cascade in an afternoon. Localized for every market, sized for every channel, brand-checked before every approval.", image: "c4cc64e83773df97deab.webp", useCases: ["LCM Creatives", "Ad Variants", "Animated Statics", "Localized Copy"] },
  { title: "E-commerce", description: "The shoot that used to take three weeks, an afternoon on the canvas. Pack shots, on-model, hero imagery, all brand-consistent across every frame, at the pace of your ambitions.", image: "f2758066c19787742055.webp", useCases: ["Pack Shots", "On-Model Imagery", "Lifestyle Heroes", "PDP Variants"] },
  { title: "GTM / Growth", description: "Skip the design ticket. Event graphics, blog heroes, conference posters, decks that don't look like they were made in five minutes — all on the fly, without learning a single tool or writing a single prompt.", image: "91ccac182a31c629b5be.webp", useCases: ["Event Graphics", "Conference Posters", "Sales Decks", "Blog Heroes"] },
];
const faqItems = [
  { question: "What is Melius?", answer: "Melius is a node-based creative canvas for AI image, video, and audio. Every prompt, image, video, and audio clip is a node on an infinite canvas, and edges connect them so one node's output feeds the next. That's how you build a multi-step pipeline like reference image to image to video to voiceover to final cut. Describe what you want and the Mel agent wires the nodes, picks the right model for each, and leaves every prompt editable so you can rewire or re-run any step." },
  { question: "What is a node-based AI canvas?", answer: "A node-based canvas represents creative work as a graph instead of a chat thread. Every step is a node with its own model, settings, and version history: a prompt, a generated image, a video, an audio track, an uploaded reference. Edges pass output from one node into the next. Because the whole pipeline is visible, you can change an early step and re-run everything downstream, branch to compare variations side by side, and reuse a working graph as a template. On Melius, that graph is also what the Mel agent and external agents connected over MCP read and edit." },
  { question: "What kind of work is the Melius canvas best for?", answer: "Anything that takes more than one generation to get right. Video production teams storyboard, generate shots on parallel branches, and assemble takes in the built-in multi-track editor. Advertising and campaign teams build a graph per concept, then fan the approved one out to every placement and aspect ratio. E-commerce teams reuse one product photo as a reference node across lifestyle scenes and crops. Brand and design teams pin assets, fonts, and references as nodes so downstream generations stay on-brand, and agencies share canvases so feedback lands on a specific node rather than a finished file." },
  { question: "How does AI video generation work on Melius?", answer: "You start from a text prompt or an existing image, choose a video model or let Mel pick one, and Melius generates the clip. You can guide it with reference images, first and last frames, or input footage, then trim and assemble clips in the built-in video editor." },
  { question: "Is Melius free?", answer: "You can create a Melius account for free, but generating images, video, or audio uses credits — and the only way to get credits is a paid plan or a one-time credit purchase. So it's free to sign up and explore, and you pay only for what you generate. Paid plans start at $18 per month." },
  { question: "What AI models does Melius support?", answer: "Melius gives you access to a library of leading AI models for image, video, audio, and text. That includes image models like Nano Banana, GPT Image, Flux, Seedream, and Ideogram; video models like Seedance, Veo, Sora, and Kling; and audio and voice models like ElevenLabs, from providers including OpenAI, Google, ByteDance, and Black Forest Labs. The Mel agent can choose the best model for your prompt automatically, or you can pick one yourself." },
  { question: "Who owns the content I create, and can I use it commercially?", answer: "You own the content you create on Melius and can use, publish, and distribute it commercially, subject to the underlying model providers' terms. Melius doesn't claim ownership of your work and doesn't use it to train AI models." },
  { question: "How is Melius different from single-model tools like Midjourney?", answer: "A single-model tool gives you one model and one output at a time, with no record of how you got there. Melius is a node-based canvas: one subscription covers many models across image, video, and audio, and the graph keeps every step connected, editable, and re-runnable. You can swap the model on a single node, branch to compare two directions, and reuse the whole workflow as a template, instead of juggling several separate tools and rebuilding the process from scratch each time." },
];
const footerProductLinks = [
  { label: "Web App", href: "https://app.melius.com/", newTab: true },
  { label: "Desktop App", href: "/desktop-app" },
  { label: "Pricing", href: "/pricing" },
  { label: "Models", href: "/models" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Docs", href: "https://docs.melius.com/", newTab: true },
  { label: "MCP", href: "https://docs.melius.com/mcp/overview", newTab: true },
];
const footerLegalLinks = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];

function ComponentExample({ children, code, id, index, title }) {
  return <section className="component-example" id={id}>
    <div className="component-example__label">
      <span>{index}</span><h2>{title}</h2><code>{code}</code>
    </div>
    {children}
  </section>;
}

export function ComponentShowcase({ assetBase }) {
  const imageSource = `${assetBase}${productMockup.src}`;
  const [annualBilling, setAnnualBilling] = useState(true);
  const [faqOpen, setFaqOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentSelection, setConsentSelection] = useState({ necessary: true, measurement: true, marketing: true });

  return <main className="component-showcase">
    <a className="component-showcase__back" href="/">← Back to page draft</a>
    <header className="component-showcase__intro">
      <p>Component-first reconstruction</p>
      <h1>Primitives<br />then composites</h1>
      <span>Download source → isolate the smallest element → verify its state → compose it</span>
    </header>

    <ComponentExample code="primitive / MeliusLogo" id="melius-logo" index="01" title="Melius Logo">
      <div className="component-example__primitive-preview"><div><MeliusLogo /><span>Source SVG</span></div></div>
    </ComponentExample>
    <ComponentExample code="primitive / MenuToggle" id="menu-toggle" index="02" title="Menu Toggle">
      <div className="component-example__primitive-preview"><div><MenuToggle open={false} controls="closed-menu-preview" onClick={() => {}} /><span>Closed</span></div><div><MenuToggle open controls="open-menu-preview" onClick={() => {}} /><span>Open</span></div></div>
    </ComponentExample>
    <ComponentExample code="primitive / MenuLink" id="menu-link" index="03" title="Menu Link">
      <div className="component-example__primitive-preview"><div><MenuLink href="#menu-link">Pricing</MenuLink><span>Desktop menu link</span></div></div>
    </ComponentExample>
    <ComponentExample code="primitive / MeliusButton" id="melius-button" index="04" title="Melius Button">
      <div className="component-example__primitive-preview"><div><MeliusButton href="#melius-button" size="menu">Sign In</MeliusButton><span>Menu / outline</span></div><div><MeliusButton href="#melius-button" variant="yellow">Sign In</MeliusButton><span>Header / yellow</span></div><div><MeliusButton href="#melius-button" variant="orange">Start for Free</MeliusButton><span>Header / orange</span></div></div>
    </ComponentExample>
    <ComponentExample code="primitive / MeliusTag" id="melius-tag" index="05" title="Melius Tag">
      <div className="component-example__primitive-preview"><div><MeliusTag>Image</MeliusTag><span>Canvas node label</span></div></div>
    </ComponentExample>
    <ComponentExample code="primitive / CanvasNodeCaption" id="canvas-node-caption" index="06" title="Canvas Node Caption">
      <div className="component-example__node-preview"><CanvasNodeCaption title={productMockup.title} model={productMockup.model} /></div>
    </ComponentExample>
    <ComponentExample code="primitive / CanvasMediaFrame" id="canvas-media-frame" index="07" title="Canvas Media Frame">
      <div className="component-example__media-preview"><CanvasMediaFrame alt={productMockup.alt} aspectRatio={productMockup.aspectRatio} src={imageSource} /></div>
    </ComponentExample>
    <ComponentExample code="composite / CanvasNode" id="canvas-node" index="08" title="Canvas Node">
      <CanvasNode {...productMockup} revealed src={imageSource} />
    </ComponentExample>
    <ComponentExample code="composite / CanvasScene" id="canvas-scene" index="09" title="Canvas Scene">
      <div className="component-example__canvas-preview"><CanvasScene assetBase={assetBase} scene={advertisingCanvasScene} sequence={1} /></div>
    </ComponentExample>
    <ComponentExample code="primitive / PersonaIndent" id="persona-indent" index="10" title="Persona Indent">
      <div className="component-example__persona-indent-preview"><PersonaIndent /></div>
    </ComponentExample>
    <ComponentExample code="composite / PersonaMedia" id="persona-media" index="11" title="Persona Media">
      <div className="component-example__persona-media-preview"><PersonaMedia alt="Agencies" src={`${assetBase}86ceab3c1a8e6d7c8eb3.webm`} useCases={["Concept Boards", "Campaign Variants", "Treatment Decks", "Spec Ads"]} /></div>
    </ComponentExample>
    <ComponentExample code="composite / PersonaCard" id="persona-card" index="12" title="Persona Card">
      <PersonaCard description="Concept work that wins the pitch. Variant work that runs the campaign. The same canvas does both — treatments and concept art at the brief's pace, ad variants and campaign creative at the campaign's volume." title="Agencies" useCases={["Concept Boards", "Campaign Variants", "Treatment Decks", "Spec Ads"]} video={`${assetBase}86ceab3c1a8e6d7c8eb3.webm`} />
    </ComponentExample>
    <ComponentExample code="section composite / PersonaStack" id="persona-stack" index="13" title="Persona Stack">
      <PersonaStack assetBase={assetBase} cards={personas.map((persona) => ({ ...persona, image: persona.image && `${assetBase}${persona.image}`, video: persona.video && `${assetBase}${persona.video}` }))} />
    </ComponentExample>
    <ComponentExample code="composite / ModelCarouselControls" id="model-carousel-controls" index="14" title="Models Carousel Controls">
      <div className="component-example__models-controls-preview"><ModelCarouselControls onNext={() => {}} onPrevious={() => {}} /></div>
    </ComponentExample>
    <ComponentExample code="primitive / BillingToggle" id="billing-toggle" index="15" title="Billing Toggle">
      <div className="component-example__billing-toggle-preview"><BillingToggle annual={annualBilling} onChange={setAnnualBilling} /></div>
    </ComponentExample>
    <ComponentExample code="section composite / PricingSection" id="pricing-section" index="16" title="Pricing Section">
      <PricingSection assetBase={assetBase} />
    </ComponentExample>
    <ComponentExample code="composite / FaqAccordionItem" id="faq-accordion-item" index="16" title="FAQ Accordion Item">
      <div className="component-example__faq-preview"><FaqAccordionItem answer="Melius is a node-based creative canvas for AI image, video, and audio. Every prompt, image, video, and audio clip is a node on an infinite canvas, and edges connect them so one node's output feeds the next. That's how you build a multi-step pipeline like reference image to image to video to voiceover to final cut. Describe what you want and the Mel agent wires the nodes, picks the right model for each, and leaves every prompt editable so you can rewire or re-run any step." onOpenChange={setFaqOpen} open={faqOpen} question="What is Melius?" /></div>
    </ComponentExample>
    <ComponentExample code="composite / NewsletterForm" id="newsletter-form" index="17" title="Newsletter Form">
      <div className="component-example__newsletter-preview"><NewsletterForm onSubmit={() => {}} /></div>
    </ComponentExample>
    <ComponentExample code="composite / FooterLinkGroup" id="footer-link-group" index="18" title="Footer Link Group">
      <div className="component-example__footer-link-group-preview"><FooterLinkGroup links={footerProductLinks} title="Product" /></div>
    </ComponentExample>
    <ComponentExample code="primitive / FooterStatus" id="footer-status" index="19" title="Footer Status">
      <div className="component-example__footer-status-preview"><FooterStatus /><FooterStatus status="issue" /></div>
    </ComponentExample>
    <ComponentExample code="composite / FooterMeta" id="footer-meta" index="20" title="Footer Metadata">
      <div className="component-example__footer-meta-preview"><FooterMeta legalLinks={footerLegalLinks} onOpenCookiePreferences={() => setConsentOpen(true)} /></div>
    </ComponentExample>
    <ComponentExample code="composite / CookiePreferencesDialog" id="cookie-preferences-dialog" index="21" title="Cookie Preferences Dialog">
      <div className="component-example__footer-meta-preview component-example__consent-dialog-preview"><button onClick={() => setConsentOpen(true)} type="button">Open privacy settings</button></div>
      <CookiePreferencesDialog
        onAcceptAll={() => setConsentSelection({ necessary: true, measurement: true, marketing: true })}
        onOpenChange={setConsentOpen}
        onRejectAll={() => setConsentSelection({ necessary: true, measurement: false, marketing: false })}
        onSave={setConsentSelection}
        onSelectionChange={setConsentSelection}
        open={consentOpen}
        selection={consentSelection}
      />
    </ComponentExample>
    <ComponentExample code="section / FaqSection" id="faq-section" index="18" title="FAQ Section">
      <FaqSection items={faqItems} />
    </ComponentExample>
    <ComponentExample code="primitive / TextLink" id="text-link" index="19" title="Text Link">
      <div className="component-example__preview"><TextLink href="#text-link" accent="Try it now →">Seedance 2.5 is live on Melius</TextLink></div>
    </ComponentExample>
    <ComponentExample code="primitive / HeroHeadline" id="hero-headline" index="14" title="Hero Headline">
      <div className="component-example__headline-preview"><HeroHeadline first="One platform." second="Every creative outcome." revealed /></div>
    </ComponentExample>
    <ComponentExample code="primitive / HeroDescription" id="hero-description" index="15" title="Hero Description">
      <div className="component-example__copy-preview"><HeroDescription>{heroCopy}</HeroDescription></div>
    </ComponentExample>
    <ComponentExample code="primitive / SegmentedTab" id="segmented-tab" index="16" title="Segmented Tab">
      <div className="component-example__tabs-preview"><SegmentedTab active>Advertising</SegmentedTab><SegmentedTab>E-commerce</SegmentedTab></div>
    </ComponentExample>
    <ComponentExample code="composite / SegmentedTabBar" id="segmented-tab-bar" index="17" title="Segmented Tab Bar">
      <div className="component-example__tabs-preview"><SegmentedTabBar items={canvasCategories} /></div>
    </ComponentExample>
    <ComponentExample code="composite / AnnouncementBar" id="announcement-bar" index="18" title="Announcement Bar">
      <div className="component-example__preview"><AnnouncementBar /></div>
    </ComponentExample>
    <ComponentExample code="composite / SiteHeader" id="site-header" index="19" title="Site Header">
      <div className="component-example__header-preview"><SiteHeader assetBase={assetBase} /><div className="component-example__header-copy"><p>Composite check</p><h3>Open the menu</h3><span>The header is verified against the downloaded source at desktop and mobile sizes.</span></div></div>
    </ComponentExample>
  </main>;
}
