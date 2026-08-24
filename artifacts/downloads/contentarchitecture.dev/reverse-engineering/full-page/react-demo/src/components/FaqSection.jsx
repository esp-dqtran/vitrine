import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GlyphFieldBackdrop } from "../recovered/glyph/GlyphFieldBackdrop.jsx";
import { FAQ_GLYPH_DATA } from "../recovered/glyph/glyphData.js";
import { SplitButton } from "./SplitButton.jsx";

function splitQuestion(question) {
  const match = question.match(/^(Q\.\d+\s*\/)\s*(.*)$/);
  return match ? { index: match[1], label: match[2] } : { index: "", label: question };
}

function FaqItem({ expanded, index, item, onToggle }) {
  const prefersReducedMotion = useReducedMotion();
  const question = splitQuestion(item.question);
  const buttonId = `faq-question-${index + 1}`;
  const panelId = `faq-answer-${index + 1}`;
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.7, 0, 0.25, 1] };

  return (
    <li className={expanded ? "is-open" : ""} data-studio-item={`items.${index}`}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span>
            <span className="faq-item__index" inert>{question.index}</span>{" "}
            <span data-studio-field={`items.${index}.question`}>{question.label}</span>
          </span>
          <i aria-hidden="true">
            <span />
            <motion.span
              initial={false}
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={transition}
            />
          </i>
        </button>
      </h3>
      <motion.div
        id={panelId}
        className="faq-answer-panel"
        inert={!expanded}
        initial={false}
        animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={transition}
      >
        <div className="faq-answer" data-studio-field={`items.${index}.appRichText`}>
          {item.answer.replace(/^\?\s*/, "").split("\n").filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </motion.div>
    </li>
  );
}

export function FaqSection({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="faq-section" data-page-builder-section="faqSection">
      <GlyphFieldBackdrop data={FAQ_GLYPH_DATA} />
      <div className="faq-section__layout">
        <div className="faq-section__intro">
          <h2 data-studio-field="title">Before you buy</h2>
          <div className="faq-section__action">
            <SplitButton href="#pricing">Get access</SplitButton>
          </div>
        </div>
        <ul className="faq-list">
          {items.map((item, index) => (
            <FaqItem
              expanded={open === index}
              index={index}
              item={item}
              key={item.question}
              onToggle={() => setOpen(open === index ? -1 : index)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
