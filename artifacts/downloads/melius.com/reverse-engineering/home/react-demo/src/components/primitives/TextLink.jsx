export function TextLink({ href, children, accent }) {
  return <a className="text-link" href={href}>{children}{accent ? <span className="text-link__accent">{accent}</span> : null}</a>;
}
