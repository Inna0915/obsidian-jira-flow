export const priorityColors: Record<string, string> = {
  Highest: "#FF5630",
  High: "#FF7452",
  Medium: "#FFAB00",
  Low: "#36B37E",
  Lowest: "#00875A",
};

export const typeColors: Record<string, string> = {
  Bug: "#FF5630",
  Story: "#36B37E",
  Task: "#4C9AFF",
  Feature: "#3B82F6",
  Enabler: "#F97316",
  Personal: "#F59E0B",
  "Sub-task": "#6554C0",
  Epic: "#FF991F",
};

export const typeTextIcons: Record<string, string> = {
  Bug: "B",
  Story: "S",
  Task: "T",
  Feature: "F",
  Enabler: "EN",
  Personal: "P",
  "Sub-task": "ST",
  Epic: "E",
};

export const typeEmojiIcons: Record<string, string> = {
  Bug: "\u{1F41B}",
  Story: "\u{1F4D7}",
  Task: "✅",
  Personal: "\u{1F464}",
  "Sub-task": "\u{1F4CE}",
  Epic: "⚡",
};

const AVATAR_COLORS = [
  "#0052CC", "#00B8D9", "#6554C0", "#FF5630", "#FFAB00",
  "#36B37E", "#00875A", "#253858", "#6B778C", "#FF7452",
];

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
