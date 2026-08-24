import { useId, useState } from "react";
import { AccordionContent } from "./primitives/AccordionContent";

export function FaqAccordionItem({ answer, defaultOpen = false, id, onOpenChange, open: controlledOpen, question }) {
  const generatedId = useId().replace(/:/g, "");
  const itemId = id ?? `faq-${generatedId}`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value) => {
    if (controlledOpen === undefined) setUncontrolledOpen(value);
    onOpenChange?.(value);
  };

  return <div className="faq-accordion-item" data-orientation="vertical" data-slot="accordion-item" data-state={open ? "open" : "closed"}>
    <h3 className="faq-accordion-item__heading" data-orientation="vertical" data-state={open ? "open" : "closed"}>
      <button aria-controls={`${itemId}-content`} aria-expanded={open} className="faq-accordion-item__trigger" data-orientation="vertical" data-slot="accordion-trigger" data-state={open ? "open" : "closed"} id={`${itemId}-trigger`} onClick={() => setOpen(!open)} type="button">
        {question}
        <span aria-hidden="true" className="faq-accordion-item__icon-wrap"><span className="faq-accordion-item__icon" /></span>
      </button>
    </h3>
    <AccordionContent id={`${itemId}-content`} labelledBy={`${itemId}-trigger`} open={open}>
      <div className="faq-accordion-item__answer">{answer}</div>
    </AccordionContent>
  </div>;
}
