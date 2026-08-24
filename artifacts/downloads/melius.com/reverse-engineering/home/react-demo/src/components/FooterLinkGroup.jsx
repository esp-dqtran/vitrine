import { useId, useState } from "react";
import { AccordionContent } from "./primitives/AccordionContent";

/**
 * One source footer link column. Melius renders this as a Radix accordion
 * below its lg breakpoint and as an always-visible column at lg and above.
 */
export function FooterLinkGroup({ links, title }) {
  const generatedId = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const contentId = `footer-links-${generatedId}`;
  const triggerId = `footer-links-trigger-${generatedId}`;

  const linkList = <div className="footer-link-group__links">{links.map((link) => <a href={link.href} key={`${link.label}-${link.href}`} target={link.newTab ? "_blank" : "_self"}>{link.label}</a>)}</div>;

  return <section className="footer-link-group">
    <div className="footer-link-group__mobile">
      <button aria-controls={contentId} aria-expanded={open} className="footer-link-group__trigger" data-orientation="vertical" data-slot="accordion-trigger" data-state={open ? "open" : "closed"} id={triggerId} onClick={() => setOpen(!open)} type="button">
        <span>{title}</span>
        <span aria-hidden="true" className="footer-link-group__icon-wrap"><span className="footer-link-group__icon" /></span>
      </button>
      <AccordionContent id={contentId} labelledBy={triggerId} open={open}>
        <div className="footer-link-group__content">{linkList}</div>
      </AccordionContent>
    </div>
    <div className="footer-link-group__desktop">
      <div className="footer-link-group__title">{title}</div>
      {linkList}
    </div>
  </section>;
}
