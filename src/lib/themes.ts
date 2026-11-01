import { mixColors } from "./colors";

export type ColorMode = "light" | "dark" | "system";

type ThemePalette = {
  label: string;
  /** Main color from lightest to darkest (50, 100, 200, 300, 400, 500, 600, 700). */
  brand: string[];
  /** Accent color (50, 100, 400). */
  accent: string[];
};

/** Selectable color themes; each one derives its own dark mode. */
export const THEMES = {
  lavender: {
    label: "Lavendel",
    brand: [
      "#f6f2ff",
      "#ede6ff",
      "#ddd0ff",
      "#c5b1fb",
      "#a68cf2",
      "#8a6be5",
      "#7352d0",
      "#5c3fae",
    ],
    accent: ["#fff6fa", "#fde8f1", "#ec8ab4"],
  },
  ocean: {
    label: "Ozean",
    brand: [
      "#eff8ff",
      "#dbeefe",
      "#bddffc",
      "#8ec9f7",
      "#57a9ee",
      "#2f8bdc",
      "#1f6fc0",
      "#1a599b",
    ],
    accent: ["#effcfa", "#d6f5ef", "#4cc9b0"],
  },
  sage: {
    label: "Salbei",
    brand: [
      "#f2f8f2",
      "#e1efe1",
      "#c6e0c7",
      "#9fcaa2",
      "#72ac77",
      "#4f9156",
      "#3c7544",
      "#305e37",
    ],
    accent: ["#fbf8ef", "#f5eed8", "#d9bf78"],
  },
  coral: {
    label: "Koralle",
    brand: [
      "#fff4f1",
      "#ffe5de",
      "#ffcdc1",
      "#ffa795",
      "#f97f66",
      "#e9604a",
      "#cc4736",
      "#a8392b",
    ],
    accent: ["#fff9ec", "#ffefcc", "#f5bd55"],
  },
  slate: {
    label: "Schiefer",
    brand: [
      "#f4f6f9",
      "#e6ebf1",
      "#cfd7e2",
      "#a9b6c7",
      "#7d8ea6",
      "#5c6f8a",
      "#465872",
      "#38465c",
    ],
    accent: ["#f5f3f9", "#e9e6f2", "#9d93c0"],
  },
} satisfies Record<string, ThemePalette>;

export type ThemeId = keyof typeof THEMES;

const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700];

/** Colors of a theme as CSS variable values; the names match the tokens in `index.css`. */
export function getThemeTokens(id: ThemeId, dark: boolean) {
  const { brand, accent } = THEMES[id];
  const main = brand[5];
  const canvas = dark
    ? mixColors(brand[7], "#0e0e14", 0.82)
    : mixColors(brand[1], "#ffffff", 0.45);
  const surface = dark ? mixColors(brand[7], "#14141c", 0.68) : "#ffffff";

  // In dark mode the light steps become tinted dark surfaces, the main color stays
  const brandScale = dark
    ? [0.82, 0.72, 0.58, 0.4, 0.2, 0, 0, -0.35].map((amount) =>
        amount < 0
          ? mixColors(main, "#ffffff", -amount)
          : mixColors(main, surface, amount),
      )
    : brand;
  const accentScale = dark
    ? [mixColors(accent[2], surface, 0.86), mixColors(accent[2], surface, 0.74)]
    : accent;

  return {
    canvas,
    surface,
    ink: dark
      ? mixColors("#ffffff", main, 0.08)
      : mixColors(brand[7], "#14121f", 0.75),
    muted: dark
      ? mixColors("#a5a3b3", main, 0.2)
      : mixColors(brand[7], "#8a8a96", 0.7),
    line: dark
      ? mixColors(surface, "#ffffff", 0.1)
      : mixColors(brand[1], "#ffffff", 0.35),
    ...Object.fromEntries(
      BRAND_STEPS.map((step, index) => [`brand-${step}`, brandScale[index]]),
    ),
    "blush-50": accentScale[0],
    "blush-100": accentScale[1],
    "blush-400": accent[2],
    "warning-1": dark ? mixColors("#e3a400", surface, 0.72) : "#fff3c4",
    "warning-2": dark ? mixColors("#d6455d", surface, 0.68) : "#ffdde3",
  } as Record<string, string> & {
    canvas: string;
    surface: string;
    ink: string;
    muted: string;
    line: string;
  };
}
