import { DEFAULT_SETTINGS, type JiraFlowSettings } from "../types";

/** Keys from older versions that must not be carried into current settings. */
const DEPRECATED_KEYS = ["ai"] as const;

/** Merge saved data.json onto defaults, preserving all known keys and dropping deprecated ones. */
export function migrateSettings(saved: unknown): JiraFlowSettings {
  const raw: Record<string, unknown> =
    saved && typeof saved === "object" ? { ...(saved as Record<string, unknown>) } : {};
  for (const key of DEPRECATED_KEYS) {
    delete raw[key];
  }
  const merged = Object.assign({}, DEFAULT_SETTINGS, raw) as JiraFlowSettings;
  if (!merged.jiraBrowseHost) {
    merged.jiraBrowseHost = DEFAULT_SETTINGS.jiraBrowseHost;
  }
  return merged;
}
