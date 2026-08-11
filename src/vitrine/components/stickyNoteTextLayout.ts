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

/*
 * Sticky Notes are Excalidraw rectangles with a bound text element. Keep the
 * exact inset Excalidraw uses for a rectangle label so the saved canvas text,
 * the in-place editor, and the rectangle's own resize behaviour share one
 * coordinate system.
 */
export const stickyNoteTextHorizontalInset = 5;
export const stickyNoteTextVerticalInset = 5;

export function stickyNoteTextContentWidth(width: number) {
  return Math.max(0, width - stickyNoteTextHorizontalInset * 2);
}

export function stickyNoteBoundTextPosition(
  container: StickyNoteTextContainer,
  textElement: StickyNoteBoundText,
) {
  const width = stickyNoteTextContentWidth(container.width);
  return {
    x:
      textElement.textAlign === "right"
        ? container.x + stickyNoteTextHorizontalInset + width - textElement.width
        : textElement.textAlign === "center"
          ? container.x +
            stickyNoteTextHorizontalInset +
            (width - textElement.width) / 2
          : container.x + stickyNoteTextHorizontalInset,
    y: container.y + stickyNoteTextVerticalInset,
  };
}
