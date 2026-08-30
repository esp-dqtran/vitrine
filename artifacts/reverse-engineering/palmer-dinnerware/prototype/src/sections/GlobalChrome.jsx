import { BrandLogo } from "../primitives/BrandLogo";

export function GlobalChrome() {
  return (
    <header className="global-chrome">
      <a className="site-logo" href="/apps" aria-label="Back to Apps"><BrandLogo /></a>
    </header>
  );
}
