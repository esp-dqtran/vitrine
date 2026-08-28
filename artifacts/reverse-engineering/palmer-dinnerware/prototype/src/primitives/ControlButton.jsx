export function ControlButton({ icon, label, className = "", ...props }) {
  return (
    <button className={`control-button ${className}`.trim()} type="button" {...props}>
      {icon && <span className="control-button__icon" aria-hidden="true">{icon}</span>}
      {label && <span className="control-button__label">{label}</span>}
    </button>
  );
}
