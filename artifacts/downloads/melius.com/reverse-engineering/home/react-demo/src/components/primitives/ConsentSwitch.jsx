export function ConsentSwitch({ checked, disabled = false, id, label, onCheckedChange }) {
  return <button
    aria-checked={checked}
    aria-label={label}
    className="consent-switch"
    data-state={checked ? "checked" : "unchecked"}
    disabled={disabled}
    id={id}
    onClick={() => onCheckedChange?.(!checked)}
    role="switch"
    type="button"
  >
    <span aria-hidden="true" className="consent-switch__thumb" />
  </button>;
}
