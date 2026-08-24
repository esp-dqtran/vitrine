import "./DesktopMenuCard.css";

const DEFAULT_LINKS = [
  {
    key: "features",
    label: "Features",
    href: "/#features",
    glyphs: [
      ["F", "2", "D", "V", "W", "F"],
      ["e", "5", "E", "9", "D", "e"],
      ["a", "0", "6", "S", "P", "a"],
      ["t", "5", "2", "5", "R", "t"],
      ["u", "1", "P", "D", "R", "u"],
      ["r", "Q", "I", "X", "V", "r"],
      ["e", "P", "A", "F", "F", "e"],
      ["s", "M", "C", "1", "B", "s"],
    ],
  },
  {
    key: "the-repo",
    label: "The Repo",
    href: "/#the-repo",
    glyphs: [
      ["T", "E", "5", "J", "S", "T"],
      ["h", "4", "H", "O", "M", "h"],
      ["e", "5", "U", "T", "E", "e"],
      [" "],
      ["r", "H", "W", "3", "Y", "r"],
      ["e", "P", "6", "Z", "5", "e"],
      ["p", "H", "H", "T", "L", "p"],
      ["o", "B", "J", "I", "1", "o"],
    ],
  },
  {
    key: "showcase",
    label: "Showcase",
    href: "/#showcase",
    glyphs: [
      ["S", "I", "L", "E", "W", "S"],
      ["h", "4", "H", "O", "M", "h"],
      ["o", "2", "V", "B", "H", "o"],
      ["w", "Z", "E", "8", "D", "w"],
      ["c", "J", "5", "1", "S", "c"],
      ["a", "S", "I", "5", "O", "a"],
      ["s", "7", "Y", "0", "8", "s"],
      ["e", "E", "0", "V", "S", "e"],
    ],
  },
  {
    key: "pricing",
    label: "Pricing",
    href: "/#pricing",
    highlighted: true,
    glyphs: [
      ["P", "J", "9", "Y", "U", "P"],
      ["r", "M", "T", "1", "F", "r"],
      ["i", "B", "R", "Q", "H", "i"],
      ["c", "Y", "V", "4", "R", "c"],
      ["i", "6", "U", "B", "T", "i"],
      ["n", "P", "2", "Q", "Y", "n"],
      ["g", "U", "H", "8", "Z", "g"],
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    href: "/#faq",
    glyphs: [
      ["F", "2", "D", "V", "W", "F"],
      ["A", "K", "Y", "M", "9", "A"],
      ["Q", "U", "F", "G", "F", "Q"],
    ],
  },
  {
    key: "blog",
    label: "Blog",
    href: "/blog",
    glyphs: [
      ["B", "N", "W", "4", "O", "B"],
      ["l", "F", "H", "2", "Q", "l"],
      ["o", "2", "V", "B", "H", "o"],
      ["g", "C", "S", "K", "R", "g"],
    ],
  },
];

function OdometerLabel({ columns, label }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span className="desktop-menu__odometer" aria-hidden="true">
        {columns.map((glyphs, index) => {
          const visibleGlyph = glyphs[0] ?? " ";
          const stationary = glyphs.length === 1;

          return (
            <span className="desktop-menu__character" key={`${label}-${index}`}>
              <span className="desktop-menu__character-width">{visibleGlyph}</span>
              <span
                className={`desktop-menu__glyph-track${stationary ? " is-stationary" : ""}`}
                style={{ "--glyph-delay": `${index * 28}ms` }}
              >
                {glyphs.map((glyph, glyphIndex) => (
                  <span className="desktop-menu__glyph" key={`${glyph}-${glyphIndex}`}>
                    {glyph}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );
}

function AnnouncementMarquee({ children }) {
  const repeated = Array.from({ length: 8 }, (_, index) => (
    <span key={index}>{children}</span>
  ));

  return (
    <div className="desktop-menu__announcement" aria-label={children}>
      <div className="desktop-menu__marquee" aria-hidden="true">
        <div className="desktop-menu__marquee-set">{repeated}</div>
        <div className="desktop-menu__marquee-set">{repeated}</div>
      </div>
    </div>
  );
}

export function DesktopMenuCard({
  announcement = "Now available with Astro",
  className = "",
  links = DEFAULT_LINKS,
  onNavigate,
}) {
  return (
    <div className={`desktop-menu-frame ${className}`.trim()}>
      <nav className="desktop-menu" aria-label="Primary navigation">
        <ul className="desktop-menu__links">
          <li className="desktop-menu__home-item">
            <a
              className="desktop-menu__home"
              href="/"
              aria-label="Home"
              onClick={(event) => onNavigate?.({ key: "home", href: "/" }, event)}
            >
              <img
                className="desktop-menu__logo"
                src="/assets/content-architecture-logo.png"
                alt=""
                width="30"
                height="30"
              />
            </a>
          </li>

          {links.map((link) => (
            <li className="desktop-menu__item" key={link.key}>
              <a
                className="desktop-menu__link"
                href={link.href}
                onClick={(event) => onNavigate?.(link, event)}
              >
                <OdometerLabel columns={link.glyphs} label={link.label} />
                {link.highlighted ? (
                  <span className="desktop-menu__status" aria-hidden="true">
                    <span className="desktop-menu__status-ping" />
                    <span className="desktop-menu__status-dot" />
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>

        <AnnouncementMarquee>{announcement}</AnnouncementMarquee>
      </nav>
    </div>
  );
}
