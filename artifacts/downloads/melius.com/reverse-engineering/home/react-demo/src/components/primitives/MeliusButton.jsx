/** Source button primitive used by the header’s menu and top-level CTAs. */
export function MeliusButton({ children, href, size = "header", variant = "outline" }) {
  return <a className={`melius-button melius-button--${size} melius-button--${variant}`} href={href}>{children}</a>;
}
