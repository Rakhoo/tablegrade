import { useLayoutEffect, useRef } from "react";

type FitTextProps = {
  text: string;
  className?: string;
  /** Font size in px the text starts with. */
  maxSize?: number;
  /** Smallest font size in px; text still too long is cut off with "…". */
  minSize?: number;
};

/** Step in px by which the font shrinks while the text does not fit. */
const STEP = 0.5;

/**
 * A single line of text that shrinks its font to fit its width, down to `minSize`, and only
 * then gets cut off with "…". It refits whenever its width changes.
 */
export function FitText({
  text,
  className = "",
  maxSize = 14,
  minSize = 10,
}: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current!;
    const fit = () => {
      let size = maxSize;
      element.style.fontSize = `${size}px`;
      while (element.scrollWidth > element.clientWidth && size > minSize) {
        size = Math.max(size - STEP, minSize);
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, maxSize, minSize]);

  return (
    <span ref={ref} className={`truncate ${className}`}>
      {text}
    </span>
  );
}
