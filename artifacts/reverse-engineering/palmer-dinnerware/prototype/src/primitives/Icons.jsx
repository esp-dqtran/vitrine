function Icon({ size = 24, children, ...props }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {children}
      </g>
    </svg>
  );
}

export function Plus(props) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function Minus(props) {
  return <Icon {...props}><path d="M5 12h14" /></Icon>;
}

export function X(props) {
  return <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}

export function MoveRight(props) {
  return <Icon {...props}><path d="M5 12h14M14 7l5 5-5 5" /></Icon>;
}

export function ArrowLeftRight(props) {
  return (
    <Icon {...props}>
      <path d="M7 7h12M15 3l4 4-4 4M17 17H5M9 13l-4 4 4 4" />
    </Icon>
  );
}

export function Move(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </Icon>
  );
}

export function RotateCcw(props) {
  return (
    <Icon {...props}>
      <path d="M4 4v6h6M5.6 15.5A8 8 0 1 0 6 7.2L4 10" />
    </Icon>
  );
}
