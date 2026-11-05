import { useLayoutEffect, useRef } from "react";

type FitTextProps = {
  text: string;
  className?: string;
  /** Font size in px the text starts with. */
  maxSize?: number;
  /** Smallest font size in px. */
  minSize?: number;
  /** Lines the text may take before it is cut off with "…". */
  maxLines?: number;
};

/** Step in px by which the font shrinks while the text does not fit. */
const STEP = 0.5;
/** Line height relative to the font size. */
const LEADING = 1.25;
const SOFT_HYPHEN = "­";

/**
 * Allows breaking words anywhere with a hyphen, keeping at least two letters on each side.
 * Existing hyphens and spaces stay the only breaks between words.
 */
const hyphenate = (text: string) =>
  text.replace(/\p{L}{4,}/gu, (word) => {
    const letters = [...word];
    return letters
      .map((letter, index) =>
        index >= 2 && index <= letters.length - 2
          ? SOFT_HYPHEN + letter
          : letter,
      )
      .join("");
  });

/**
 * Text that fits its width, at the largest font size from `maxSize` down to `minSize` that
 * fits, trying in turn: one line; up to `maxLines` lines broken at spaces and hyphens; the same
 * with words split by a hyphen. Only then it is cut off with "…" at `minSize`. It refits
 * whenever its width changes, e.g. while zooming.
 */
export function FitText({
  text,
  className = "",
  maxSize = 14,
  minSize = 8,
  maxLines = 2,
}: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current!;
    const { style } = element;
    const setSize = (size: number) => (style.fontSize = `${size}px`);
    const fits = (size: number, lines: number) =>
      element.scrollWidth <= element.clientWidth &&
      element.scrollHeight <= Math.ceil(size * LEADING * lines) + 1;
    const fit = () => {
      style.display = "block";
      style.webkitLineClamp = "";
      // A smaller font comes before a second line, a second line before splitting words
      const attempts = [
        { variant: text, lines: 1 },
        { variant: text, lines: maxLines },
        { variant: hyphenate(text), lines: maxLines },
      ];
      for (const { variant, lines } of attempts) {
        element.textContent = variant;
        for (let size = maxSize; size >= minSize; size -= STEP) {
          setSize(size);
          if (fits(size, lines)) return;
        }
      }
      setSize(minSize);
      style.display = "-webkit-box";
      style.webkitBoxOrient = "vertical";
      style.webkitLineClamp = String(maxLines);
    };
    fit();
    // Changing the font changes the height only, so only a new width needs refitting
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth == width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, maxSize, minSize, maxLines]);

  // The text is set by the effect, which tries the variants on the element itself
  return (
    <span
      ref={ref}
      title={text}
      className={`overflow-hidden ${className}`}
      style={{ lineHeight: LEADING }}
    />
  );
}
