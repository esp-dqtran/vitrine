import { useState } from "react";
import { FaqAccordionItem } from "./FaqAccordionItem";

export function FaqSection({ items, title = "Frequently asked questions" }) {
  const [openIndex, setOpenIndex] = useState(null);

  return <section className="faq-section" id="faq">
    <div className="faq-section__inner">
      <h2>{title}</h2>
      <div className="faq-section__items">{items.map((item, index) => <FaqAccordionItem answer={item.answer} id={`faq-item-${index}`} key={item.question} onOpenChange={(open) => setOpenIndex(open ? index : null)} open={openIndex === index} question={item.question} />)}</div>
    </div>
  </section>;
}
