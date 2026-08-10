import { type CSSProperties, type ReactNode } from "react";

/**
 * Shared shell for every contextual toolbar shown for a selected canvas
 * object. Object-specific controls stay as children, while the surface,
 * accessibility semantics, and pointer isolation remain identical.
 */
export function CanvasObjectToolbar({
  children,
  style,
  className,
  ariaLabel = "Selection Properties Menu",
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`canvas-object-toolbar project-object-toolbar${className ? ` ${className}` : ""}`}
      style={style}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerDown={(event) => event.stopPropagation()}
      /* Excalidraw listens to both mouse and pointer input, and it registers
       * keyboard shortcuts at the canvas root. Keep an open contextual control
       * (especially the Sticky Note link editor) from being interpreted as a
       * second canvas interaction or a tool shortcut. */
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** A consistent separator between universal and object-specific controls. */
export function CanvasObjectToolbarDivider() {
  return <span className="canvas-object-toolbar__divider project-object-toolbar__divider" aria-hidden="true" />;
}
