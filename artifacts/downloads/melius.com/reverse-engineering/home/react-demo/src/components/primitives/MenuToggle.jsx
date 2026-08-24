/**
 * Source evidence: Melius header MenuToggle button in raw.html.
 * The source swaps three horizontal SVG paths for three coincident paths
 * when open; we keep that DOM behaviour rather than approximating it in CSS.
 */
export function MenuToggle({ id, open, onClick, controls }) {
  return <button id={id} className="menu-toggle" type="button" aria-label="Menu" aria-expanded={open} aria-controls={controls} data-state={open ? "open" : "closed"} onClick={onClick}><svg className="menu-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="#ffffff" aria-hidden="true"><path d="M3 12H21" strokeWidth="2" />{open ? <><path d="M3 12H21" strokeWidth="2" /><path d="M3 12H21" strokeWidth="2" /></> : <><path d="M3 6H21" strokeWidth="2" /><path d="M3 18H21" strokeWidth="2" /></>}</svg></button>;
}
