import { CarouselSection } from "./CarouselSection.jsx";

const experimentItems = [
  {
    title: "Wild Week Athens",
    description: "A complete event site in 1.5 weeks with 1.5 designers. Proof that taste is what makes the tools worth anything.",
    href: "https://week.wild.plus/athens-26",
    media: "/assets/experiments/wild-week-athens.mp4",
    mediaStyle: { transform: "scale(1.5)" },
    tags: [
      { label: "Claude", className: "claude" },
      { label: "Figma Weave", className: "weave" },
      { label: "Framer", className: "framer" },
    ],
  },
  {
    title: "Very fluffy",
    description: "We asked how fluffy we could make it. The answer: very.",
    href: "https://66.as.wild.tools",
    media: "/assets/experiments/very-fluffy.mp4",
    tags: [
      { label: "Claude", className: "claude" },
      { label: "Comfy", className: "comfy" },
    ],
  },
  {
    title: "Active heads",
    description: "Playing with Active Theory's activeframe library, pushed somewhere it wasn't meant to go.",
    href: "https://51.as.wild.tools",
    media: "/assets/experiments/active-heads.mp4",
    tags: [
      { label: "Claude", className: "claude" },
      { label: "Figma Weave", className: "weave" },
      { label: "activeframe", className: "aframe" },
    ],
  },
  {
    title: "A reliable asset pipeline",
    description: "Turning generative chaos into a repeatable system, with a dither heatmap finish.",
    href: "https://wild.as/labs",
    media: "/assets/experiments/asset-pipeline.avif",
    kind: "image",
    tags: [
      { label: "Comfy", className: "comfy" },
      { label: "Replit", className: "replit" },
    ],
  },
];

export function ExperimentsCarouselSection({ assetUrl = (path) => path }) {
  const items = experimentItems.map((item) => ({ ...item, media: assetUrl(item.media) }));
  return (
    <CarouselSection
      id="lab"
      items={items}
      heading="The tools are everywhere. The judgment isn't."
      description="For our creative team, AI has turned into a new layer of expression. The craft isn't new, but it used to need an engineer in the loop. Now a designer can build real interactions, motion, and shader work directly, which lets us take a client's project somewhere more distinctive than a static screen ever could."
      actionLabel="View experiment"
    />
  );
}
