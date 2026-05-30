import { describe, it, expect } from "vitest";
import { getIsoWeekInfo, formatIsoWeek, formatYmd } from "./dateUtils";

describe("dateUtils", () => {
  it("formatYmd zero-pads", () => {
    expect(formatYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("getIsoWeekInfo: 2026-05-29 is W22", () => {
    expect(getIsoWeekInfo(new Date(2026, 4, 29))).toEqual({ year: 2026, week: 22 });
  });

  it("formatIsoWeek pads week", () => {
    expect(formatIsoWeek(new Date(2026, 4, 29))).toBe("2026-W22");
  });
});
