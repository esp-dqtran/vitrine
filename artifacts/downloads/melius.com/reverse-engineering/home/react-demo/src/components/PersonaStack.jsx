import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PersonaCard } from "./PersonaCard";
import { PersonaUseCaseField } from "./PersonaUseCaseField";

const modulo = (value, length) => ((value % length) + length) % length;

function PersonaSelector({ activeIndex, cards, onSelect }) {
  const rowRef = useRef(null);
  const buttonRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const update = () => {
      const row = rowRef.current;
      const button = buttonRefs.current[activeIndex];
      if (!row || !button) return;
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
      row.scrollTo({ left: Math.max(0, button.offsetLeft - (row.clientWidth - button.offsetWidth) / 2), behavior: "smooth" });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex]);

  return <div className="persona-selector">
    <div className="persona-selector__row" ref={rowRef}>
      <i aria-hidden="true" className="persona-selector__indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      {cards.map((card, index) => <button
        aria-pressed={index === activeIndex}
        key={card.title}
        onClick={() => onSelect(index)}
        ref={(element) => { buttonRefs.current[index] = element; }}
        type="button"
      >{card.title}</button>)}
    </div>
  </div>;
}

export function PersonaStack({ assetBase = "", cards }) {
  const stackRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [activePosition, setActivePosition] = useState(0);
  const [cardPositions, setCardPositions] = useState(() => cards.map((_, index) => index));
  const count = cards.length;
  const activeIndex = modulo(activePosition, count);

  useEffect(() => {
    setCardPositions((positions) => positions.length === count ? positions : cards.map((_, index) => index));
  }, [cards, count]);

  useEffect(() => {
    const element = stackRef.current;
    if (!element || typeof IntersectionObserver === "undefined") { setEntered(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setEntered(true);
      observer.disconnect();
    }, { threshold: .3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!entered) return undefined;
    const timer = window.setTimeout(() => {
      setCardPositions((positions) => positions.map((position) => {
        let relative = position - activePosition;
        while (relative < 0) relative += count;
        while (relative >= count) relative -= count;
        return activePosition + relative;
      }));
    }, 520);
    return () => window.clearTimeout(timer);
  }, [activePosition, count, entered]);

  const select = (index) => {
    const targetIndex = modulo(index, count);
    setActivePosition((position) => position + targetIndex - activeIndex);
  };

  return <>
    <div className="persona-stack" data-source-stack="true" ref={stackRef} role="group" aria-label="Personas">
      <div className="persona-stack__cards">{cards.map((card, index) => {
      const relative = (cardPositions[index] ?? index) - activePosition;
      const isActive = index === activeIndex;
      const clamped = Math.max(-1, Math.min(count, relative));
      const style = {
        "--persona-enter-delay": `${index * 75}ms`,
        "--persona-opacity": entered ? 1 : 0,
        "--persona-scale-y": entered ? 1 : 1.3,
        "--persona-y": `${entered ? -6 * clamped : 50}rem`,
        "--persona-z": count - Math.round(relative),
        "--persona-z-depth": `${-5 * clamped}rem`,
      };
      return <div className="persona-stack__item" data-active={isActive} data-entered={entered} key={card.title} style={style}>
        <PersonaCard {...card} active={isActive} onSelect={() => select(index)} />
      </div>;
      })}</div>
    </div>
    <PersonaUseCaseField activeIndex={activeIndex} active={entered} assetBase={assetBase} cards={cards} />
    <PersonaSelector activeIndex={activeIndex} cards={cards} onSelect={select} />
  </>;
}
