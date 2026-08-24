import { DesktopMenuCard } from "../recovered/menu/DesktopMenuCard.jsx";
import { MobileMenuCard } from "../recovered/menu/MobileMenuCard.jsx";

export function SiteNavigation({ currentKey, onNavigate }) {
  const navigate = (link, event) => {
    onNavigate?.(link, event);
    if (event.defaultPrevented) return;

    if (link.key === "home") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (link.href.startsWith("/#")) {
      event.preventDefault();
      document.querySelector(link.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="site-navigation" data-studio-chrome="showHeader">
      <nav aria-label="Primary">
        <div className="site-navigation__frame">
          <DesktopMenuCard framed={false} className="site-navigation__desktop" currentKey={currentKey} onNavigate={navigate} />
          <MobileMenuCard framed={false} className="site-navigation__mobile" currentKey={currentKey} onNavigate={navigate} />
        </div>
      </nav>
    </header>
  );
}
