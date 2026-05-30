export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const isoYear = target.getFullYear();
  const week1 = new Date(isoYear, 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { year: isoYear, week };
}

export function formatIsoWeek(date: Date): string {
  const info = getIsoWeekInfo(date);
  return `${info.year}-W${String(info.week).padStart(2, "0")}`;
}
