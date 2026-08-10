export type StickyNoteTextAlign = "left" | "center" | "right";

interface StickyNoteTextContainer {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StickyNoteBoundText {
  width: number;
  height: number;
  textAlign: StickyNoteTextAlign;
}

/* FigJam Sticky Notes keep content in the top-left with a 24px visual inset. */
export function stickyNoteBoundTextPosition(
  container: StickyNoteTextContainer,
  textElement: StickyNoteBoundText,
) {
  const padding = 24;
  const width = Math.max(0, container.width - padding * 2);
  return {
    x:
      textElement.textAlign === "right"
        ? container.x + padding + width - textElement.width
        : textElement.textAlign === "center"
          ? container.x + padding + (width - textElement.width) / 2
          : container.x + padding,
    y: container.y + padding,
  };
}
