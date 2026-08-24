export function SegmentedTab({ active = false, children, onClick }) {
  return <button aria-current={active ? "true" : undefined} className="segmented-tab" data-state={active ? "active" : "inactive"} type="button" onClick={onClick}><span>{children}</span></button>;
}
