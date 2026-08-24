import { FooterStatus } from "./primitives/FooterStatus";

export function FooterMeta({ copyright = "© 2026 Melius AI, Inc.", legalLinks, onOpenCookiePreferences, status = "operational" }) {
  return <div className="footer-meta">
    <div className="footer-meta__status-group">
      <FooterStatus status={status} />
      <p>{copyright}</p>
    </div>
    <div className="footer-meta__legal-links">
      {legalLinks.map((link) => <a href={link.href} key={`${link.label}-${link.href}`} target={link.newTab ? "_blank" : "_self"}>{link.label}</a>)}
      <button onClick={onOpenCookiePreferences} type="button">Cookie Preferences</button>
    </div>
  </div>;
}
