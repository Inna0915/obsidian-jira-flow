import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";

export interface WorkLogEntry {
  date: string;        // YYYY-MM-DD
  taskKey: string;     // e.g. PDSTDTTA-1234
  summary: string;
  completed: boolean;  // checkbox state
}

export interface DailyWorkLog {
  date: string;
  entries: WorkLogEntry[];
  rawContent: string;
}

export class WorkLogService {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  /**
   * Collect work logs for a date range from daily notes.
   */
  async collectLogs(startDate: Date, endDate: Date): Promise<DailyWorkLog[]> {
    const logs: DailyWorkLog[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dateStr = this.formatDate(current);
      const dailyLog = await this.readDailyLog(dateStr);
      if (dailyLog) {
        logs.push(dailyLog);
      }
      current.setDate(current.getDate() + 1);
    }

    return logs;
  }

  /**
   * Get a map of date → entry count for the heatmap.
   * Covers the last N days.
   */
  async getHeatmapData(days: number): Promise<Map<string, number>> {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);

    const logs = await this.collectLogs(start, end);
    const map = new Map<string, number>();

    for (const log of logs) {
      map.set(log.date, log.entries.length);
    }

    return map;
  }

  /**
   * Get task completion stats for a period.
   */
  async getStats(startDate: Date, endDate: Date): Promise<{
    totalDays: number;
    activeDays: number;
    totalEntries: number;
    completedEntries: number;
    taskKeys: Set<string>;
  }> {
    const logs = await this.collectLogs(startDate, endDate);
    const taskKeys = new Set<string>();
    let totalEntries = 0;
    let completedEntries = 0;

    for (const log of logs) {
      for (const entry of log.entries) {
        totalEntries++;
        if (entry.completed) completedEntries++;
        if (entry.taskKey) taskKeys.add(entry.taskKey);
      }
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return {
      totalDays,
      activeDays: logs.length,
      totalEntries,
      completedEntries,
      taskKeys,
    };
  }

  private async readDailyLog(dateStr: string): Promise<DailyWorkLog | null> {
    const folder = this.plugin.settings.dailyNotesFolder;
    const filePath = normalizePath(`${folder}/${dateStr}.md`);
    const file = this.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) return null;

    const content = await this.vault.read(file);
    const entries = this.parseWorkLogEntries(content, dateStr);

    if (entries.length === 0) return null;

    return { date: dateStr, entries, rawContent: content };
  }

  /**
   * Parse work log entries from daily note content.
   * Looks for `### Work Log` section and parses checkbox items.
   * Format: `- [x] [[TASK-KEY]] - Summary (JIRA-KEY)`
   * Also handles: `- [x] Summary` (no link)
   */
  private parseWorkLogEntries(content: string, date: string): WorkLogEntry[] {
    const entries: WorkLogEntry[] = [];

    // Find the Work Log section
    const headerMatch = content.match(/###\s*Work\s*Log/i);
    if (!headerMatch) return entries;

    const headerIndex = headerMatch.index!;
    const afterHeader = content.slice(headerIndex);

    // Get content until next header or end of file
    const nextHeaderMatch = afterHeader.slice(1).match(/^#{1,3}\s/m);
    const sectionContent = nextHeaderMatch
      ? afterHeader.slice(0, nextHeaderMatch.index! + 1)
      : afterHeader;

    // Parse each line
    const lines = sectionContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();

      // Match: - [x] or - [ ] followed by content
      const checkboxMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
      if (!checkboxMatch) continue;

      const completed = checkboxMatch[1].toLowerCase() === "x";
      const rest = checkboxMatch[2];

      // Try to extract task key from [[link]] or (JIRA-KEY) pattern
      let taskKey = "";
      let summary = rest;

      // Pattern: [[TASK-KEY]] - Summary (JIRA-KEY)
      const linkMatch = rest.match(/\[\[([^\]]+)\]\]\s*-\s*(.+?)(?:\s*\(([^)]+)\))?$/);
      if (linkMatch) {
        taskKey = linkMatch[3] || linkMatch[1]; // prefer (KEY) over [[link]]
        summary = linkMatch[2].trim();
      } else {
        // Pattern: JIRA-KEY: Summary or JIRA-KEY - Summary
        const keyMatch = rest.match(/^([A-Z][\w]+-\d+)\s*[:\-]\s*(.+)$/);
        if (keyMatch) {
          taskKey = keyMatch[1];
          summary = keyMatch[2].trim();
        }
      }

      entries.push({ date, taskKey, summary, completed });
    }

    return entries;
  }

  private formatDate(date: Date): string {
    const format = this.plugin.settings.dailyNoteFormat;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return format
      .replace("YYYY", String(year))
      .replace("MM", month)
      .replace("DD", day);
  }
}
