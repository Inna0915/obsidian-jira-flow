import { describe, it, expect } from "vitest";
import { migrateSettings } from "./migrateSettings";

describe("migrateSettings", () => {
  it("preserves existing Jira connection info verbatim", () => {
    const saved = {
      jiraHost: "https://jira.x",
      jiraUsername: "u",
      jiraPassword: "p",
      projectKey: "ABC",
      jql: "assignee = currentUser()",
      tasksFolder: "X/Tasks",
      sprintField: "customfield_1",
    };
    const s = migrateSettings(saved);
    expect(s.jiraHost).toBe("https://jira.x");
    expect(s.jiraUsername).toBe("u");
    expect(s.jiraPassword).toBe("p");
    expect(s.projectKey).toBe("ABC");
    expect(s.tasksFolder).toBe("X/Tasks");
    expect(s.sprintField).toBe("customfield_1");
  });

  it("drops deprecated ai config (incl. apiKey)", () => {
    const saved = { jiraHost: "h", ai: { models: [{ apiKey: "secret" }], activeModelId: "x" } };
    const s = migrateSettings(saved) as unknown as Record<string, unknown>;
    expect(s.ai).toBeUndefined();
  });

  it("fills defaults for missing keys and null input", () => {
    expect(migrateSettings(null).jiraBrowseHost).toBeTruthy();
    expect(migrateSettings({}).tasksFolder).toBeTruthy();
  });
});
