import { CarouselSection } from "./CarouselSection.jsx";

const workItems = [
  { title: "Replit Agent 3", description: "The launch landing page for Replit's autonomous AI Agent 3.", href: "https://wild.as/work/replit-agent-3", media: "/assets/work/replit-agent-3.mp4" },
  { title: "Serve Robotics", description: "Brand refresh and website redesign with 3D assets and a design system.", href: "https://wild.as/work/serve-robotics", media: "/assets/work/serve-robotics.mp4" },
  { title: "Unstructured", description: "A playful brand site turning complex data into characterful design.", href: "https://wild.as/work/unstructured-website", media: "/assets/work/unstructured.mp4" },
  { title: "Ouster", description: "A platform with the same precision as the lidar hardware: a new palette, a technical type system, and custom 3D product renders.", href: "https://wild.as/work/ouster", media: "/assets/work/ouster.avif", kind: "image" },
  { title: "IBM watsonx.data", description: "Two WebGL modules for IBM's THINK Tour, built with VTProDesign, running offline on touchscreens, localised and accessible.", href: "https://wild.as/work/ibm-watsonxdata", media: "/assets/work/ibm.mp4" },
  { title: "The Ordinary", description: "A microsite for the GF 15% Solution launch with Uncommon, taking on skincare myths and making the science honest.", href: "https://wild.as/work/the-ordinary", media: "/assets/work/ordinary.mp4" },
  { title: "Montefiore Einstein", description: "A WebGL journey through space to find hidden stars, turning thousands of rare diseases into something approachable.", href: "https://wild.as/work/me-holiday-campaign", media: "/assets/work/montefiore.mp4" },
  { title: "Tersa", description: "A new brand and an immersive web experience with headless Shopify pre-order, for the human in every athlete.", href: "https://wild.as/work/tersa", media: "/assets/work/tersa.mp4" },
  { title: "Nutrafol", description: "A brand refresh for the hair-wellness leader: a new palette, refined type, and a streamlined design system.", href: "https://wild.as/work/nutrafol-brand-refresh", media: "/assets/work/nutrafol.avif", kind: "image" },
];

export function WorkCarouselSection({ assetUrl = (path) => path }) {
  const items = workItems.map((item) => ({ ...item, media: assetUrl(item.media) }));
  return <CarouselSection id="work" items={items} actionLabel="View case study" />;
}
