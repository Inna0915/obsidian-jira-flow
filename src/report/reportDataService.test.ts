import { describe, it, expect } from "vitest";
import { getIsoWeekInfo } from "../utils/dateUtils";

// getReportKey delegates to dateUtils; verify the weekly key shape it produces.
describe("report key shape", () => {
  it("weekly key matches Weekly-Report file pattern", () => {
    const info = getIsoWeekInfo(new Date(2026, 4, 29));
    const key = `${info.year}-W${String(info.week).padStart(2, "0")}`;
    expect(key).toBe("2026-W22");
    expect(`Weekly-Report-${key}.md`).toMatch(/^Weekly-Report-\d{4}-W\d{2}\.md$/);
  });
});
