const TRACK_PATH = "M0 11.14c0-2 .49-3.87 1.34-5.5A10.4 10.4 0 0 1 13.4.4q.91.26 1.8.63.6.26 1.18.6A34 34 0 0 0 33.5 6.4h1.55A34 34 0 0 0 52.2 1.62q.58-.34 1.18-.6.9-.37 1.8-.63a10.4 10.4 0 0 1 12.06 5.26 11.8 11.8 0 0 1 .26 10.41 10.4 10.4 0 0 1-12.2 5.8q-1.06-.29-2.1-.72-.6-.27-1.19-.62a33 33 0 0 0-17.08-4.66h-1.28c-5.98 0-11.9 1.53-17.08 4.66q-.58.36-1.2.62-1.02.45-2.1.73a10.44 10.44 0 0 1-12.2-5.8A12 12 0 0 1 0 11.13";

export function BillingToggle({ annual = true, onChange }) {
  const select = () => onChange?.(!annual);

  return <button aria-label={annual ? "Switch to monthly billing" : "Switch to annual billing"} className="billing-toggle" data-annual={annual} onClick={select} type="button">
    <span className="billing-toggle__label" data-active={!annual}>Monthly</span>
    <span aria-hidden="true" className="billing-toggle__track">
      <svg fill="currentColor" height="24" viewBox="0 0 69 23" width="69"><path d={TRACK_PATH} /></svg>
      <span className="billing-toggle__knob"><i /></span>
    </span>
    <span className="billing-toggle__label" data-active={annual}>Annual</span>
  </button>;
}
