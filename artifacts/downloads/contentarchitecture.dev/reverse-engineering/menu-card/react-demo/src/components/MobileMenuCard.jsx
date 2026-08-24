import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Minus, Plus } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
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
  className = "",
  onNavigate,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef(null);
  const menuId = useId();
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0.01 : 0.32;

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
      transition: { duration, ease: "easeOut" },
    },
    closed: reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 },
  };

  return (
    <DitherFrame className={className}>
      <nav ref={rootRef} className="mobile-menu-card" aria-label="Primary navigation">
        <div className="mobile-menu-card__header">
          <img
            className="mobile-menu-card__logo"
            src="/assets/content-architecture-logo.png"
            alt=""
            width="24"
            height="24"
          />

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
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={open ? "minus" : "plus"}
                  className="mobile-menu-card__toggle-glyph"
                  initial={{ opacity: 0, rotate: open ? -45 : 45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: open ? 45 : -45 }}
                  transition={{ duration, ease: "easeInOut" }}
                >
                  {open ? <Minus size={14} weight="thin" /> : <Plus size={14} weight="thin" />}
                </motion.span>
              </AnimatePresence>
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
              transition={{ duration, ease: "easeInOut" }}
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
      </nav>
    </DitherFrame>
  );
}
