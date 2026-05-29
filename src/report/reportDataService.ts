import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { WorkLogService, type DailyWorkLog } from "../sync/workLogService";
import type { ReportPeriod } from "../types";
import {
  formatYmd,
  getIsoWeekInfo,
  getPeriodRange,
  type DateRange,
} from "../utils/dateUtils";

const REPORT_PREFIX_MAP: Record<ReportPeriod, string> = {
  weekly: "Weekly-Report",
  monthly: "Monthly-Report",
};

interface ReportStats {
  totalDays: number;
  activeDays: number;
  totalEntries: number;
  completedEntries: number;
  taskKeys: Set<string>;
}

export class ReportDataService {
  private plugin: JiraFlowPlugin;
  private workLogService: WorkLogService;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
    this.workLogService = new WorkLogService(plugin);
  }

  /** Collect logs + stats for a date range. */
  async getTasksForPeriod(start: Date, end: Date): Promise<{ logs: DailyWorkLog[]; stats: ReportStats }> {
    const personalTaskKeys = this.collectPersonalTaskKeys();
    const logs = this.filterLogs(await this.workLogService.collectLogs(start, end), personalTaskKeys);
    const stats = this.buildStatsFromLogs(logs, start, end);
    return { logs, stats };
  }

  /** Build a pre-filled, human-editable markdown draft from real data (no AI). */
  async buildReportDraft(period: ReportPeriod, range: DateRange): Promise<string> {
    const normalized = getPeriodRange(period, range.start);
    const personalTaskKeys = this.collectPersonalTaskKeys();
    const logs = this.filterLogs(
      await this.workLogService.collectLogs(normalized.start, normalized.end),
      personalTaskKeys
    );
    const stats = this.buildStatsFromLogs(logs, normalized.start, normalized.end);

    const title = period === "weekly" ? "周报" : "月报";
    const label = `${formatYmd(normalized.start)} ~ ${formatYmd(normalized.end)}`;
    const parts: string[] = [];
    parts.push(`# ${title}`);
    parts.push(`\n**周期:** ${label}`);
    parts.push(
      `**统计:** 活跃 ${stats.activeDays}/${stats.totalDays} 天 · 条目 ${stats.totalEntries} · 完成 ${stats.completedEntries} · 涉及任务 ${stats.taskKeys.size}\n`
    );
    parts.push(`## 本期完成`);
    if (logs.length === 0) {
      parts.push(`> 暂无记录\n`);
    } else {
      for (const log of logs) {
        parts.push(`\n### ${log.date}`);
        for (const e of log.entries) {
          const key = e.taskKey ? `${e.taskKey}: ` : "";
          parts.push(`- [${e.completed ? "x" : " "}] ${key}${e.summary}`);
        }
      }
      parts.push("");
    }
    parts.push(`## 总结\n\n`);
    parts.push(`## 下期计划\n\n`);
    return parts.join("\n");
  }

  getReportFile(period: ReportPeriod, range: DateRange): TFile | null {
    const normalized = getPeriodRange(period, range.start);
    const canonicalPath = this.getReportPath(period, normalized);
    const canonicalFile = this.plugin.app.vault.getAbstractFileByPath(canonicalPath);
    return canonicalFile instanceof TFile ? canonicalFile : null;
  }

  listReportKeys(period: ReportPeriod): Set<string> {
    const prefix = REPORT_PREFIX_MAP[period];
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    const keys = new Set<string>();
    for (const file of this.plugin.app.vault.getFiles()) {
      if (!file.path.startsWith(folderPath) || !file.name.startsWith(prefix)) continue;
      const key = this.getReportKeyFromFileName(period, file.name);
      if (key) keys.add(key);
    }
    return keys;
  }

  /** Save (create or update) a report file, using atomic Vault.process for updates. */
  async saveReport(period: ReportPeriod, content: string, range: DateRange): Promise<TFile> {
    const vault = this.plugin.app.vault;
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }
    const normalized = getPeriodRange(period, range.start);
    const filePath = this.getReportPath(period, normalized);
    const existing = vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await vault.process(existing, () => content);
      return existing;
    }
    return await vault.create(filePath, content);
  }

  getReportKey(period: ReportPeriod, range: DateRange): string {
    const start = getPeriodRange(period, range.start).start;
    if (period === "weekly") {
      const info = getIsoWeekInfo(start);
      return `${info.year}-W${String(info.week).padStart(2, "0")}`;
    }
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  }

  private getReportPath(period: ReportPeriod, range: DateRange): string {
    const key = this.getReportKey(period, range);
    return normalizePath(`${this.plugin.settings.reportsFolder}/${REPORT_PREFIX_MAP[period]}-${key}.md`);
  }

  private getReportKeyFromFileName(period: ReportPeriod, fileName: string): string | null {
    if (period === "weekly") {
      const m = fileName.match(/^Weekly-Report-(\d{4})-W(\d{2})\.md$/);
      return m ? `${m[1]}-W${m[2]}` : null;
    }
    const m = fileName.match(/^Monthly-Report-(\d{4})-(\d{2})\.md$/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  private collectPersonalTaskKeys(): Set<string> {
    const keys = new Set<string>();
    for (const file of this.plugin.fileManager.getAllTaskFiles()) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(file);
      if (fm && this.isPersonalIssueType(fm.issuetype)) keys.add(fm.jira_key);
    }
    return keys;
  }

  private filterLogs(logs: DailyWorkLog[], personalTaskKeys: Set<string>): DailyWorkLog[] {
    return logs
      .map((log) => ({
        ...log,
        entries: log.entries.filter((e) => !e.taskKey || !personalTaskKeys.has(e.taskKey)),
      }))
      .filter((log) => log.entries.length > 0);
  }

  private buildStatsFromLogs(logs: DailyWorkLog[], start: Date, end: Date): ReportStats {
    const taskKeys = new Set<string>();
    let totalEntries = 0;
    let completedEntries = 0;
    for (const log of logs) {
      for (const e of log.entries) {
        totalEntries++;
        if (e.completed) completedEntries++;
        if (e.taskKey) taskKeys.add(e.taskKey);
      }
    }
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    return { totalDays, activeDays: logs.length, totalEntries, completedEntries, taskKeys };
  }

  private isPersonalIssueType(issueType: string): boolean {
    const n = (issueType || "").trim().toLowerCase();
    return n === "personal" || n === "个人任务" || n === "personal task";
  }
}
