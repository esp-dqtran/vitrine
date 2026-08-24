import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { ContentArchitectureLogo } from "./ContentArchitectureLogo.jsx";
import "./MobileMenuCard.css";

const DEFAULT_LINKS = [
  { key: "features", label: "Features", href: "/#features" },
  { key: "the-repo", label: "The Repo", href: "/#the-repo" },
  { key: "showcase", label: "Showcase", href: "/#showcase" },
  { key: "pricing", label: "Pricing", href: "/#pricing", highlighted: true },
  { key: "faq", label: "FAQ", href: "/#faq" },
  { key: "blog", label: "Blog", href: "/blog" },
];

function DitherFrame({ children, className = "" }) {
  return <div className={`dither-frame ${className}`.trim()}>{children}</div>;
}

function AnnouncementMarquee({ children }) {
  return (
    <div className="announcement-marquee" aria-label={children}>
      <div className="announcement-marquee__track" aria-hidden="true">
        <span>{children}</span>
        <span>{children}</span>
      </div>
    </div>
  );
}

export function MobileMenuCard({
  links = DEFAULT_LINKS,
  announcement = "Now available with Astro",
  currentKey,
  defaultOpen = false,
  framed = true,
  className = "",
  onNavigate,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef(null);
  const menuId = useId();
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0.01 : 0.32;
  const collapseTransition = {
    duration,
    ease: [0.7, 0, 0.25, 1],
  };

  useEffect(() => {
    function closeFromOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function closeFromKeyboard(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  const listVariants = {
    open: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.05,
        delayChildren: reduceMotion ? 0 : 0.08,
      },
    },
    closed: {},
  };

  const itemVariants = {
    open: {
      opacity: 1,
      x: 0,
      transition: { duration, ease: [0.23, 1, 0.32, 1] },
    },
    closed: reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 },
  };

  const menu = (
      <div ref={rootRef} className={`mobile-menu-card ${framed ? "" : className}`.trim()}>
        <div className="mobile-menu-card__header">
          <a
            className="mobile-menu-card__home"
            href="/"
            aria-label="Home"
            onClick={(event) => onNavigate?.({ key: "home", href: "/" }, event)}
          >
            <ContentArchitectureLogo className="mobile-menu-card__logo" />
          </a>

          <button
            className="mobile-menu-card__toggle"
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span>Menu</span>
            <span className="mobile-menu-card__toggle-icon" aria-hidden="true">
              <span className="mobile-menu-card__toggle-horizontal" />
              <motion.span
                className="mobile-menu-card__toggle-vertical"
                initial={false}
                animate={{ rotate: open ? 90 : 0 }}
                transition={collapseTransition}
              />
            </span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={menuId}
              key="menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={collapseTransition}
              className="mobile-menu-card__collapsible"
            >
              <motion.ul
                className="mobile-menu-card__links"
                initial="closed"
                animate="open"
                exit="closed"
                variants={listVariants}
              >
                {links.map((link) => {
                  const isCurrent = link.key === currentKey;

                  return (
                    <motion.li key={link.key} variants={itemVariants}>
                      <a
                        className="mobile-menu-card__link"
                        href={link.href}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={(event) => {
                          setOpen(false);
                          onNavigate?.(link, event);
                        }}
                      >
                        <span>{link.label}</span>
                        {link.highlighted ? (
                          <span className="mobile-menu-card__pulse" aria-hidden="true" />
                        ) : null}
                      </a>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnnouncementMarquee>{announcement}</AnnouncementMarquee>
      </div>
  );

  return framed ? <DitherFrame className={className}>{menu}</DitherFrame> : menu;
}
