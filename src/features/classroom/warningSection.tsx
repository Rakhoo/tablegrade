import type { PickSection } from "../../components/OptionPicker";
import { WARNING_LEVELS } from "../../lib/warnings";

/** The warning levels as choices for one student, keyed by their number of warnings. */
export const WARNING_SECTION: PickSection = {
  key: "levels",
  columns: WARNING_LEVELS.length,
  stretch: true,
  options: WARNING_LEVELS.map((level, index) => ({
    key: String(index),
    label: level?.label ?? "Normal",
    content: (
      <span
        className="rounded-full px-2.5 py-1"
        style={{ background: level?.background }}
      >
        {level?.label ?? "Normal"}
      </span>
    ),
  })),
};
