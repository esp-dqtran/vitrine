import { SHOWCASE_GLYPH_DATA } from "../recovered/glyph/glyphData.js";
import { GlyphFieldBackdrop } from "../recovered/glyph/GlyphFieldBackdrop.jsx";
import { AnimatedText } from "../recovered/text/AnimatedText.jsx";
import { AsciiShowcaseCard } from "./AsciiShowcaseCard.jsx";

const SHOWCASE_ASSETS = [
  new URL("../../public/assets/good-fella.avif", import.meta.url).href,
  new URL("../../public/assets/house-of-honey.avif", import.meta.url).href,
  new URL("../../public/assets/aspen-search.avif", import.meta.url).href,
  new URL("../../public/assets/anuc-home.avif", import.meta.url).href,
  new URL("../../public/assets/edoardo-lunardi.avif", import.meta.url).href,
  new URL("../../public/assets/serve-robotics.avif", import.meta.url).href,
  new URL("../../public/assets/muralia.avif", import.meta.url).href,
  new URL("../../public/assets/blink.avif", import.meta.url).href,
  new URL("../../public/assets/wasl.avif", import.meta.url).href,
  new URL("../../public/assets/creative-lives.avif", import.meta.url).href,
  new URL("../../public/assets/content-architecture.avif", import.meta.url).href,
];

export function ShowcaseSection({ items }) {
  return (
    <div
      id="showcase"
      className="showcase-section"
      data-page-builder-section="showcaseSection"
    >
      <GlyphFieldBackdrop data={SHOWCASE_GLYPH_DATA} />
      <div className="showcase-section__intro">
        <h2 data-studio-field="title"><AnimatedText>The work that gets remembered.</AnimatedText></h2>
        <div className="showcase-section__copy" data-studio-field="appRichText">
          <p>
            Real sites, shipped on The Content Architecture. With the plumbing
            already handled, the effort goes where it shows. The work here has
            been recognized by{" "}
            <a href="https://www.awwwards.com/" target="_blank" rel="noopener noreferrer">Awwwards</a>,{" "}
            <a href="https://thefwa.com/" target="_blank" rel="noopener noreferrer">FWA</a>, and{" "}
            <a href="https://www.cssdesignawards.com/" target="_blank" rel="noopener noreferrer">CSSDA</a>, and
            picked up across design directories.
          </p>
        </div>
      </div>
      <div className="showcase-grid">
        {items.map((item, index) => (
          <AsciiShowcaseCard
            key={item.title}
            href={item.href}
            imageAlt={item.alt}
            imageSrc={SHOWCASE_ASSETS[index]}
            studioIndex={index}
            title={item.title}
          />
        ))}
      </div>
    </div>
  );
}
