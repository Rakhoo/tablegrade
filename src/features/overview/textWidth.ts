/** Shared canvas context for measuring, created on first use. */
let context: CanvasRenderingContext2D | null = null;

/**
 * Width in pixels of a text in the page's font at a CSS font weight and size, measured on a
 * canvas without touching the layout. Without canvas support it is estimated.
 */
export function measureText(text: string, weight: number, size: number) {
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return text.length * size * 0.6;
  context.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
  return context.measureText(text).width;
}
