import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { AIService } from "./aiService";
import { WorkLogService } from "../sync/workLogService";
import type { DailyWorkLog } from "../sync/workLogService";
import type { ReportPeriod } from "../types";
import { isCompletedWorkflowColumn } from "../types";

const REPORT_PREFIX_MAP: Record<ReportPeriod, string> = {
  weekly: "Weekly-Report",
  monthly: "Monthly-Report",
  quarterly: "Quarterly-Report",
  yearly: "Yearly-Report",
};

type ReportRange = { start: Date; end: Date };
export type ReportGenerationProgress = {
  reasoningContent?: string;
  content?: string;
};

type ReportGenerationOptions = {
  start?: Date;
  end?: Date;
  modelId?: string;
  selectedTaskSummaries?: string[];
  preloadedLogs?: DailyWorkLog[];
  onProgress?: (progress: ReportGenerationProgress) => void;
};

export class ReportGenerator {
  private plugin: JiraFlowPlugin;
  private aiService: AIService;
  private workLogService: WorkLogService;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
    this.aiService = new AIService();
    this.workLogService = new WorkLogService(plugin);
  }

  /**
   * Generate a report for a given period.
   * Can optionally accept explicit start/end dates (for calendar-based generation).
   */
  async generateReport(
    period: ReportPeriod = "weekly",
    options?: ReportGenerationOptions
  ): Promise<{ content: string; reasoningContent?: string; file: TFile }> {
    const reportStartedAt = Date.now();
    const modelId = options?.modelId || this.plugin.settings.ai.activeModelId;
    const activeModel = this.plugin.settings.ai.models.find(
      (m) => m.id === modelId && m.enabled
    );
    if (!activeModel) {
      throw new Error("No active AI model configured. Please set one in Settings > AI Models.");
    }

    const { start, end } = options?.start && options?.end
      ? this.normalizeRange(period, { start: options.start, end: options.end })
      : this.getPeriodRange(period);

    const periodLabel = this.getPeriodLabel(start, end);

    const taskContextStartedAt = Date.now();
    const taskContext = this.collectTaskContext(options?.selectedTaskSummaries);
    const taskContextMs = Date.now() - taskContextStartedAt;

    const usingPreloadedLogs = !!options?.preloadedLogs;
    const logCollectionStartedAt = Date.now();
    const sourceLogs = options?.preloadedLogs ?? await this.workLogService.collectLogs(start, end);
    const logCollectionMs = Date.now() - logCollectionStartedAt;

    const rawLogDays = sourceLogs.length;
    const rawLogEntries = sourceLogs.reduce((count, log) => count + log.entries.length, 0);
    const logs = this.filterLogs(sourceLogs, taskContext.personalTaskKeys);
    const filteredLogDays = logs.length;
    const filteredLogEntries = logs.reduce((count, log) => count + log.entries.length, 0);
    const taskSummaries = options?.selectedTaskSummaries ?? taskContext.taskSummaries;

    const promptStartedAt = Date.now();
    const stats = this.buildStatsFromLogs(logs, start, end);

    if (logs.length === 0 && taskSummaries.length === 0) {
      throw new Error(`No work logs or tasks found for ${periodLabel}.`);
    }

    const userContent = this.buildPromptContent(period, periodLabel, start, end, logs, taskSummaries, stats);
    const systemPrompt = this.getSystemPrompt(period);
    const promptBuildMs = Date.now() - promptStartedAt;

    console.info("[Jira Flow] Report timing", {
      period,
      start: this.formatDate(start),
      end: this.formatDate(end),
      usingPreloadedLogs,
      taskFilesScanned: taskContext.scannedFiles,
      personalTaskKeys: taskContext.personalTaskKeys.size,
      taskContextMs,
      logCollectionMs,
      rawLogDays,
      rawLogEntries,
      filteredLogDays,
      filteredLogEntries,
      taskSummaries: taskSummaries.length,
      promptBuildMs,
      promptChars: userContent.length,
    });

    const aiMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userContent },
    ];

    // Call AI
    const response = options?.onProgress
      ? await this.aiService.chatStream(activeModel, aiMessages, {
          onReasoningUpdate: (reasoningContent) => options.onProgress?.({ reasoningContent }),
          onContentUpdate: (content) => options.onProgress?.({ content }),
        })
      : await this.aiService.chat(activeModel, aiMessages);

    // Save report with the period's end date (not current date)
    const saveStartedAt = Date.now();
    const file = await this.saveReport(period, response.content, { start, end });
    const saveReportMs = Date.now() - saveStartedAt;

    console.info("[Jira Flow] Report timing completed", {
      period,
      totalMs: Date.now() - reportStartedAt,
      saveReportMs,
      outputChars: response.content.length,
      filePath: file.path,
    });

    return { content: response.content, reasoningContent: response.reasoningContent, file };
  }

  // Keep backward compat
  async generateWeeklyReport(): Promise<TFile> {
    const result = await this.generateReport("weekly");
    return result.file;
  }

  /**
   * Collect tasks for a given date range (for the calendar task view).
   */
  async getTasksForPeriod(start: Date, end: Date): Promise<{
    logs: import("../sync/workLogService").DailyWorkLog[];
    stats: { totalDays: number; activeDays: number; totalEntries: number; completedEntries: number; taskKeys: Set<string> };
  }> {
    const { personalTaskKeys } = this.collectTaskContext();
    const logs = this.filterLogs(await this.workLogService.collectLogs(start, end), personalTaskKeys);
    const stats = this.buildStatsFromLogs(logs, start, end);
    return { logs, stats };
  }

  getPeriodRange(period: ReportPeriod, anchorDate: Date = new Date()): ReportRange {
    return this.normalizeRange(period, { start: anchorDate, end: anchorDate });
  }

  getReportFile(period: ReportPeriod, range: ReportRange): TFile | null {
    const normalized = this.normalizeRange(period, range);
    const expectedKey = this.getReportKey(period, normalized);
    const canonicalPath = this.getReportPath(period, normalized);
    const canonicalFile = this.plugin.app.vault.getAbstractFileByPath(canonicalPath);
    if (canonicalFile instanceof TFile) {
      return canonicalFile;
    }

    const prefix = REPORT_PREFIX_MAP[period];
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    const files = this.plugin.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(folderPath) && file.name.startsWith(prefix));

    for (const file of files) {
      const fileKey = this.getReportKeyFromFileName(period, file.name);
      if (fileKey === expectedKey) {
        return file;
      }
    }

    return null;
  }

  listReportKeys(period: ReportPeriod): Set<string> {
    const prefix = REPORT_PREFIX_MAP[period];
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    const keys = new Set<string>();

    for (const file of this.plugin.app.vault.getFiles()) {
      if (!file.path.startsWith(folderPath) || !file.name.startsWith(prefix)) {
        continue;
      }

      const key = this.getReportKeyFromFileName(period, file.name);
      if (key) {
        keys.add(key);
      }
    }

    return keys;
  }

  private getSystemPrompt(period: ReportPeriod): string {
    const prompts = this.plugin.settings.ai.reportPrompts;
    return prompts[period] || this.plugin.settings.ai.reportPrompt;
  }

  private getPeriodLabel(start: Date, end: Date): string {
    return `${this.formatDate(start)} ~ ${this.formatDate(end)}`;
  }

  private collectTaskContext(selectedTaskSummaries?: string[]): { personalTaskKeys: Set<string>; taskSummaries: string[]; scannedFiles: number } {
    const files = this.plugin.fileManager.getAllTaskFiles();
    const personalTaskKeys = new Set<string>();
    const summaries: string[] = [];
    const shouldCollectTaskSummaries = !selectedTaskSummaries;

    for (const file of files) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) continue;
      if (this.isPersonalIssueType(fm.issuetype)) {
        personalTaskKeys.add(fm.jira_key);
        continue;
      }
      if (!shouldCollectTaskSummaries) continue;
      // Only include local tasks and active sprint tasks
      const isLocal = fm.source === "LOCAL";
      const hasActiveSprint = fm.sprint_state?.toUpperCase() === "ACTIVE";
      if (!isLocal && !hasActiveSprint) continue;
      const completed = isCompletedWorkflowColumn(fm.issuetype, fm.mapped_column, fm.source);
      const tag = completed ? "COMPLETED" : "IN_PROGRESS";
      summaries.push(
        `- [${tag}] ${fm.jira_key}: ${fm.summary} (${fm.issuetype}, ${fm.priority})`
      );
    }

    return { personalTaskKeys, taskSummaries: selectedTaskSummaries ?? summaries, scannedFiles: files.length };
  }

  private filterLogs(
    logs: import("../sync/workLogService").DailyWorkLog[],
    personalTaskKeys: Set<string>
  ): import("../sync/workLogService").DailyWorkLog[] {
    return logs
      .map((log) => ({
        ...log,
        entries: log.entries.filter((entry) => !entry.taskKey || !personalTaskKeys.has(entry.taskKey)),
      }))
      .filter((log) => log.entries.length > 0);
  }

  private buildStatsFromLogs(
    logs: import("../sync/workLogService").DailyWorkLog[],
    start: Date,
    end: Date
  ): { totalDays: number; activeDays: number; totalEntries: number; completedEntries: number; taskKeys: Set<string> } {
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

    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return {
      totalDays,
      activeDays: logs.length,
      totalEntries,
      completedEntries,
      taskKeys,
    };
  }

  private isPersonalIssueType(issueType: string): boolean {
    const normalized = (issueType || "").trim().toLowerCase();
    return normalized === "personal" || normalized === "个人任务" || normalized === "personal task";
  }

  private buildPromptContent(
    period: ReportPeriod,
    periodLabel: string,
    start: Date,
    end: Date,
    logs: import("../sync/workLogService").DailyWorkLog[],
    taskSummaries: string[],
    stats: { totalDays: number; activeDays: number; totalEntries: number; completedEntries: number; taskKeys: Set<string> }
  ): string {
    const parts: string[] = [];

    parts.push(`# Report Period: ${periodLabel} (${period})`);
    parts.push(`**Start Date:** ${this.formatDate(start)}`);
    parts.push(`**End Date:** ${this.formatDate(end)}`);
    parts.push(`**IMPORTANT:** This report covers work from ${this.formatDate(start)} to ${this.formatDate(end)}. Do not use today's date.\n`);

    parts.push(`## Statistics`);
    parts.push(`- Active days: ${stats.activeDays} / ${stats.totalDays}`);
    parts.push(`- Total work entries: ${stats.totalEntries}`);
    parts.push(`- Completed entries: ${stats.completedEntries}`);
    parts.push(`- Unique tasks touched: ${stats.taskKeys.size}`);
    parts.push("");

    const logLines = this.buildLogSectionForPrompt(period, logs);
    if (logLines.length > 0) {
      parts.push(`## Work Logs\n`);
      parts.push(...logLines);
      parts.push("");
    }

    if (taskSummaries.length > 0) {
      const completedTasks = taskSummaries.filter((t) => t.startsWith("- [COMPLETED]"));
      const inProgressTasks = taskSummaries.filter((t) => t.startsWith("- [IN_PROGRESS]"));
      const otherTasks = taskSummaries.filter((t) => !t.startsWith("- [COMPLETED]") && !t.startsWith("- [IN_PROGRESS]"));

      if (completedTasks.length > 0) {
        parts.push(`## Completed Tasks\n`);
        parts.push(completedTasks.join("\n"));
        parts.push("");
      }
      if (inProgressTasks.length > 0) {
        parts.push(`## In Progress / Planned Tasks\n`);
        parts.push(inProgressTasks.join("\n"));
        parts.push("");
      }
      if (otherTasks.length > 0) {
        parts.push(`## Other Tasks\n`);
        parts.push(otherTasks.join("\n"));
        parts.push("");
      }
    }

    return parts.join("\n");
  }

  private buildLogSectionForPrompt(period: ReportPeriod, logs: DailyWorkLog[]): string[] {
    const totalEntries = logs.reduce((count, log) => count + log.entries.length, 0);

    if (period === "weekly" && totalEntries <= 40) {
      const lines: string[] = [];
      for (const log of logs) {
        lines.push(`### ${log.date}`);
        for (const entry of log.entries) {
          const check = entry.completed ? "x" : " ";
          const key = entry.taskKey ? `${entry.taskKey}: ` : "";
          lines.push(`- [${check}] ${key}${entry.summary}`);
        }
        lines.push("");
      }
      return lines;
    }

    const groupedEntries = new Map<string, {
      label: string;
      completed: number;
      total: number;
      dates: Set<string>;
    }>();

    for (const log of logs) {
      for (const entry of log.entries) {
        const identity = entry.taskKey?.trim() ? entry.taskKey.trim() : `summary:${entry.summary.trim()}`;
        const label = entry.taskKey ? `${entry.taskKey}: ${entry.summary}` : entry.summary;
        const existing = groupedEntries.get(identity) ?? {
          label,
          completed: 0,
          total: 0,
          dates: new Set<string>(),
        };

        existing.total += 1;
        if (entry.completed) {
          existing.completed += 1;
        }
        existing.dates.add(log.date);
        groupedEntries.set(identity, existing);
      }
    }

    return Array.from(groupedEntries.values())
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
      .map((item) => {
        const dates = Array.from(item.dates).sort();
        const dateLabel = dates.length <= 3 ? dates.join(", ") : `${dates[0]} ~ ${dates[dates.length - 1]}`;
        return `- ${item.label} (${item.total} 条记录, 完成 ${item.completed}/${item.total}, 日期 ${dateLabel})`;
      });
  }

  private async saveReport(period: ReportPeriod, content: string, range: ReportRange): Promise<TFile> {
    const vault = this.plugin.app.vault;
    const folder = this.plugin.settings.reportsFolder;

    const folderPath = normalizePath(folder);
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }

    const normalized = this.normalizeRange(period, range);
    const filePath = this.getReportPath(period, normalized);

    const existing = vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await vault.modify(existing, content);
      return existing;
    }

    const legacyFile = this.getReportFile(period, normalized);
    if (legacyFile instanceof TFile) {
      if (legacyFile.path !== filePath) {
        await vault.rename(legacyFile, filePath);
      }

      const renamed = vault.getAbstractFileByPath(filePath);
      if (renamed instanceof TFile) {
        await vault.modify(renamed, content);
        return renamed;
      }
    }

    return await vault.create(filePath, content);
  }

  private normalizeRange(period: ReportPeriod, range: ReportRange): ReportRange {
    const anchor = new Date(range.start);
    anchor.setHours(0, 0, 0, 0);

    switch (period) {
      case "weekly": {
        const start = new Date(anchor);
        const day = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      case "monthly": {
        const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "quarterly": {
        const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3;
        const start = new Date(anchor.getFullYear(), quarterStartMonth, 1);
        const end = new Date(anchor.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "yearly": {
        const start = new Date(anchor.getFullYear(), 0, 1);
        const end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start, end };
      }
    }
  }

  private getReportPath(period: ReportPeriod, range: ReportRange): string {
    const key = this.getReportKey(period, range);
    return normalizePath(`${this.plugin.settings.reportsFolder}/${REPORT_PREFIX_MAP[period]}-${key}.md`);
  }

  private getReportKey(period: ReportPeriod, range: ReportRange): string {
    const start = range.start;

    switch (period) {
      case "weekly": {
        const info = this.getIsoWeekInfo(start);
        return `${info.year}-W${String(info.week).padStart(2, "0")}`;
      }
      case "monthly":
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      case "quarterly":
        return `${start.getFullYear()}-Q${Math.floor(start.getMonth() / 3) + 1}`;
      case "yearly":
        return `${start.getFullYear()}`;
    }
  }

  private getReportKeyFromFileName(period: ReportPeriod, fileName: string): string | null {
    switch (period) {
      case "weekly": {
        const weekMatch = fileName.match(/^Weekly-Report-(\d{4})-W(\d{2})\.md$/);
        if (weekMatch) {
          return `${weekMatch[1]}-W${weekMatch[2]}`;
        }
        break;
      }
      case "monthly": {
        const monthMatch = fileName.match(/^Monthly-Report-(\d{4})-(\d{2})\.md$/);
        if (monthMatch) {
          return `${monthMatch[1]}-${monthMatch[2]}`;
        }
        break;
      }
      case "quarterly": {
        const quarterMatch = fileName.match(/^Quarterly-Report-(\d{4})-Q([1-4])\.md$/);
        if (quarterMatch) {
          return `${quarterMatch[1]}-Q${quarterMatch[2]}`;
        }
        break;
      }
      case "yearly": {
        const yearMatch = fileName.match(/^Yearly-Report-(\d{4})\.md$/);
        if (yearMatch) {
          return yearMatch[1];
        }
        break;
      }
    }

    const legacyDateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!legacyDateMatch) {
      return null;
    }

    const legacyDate = new Date(Number(legacyDateMatch[1]), Number(legacyDateMatch[2]) - 1, Number(legacyDateMatch[3]));
    return this.getReportKey(period, this.getPeriodRange(period, legacyDate));
  }

  private getIsoWeekInfo(date: Date): { year: number; week: number } {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));

    const isoYear = target.getFullYear();
    const week1 = new Date(isoYear, 0, 4);
    const week = 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return { year: isoYear, week };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
