/** Source header navigation link: accessible label plus visible menu text. */
export function MenuLink({ children, href }) {
  return <a className="menu-link" href={href}><span className="sr-only">Go to </span>{children}</a>;
}
