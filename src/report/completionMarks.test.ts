import { describe, it, expect } from "vitest";
import { computeCompletionMarks } from "./completionMarks";

describe("computeCompletionMarks", () => {
  it("derives date/week/tag from a date", () => {
    expect(computeCompletionMarks(new Date(2026, 4, 29))).toEqual({
      completed_at: "2026-05-29",
      completed_week: "2026-W22",
      tag: "done/2026-W22",
    });
  });
});
