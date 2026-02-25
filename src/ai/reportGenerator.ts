import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { AIService } from "./aiService";
import { WorkLogService } from "../sync/workLogService";
import type { ReportPeriod } from "../types";

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
    options?: { start?: Date; end?: Date; modelId?: string }
  ): Promise<{ content: string; file: TFile }> {
    const modelId = options?.modelId || this.plugin.settings.ai.activeModelId;
    const activeModel = this.plugin.settings.ai.models.find(
      (m) => m.id === modelId && m.enabled
    );
    if (!activeModel) {
      throw new Error("No active AI model configured. Please set one in Settings > AI Models.");
    }

    const { start, end } = options?.start && options?.end
      ? { start: options.start, end: options.end }
      : this.getPeriodRange(period);

    const periodLabel = this.getPeriodLabel(start, end);

    // Gather data
    const logs = await this.workLogService.collectLogs(start, end);
    const taskSummaries = this.collectTaskSummaries();
    const stats = await this.workLogService.getStats(start, end);

    if (logs.length === 0 && taskSummaries.length === 0) {
      throw new Error(`No work logs or tasks found for ${periodLabel}.`);
    }

    const userContent = this.buildPromptContent(period, periodLabel, start, end, logs, taskSummaries, stats);
    const systemPrompt = this.getSystemPrompt(period);

    // Call AI
    const response = await this.aiService.chat(activeModel, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);

    // Save report with the period's end date (not current date)
    const file = await this.saveReport(period, response.content, end);
    return { content: response.content, file };
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
    const logs = await this.workLogService.collectLogs(start, end);
    const stats = await this.workLogService.getStats(start, end);
    return { logs, stats };
  }

  private getPeriodRange(period: ReportPeriod): { start: Date; end: Date } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);

    switch (period) {
      case "weekly": {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        return { start, end };
      }
      case "monthly": {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        return { start, end };
      }
      case "quarterly": {
        const start = new Date(today);
        start.setDate(start.getDate() - 89);
        return { start, end };
      }
      case "yearly": {
        const start = new Date(today);
        start.setFullYear(start.getFullYear() - 1);
        start.setDate(start.getDate() + 1);
        return { start, end };
      }
    }
  }

  private getSystemPrompt(period: ReportPeriod): string {
    const prompts = this.plugin.settings.ai.reportPrompts;
    return prompts[period] || this.plugin.settings.ai.reportPrompt;
  }

  private getPeriodLabel(start: Date, end: Date): string {
    return `${this.formatDate(start)} ~ ${this.formatDate(end)}`;
  }

  private collectTaskSummaries(): string[] {
    const files = this.plugin.fileManager.getAllTaskFiles();
    const summaries: string[] = [];

    for (const file of files) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) continue;
      // Only include local tasks and active sprint tasks
      const isLocal = fm.source === "LOCAL";
      const hasActiveSprint = fm.sprint_state?.toUpperCase() === "ACTIVE";
      if (!isLocal && !hasActiveSprint) continue;
      summaries.push(
        `- [${fm.mapped_column}] ${fm.jira_key}: ${fm.summary} (${fm.issuetype}, ${fm.priority})`
      );
    }

    return summaries;
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

    if (logs.length > 0) {
      parts.push(`## Work Logs\n`);
      for (const log of logs) {
        parts.push(`### ${log.date}`);
        for (const entry of log.entries) {
          const check = entry.completed ? "x" : " ";
          const key = entry.taskKey ? `${entry.taskKey}: ` : "";
          parts.push(`- [${check}] ${key}${entry.summary}`);
        }
        parts.push("");
      }
    }

    if (taskSummaries.length > 0) {
      parts.push(`## Current Tasks\n`);
      parts.push(taskSummaries.join("\n"));
      parts.push("");
    }

    return parts.join("\n");
  }

  private async saveReport(period: ReportPeriod, content: string, reportDate?: Date): Promise<TFile> {
    const vault = this.plugin.app.vault;
    const folder = this.plugin.settings.reportsFolder;

    const folderPath = normalizePath(folder);
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }

    // Use the report period's end date for the filename, not the current date
    const dateStr = this.formatDate(reportDate || new Date());
    const prefixMap: Record<ReportPeriod, string> = {
      weekly: "Weekly-Report",
      monthly: "Monthly-Report",
      quarterly: "Quarterly-Report",
      yearly: "Yearly-Report",
    };
    const filePath = normalizePath(`${folder}/${prefixMap[period]}-${dateStr}.md`);

    const existing = vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await vault.modify(existing, content);
      return existing;
    }

    return await vault.create(filePath, content);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
