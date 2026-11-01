/** Mixes two `#rrggbb` colors; `amount` 0 returns `from`, 1 returns `to`. */
export function mixColors(from: string, to: string, amount: number) {
  const channel = (color: string, index: number) =>
    parseInt(color.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) =>
    Math.round(
      channel(from, index) +
        (channel(to, index) - channel(from, index)) * amount,
    )
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}
