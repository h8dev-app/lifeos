/**
 * Icon names available in the app (Lucide, ISC license, https://lucide.dev).
 * Pure list: usable without loading the components (parsing, tests).
 */
export const ICON_NAMES = [
  "house",
  "list-checks",
  "calendar",
  "notebook-pen",
  "activity",
  "square-terminal",
  "settings",
  "flame",
  "pin",
  "file-text",
  "folder",
  "folder-plus",
  "chart-column",
  "circle-question-mark",
  "square-check",
  "plus",
  "x",
  "trash-2",
  "chevron-left",
  "chevron-right",
  "chevron-down",
  "check",
  "external-link",
  "alarm-clock",
  "calendar-clock",
  "arrow-right",
  "corner-down-left",
  "layout-dashboard",
  "footprints",
  "graduation-cap",
  "chef-hat",
  "shopping-bag",
  "code",
  "circle-check",
  "circle-alert",
  "info",
  "square",
  "sparkles",
  "grip-vertical",
  "map-pin",
  "bell",
  "book-open",
  "music",
  "dumbbell",
  "bike",
  "wallet",
  "utensils",
  "coffee",
  "moon",
  "droplet",
  "gamepad-2",
  "heart",
  "briefcase",
  "plane",
  "car",
  "tag",
  "search",
  "key-round",
  "flag",
  "grip-horizontal",
  "maximize-2",
  "picture-in-picture-2",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const isIconName = (v: string): v is IconName => (ICON_NAMES as readonly string[]).includes(v);

/** Old emoji category icons (seed, older /cat) → icon. */
const EMOJI_ICONS: Record<string, IconName> = {
  "🏃": "footprints", "📚": "graduation-cap", "🍳": "chef-hat", "🛵": "shopping-bag", "💻": "code",
  "📖": "book-open", "🎵": "music", "🎶": "music", "💪": "dumbbell", "🏋": "dumbbell", "🚴": "bike",
  "💰": "wallet", "💸": "wallet", "🍔": "utensils", "☕": "coffee", "😴": "moon", "🛌": "moon",
  "💧": "droplet", "🎮": "gamepad-2", "❤": "heart", "💼": "briefcase", "✈": "plane", "🚗": "car",
};

/** Icon of a category: an icon name, a known emoji, or null (a colored dot is shown). */
export function categoryIcon(icon: string | null | undefined): IconName | null {
  if (!icon) return null;
  const v = icon.trim();
  if (isIconName(v)) return v;
  return EMOJI_ICONS[v.replace(/\uFE0F/g, "")] ?? null;
}
