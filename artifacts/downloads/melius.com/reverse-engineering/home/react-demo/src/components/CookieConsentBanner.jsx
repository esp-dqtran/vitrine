export function CookieConsentBanner({ onAccept, onCustomize, onReject, visible }) {
  if (!visible) return null;
  return <aside aria-label="Cookie consent" className="cookie-consent-banner"><h2>We value your privacy</h2><p>This site uses cookies to improve your browsing experience,<br className="cookie-consent-banner__desktop-break" /> analyze site traffic, and show personalized content</p><div><button onClick={onCustomize} type="button">Customize</button><span><button onClick={onReject} type="button">Reject all</button><button onClick={onAccept} type="button">Accept all</button></span></div></aside>;
}
