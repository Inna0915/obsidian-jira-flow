import { describe, it, expect } from "vitest";
import { DEFAULT_WORKFLOWS, getAllowedTransitions, isTransitionAllowed } from "./types";

describe("workflow transitions", () => {
  it("default profile matches legacy Story rules (EXECUTION)", () => {
    const t = getAllowedTransitions("Story", "EXECUTION");
    expect(new Set(t)).toEqual(new Set(["TO DO", "EXECUTED", "CLOSED", "FUNNEL", "DEFINING", "READY"]));
  });

  it("bug profile matches legacy Bug rules (EXECUTION)", () => {
    const t = getAllowedTransitions("Bug", "EXECUTION");
    expect(new Set(t)).toEqual(new Set(["TO DO", "VALIDATING", "DONE", "CLOSED", "FUNNEL"]));
  });

  it("excludes self even if listed in globalTargets", () => {
    expect(getAllowedTransitions("Story", "FUNNEL")).not.toContain("FUNNEL");
  });

  it("custom workflows take effect", () => {
    const custom = {
      bug: DEFAULT_WORKFLOWS.bug,
      default: { transitions: { "TO DO": ["DONE"] }, globalTargets: ["CLOSED"] },
    };
    expect(new Set(getAllowedTransitions("Story", "TO DO", custom))).toEqual(new Set(["DONE", "CLOSED"]));
    expect(getAllowedTransitions("Story", "READY", custom)).toEqual(["CLOSED"]);
  });

  it("isTransitionAllowed respects workflows and self", () => {
    expect(isTransitionAllowed("Story", "EXECUTION", "EXECUTED")).toBe(true);
    expect(isTransitionAllowed("Story", "EXECUTION", "EXECUTION")).toBe(false);
  });
});
