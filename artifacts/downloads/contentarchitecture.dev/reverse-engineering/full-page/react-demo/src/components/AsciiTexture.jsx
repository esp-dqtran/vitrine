const LINE = "THE CONTENT ARCHITECTURE · SHIPPED NOT PROTOTYPED · REAL CLIENTS · REAL DEADLINES · SIX YEARS OF PRODUCTION SITES · ";

export function AsciiTexture({ className = "" }) {
  return (
    <div className={`ascii-texture ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: 180 }, (_, index) => <span key={index}>{LINE.repeat(3)}</span>)}
    </div>
  );
}
