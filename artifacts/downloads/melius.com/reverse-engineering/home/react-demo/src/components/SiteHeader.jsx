import { useState } from "react";
import { AccordionContent } from "./primitives/AccordionContent";
import { MeliusLogo } from "./primitives/MeliusLogo";
import { MeliusButton } from "./primitives/MeliusButton";
import { MenuLink } from "./primitives/MenuLink";
import { MenuToggle } from "./primitives/MenuToggle";

export function SiteHeaderMenu() {
  const [open, setOpen] = useState(false);

  return <div className={`header-panel ${open ? "is-open" : ""}`}><div className="header-menu"><a className="brand" href="#top" aria-label="Melius home"><MeliusLogo /></a><MenuToggle id="melius-menu-toggle" open={open} controls="melius-main-navigation" onClick={() => setOpen((value) => !value)} /></div><AccordionContent id="melius-main-navigation" labelledBy="melius-menu-toggle" open={open}><nav aria-label="Main navigation"><ul className="menu-links"><li><MenuLink href="/pricing">Pricing</MenuLink></li><li><MenuLink href="/enterprise">Enterprise</MenuLink></li><li><MenuLink href="/about">About</MenuLink></li><li><MenuLink href="/blog">Blog</MenuLink></li></ul><div className="menu-actions"><MeliusButton href="https://app.melius.com/login" size="menu">Sign In</MeliusButton><MeliusButton href="https://app.melius.com/signup" size="menu" variant="yellow">Start for Free</MeliusButton></div></nav></AccordionContent></div>;
}

export function SiteHeader({ assetBase = "/assets/" }) {
  return <header className="site-header"><SiteHeaderMenu /><div className="header-actions"><MeliusButton href="https://app.melius.com/login" variant="yellow">Sign In</MeliusButton><MeliusButton href="https://app.melius.com/signup" variant="orange">Start for Free</MeliusButton></div></header>;
}
