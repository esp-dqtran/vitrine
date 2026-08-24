import { DesktopMenuCard } from "./components/DesktopMenuCard.jsx";
import { MobileMenuCard } from "./components/MobileMenuCard.jsx";

export function App() {
  function preventDemoNavigation(_link, event) {
    event.preventDefault();
  }

  return (
    <main className="demo-shell">
      <header className="site-menu-header">
        <DesktopMenuCard className="site-menu-desktop" onNavigate={preventDemoNavigation} />
        <MobileMenuCard className="site-menu-mobile" onNavigate={preventDemoNavigation} />
      </header>

      <section className="demo-content" aria-hidden="true">
        <p>Built for agentic development.</p>
        <h1>The Sanity setup agents don't reinvent.</h1>
      </section>
    </main>
  );
}
