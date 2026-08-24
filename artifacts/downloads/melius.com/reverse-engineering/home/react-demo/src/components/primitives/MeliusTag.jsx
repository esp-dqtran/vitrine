export function MeliusTag({ children, tone = "orange" }) {
  return <span className={`melius-tag melius-tag--${tone}`}>{children}</span>;
}
