import { describe, it, expect } from "vitest";
import { getIsoWeekInfo, formatIsoWeek, formatYmd, getPeriodRange } from "./dateUtils";

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

  it("weekly range is Mon..Sun covering the anchor", () => {
    const { start, end } = getPeriodRange("weekly", new Date(2026, 4, 29)); // Fri
    expect(formatYmd(start)).toBe("2026-05-25"); // Monday
    expect(formatYmd(end)).toBe("2026-05-31"); // Sunday
  });

  it("monthly range covers the whole month", () => {
    const { start, end } = getPeriodRange("monthly", new Date(2026, 4, 29));
    expect(formatYmd(start)).toBe("2026-05-01");
    expect(formatYmd(end)).toBe("2026-05-31");
  });
});
