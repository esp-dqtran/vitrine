import { useRef } from "react";
import { useNearestWildling } from "../hooks/useNearestWildling.js";
import { useReveal } from "../hooks/useReveal.js";
import { PixelButton } from "./PixelButton.jsx";

export function ContactSection({ sectionRef }) {
  const contentRef = useRef(null);
  const visible = useReveal(contentRef);
  const nearest = useNearestWildling();

  return (
    <section className="cta" id="contact" ref={sectionRef}>
      <div className="wrap" ref={contentRef}>
        <PixelButton
          as="a"
          className={`ctabtn reveal${visible ? " in" : ""}`}
          href="mailto:hello@wild.as"
          data-cursor-label="Email"
        >
          Get in touch
        </PixelButton>
        <p className={`meta reveal${visible ? " in" : ""}`} style={{ transitionDelay: "0.12s" }}>
          We're a remote studio scattered across five time zones, so the odds are decent that one of us is awake and somewhere near you. Part workshop, mostly Vienna at heart, and always happiest with a good challenge to solve.
        </p>
        <p className={`meta near reveal${visible ? " in" : ""}`} id="nearest" style={{ transitionDelay: "0.24s" }}>
          {nearest}
        </p>
        <p className={`meta reveal${visible ? " in" : ""}`} style={{ transitionDelay: "0.36s" }}>
          <a href="mailto:hello@wild.as">hello@wild.as</a> · Zieglergasse 65/2, 1070 Vienna.
        </p>
      </div>
    </section>
  );
}
