/** Pastel tile colors for lessons: background, accent bar and text. */
const PALETTE = [
  { background: "#ede6ff", accent: "#8a6be5", text: "#4b3591" },
  { background: "#fde8f1", accent: "#e0679b", text: "#8f2f5a" },
  { background: "#e3f1ff", accent: "#5b9be6", text: "#265289" },
  { background: "#e2f6ee", accent: "#4bb38a", text: "#1f6b4e" },
  { background: "#fff1e0", accent: "#f0a04b", text: "#8a5216" },
  { background: "#f4e9fb", accent: "#b57ad8", text: "#6a3a8a" },
  { background: "#fff8d6", accent: "#d9b632", text: "#75611a" },
  { background: "#e5f5f8", accent: "#47aebf", text: "#1e6571" },
];

/** Stable color of a subject, derived from its name so it never changes between sessions. */
export function getSubjectColor(subject: string) {
  let hash = 0;
  for (const char of subject.trim().toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
