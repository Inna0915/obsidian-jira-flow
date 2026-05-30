import { DEFAULT_SETTINGS, DEFAULT_WORKFLOWS, type JiraFlowSettings, type WorkflowProfile } from "../types";

/** Keys from older versions that must not be carried into current settings. */
const DEPRECATED_KEYS = ["ai"] as const;

function mergeProfile(saved: unknown, fallback: WorkflowProfile): WorkflowProfile {
  if (!saved || typeof saved !== "object") return structuredClone(fallback);
  const s = saved as Partial<WorkflowProfile>;
  return {
    transitions: s.transitions && typeof s.transitions === "object" ? s.transitions : structuredClone(fallback.transitions),
    globalTargets: Array.isArray(s.globalTargets) ? s.globalTargets : structuredClone(fallback.globalTargets),
  };
}

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
  const savedWorkflows = (raw.workflows ?? {}) as { bug?: unknown; default?: unknown };
  merged.workflows = {
    bug: mergeProfile(savedWorkflows.bug, DEFAULT_WORKFLOWS.bug),
    default: mergeProfile(savedWorkflows.default, DEFAULT_WORKFLOWS.default),
  };
  return merged;
}
