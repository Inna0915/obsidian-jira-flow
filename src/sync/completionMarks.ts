import { formatYmd, formatIsoWeek } from "../utils/dateUtils";

export interface CompletionMarks {
  completed_at: string; // YYYY-MM-DD
  completed_week: string; // YYYY-Www
  tag: string; // done/YYYY-Www
}

export const DONE_TAG_PREFIX = "done/";

export function computeCompletionMarks(date: Date): CompletionMarks {
  const week = formatIsoWeek(date);
  return {
    completed_at: formatYmd(date),
    completed_week: week,
    tag: `${DONE_TAG_PREFIX}${week}`,
  };
}
