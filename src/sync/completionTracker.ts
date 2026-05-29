import { TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import { computeCompletionMarks, DONE_TAG_PREFIX } from "../report/completionMarks";

export class CompletionTracker {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  /** Stamp completion metadata + done/YYYY-Www tag onto a task file. */
  async markCompleted(file: TFile, date: Date = new Date()): Promise<void> {
    const marks = computeCompletionMarks(date);
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.completed_at = marks.completed_at;
      fm.completed_week = marks.completed_week;
      const tags: string[] = Array.isArray(fm.tags) ? fm.tags : [];
      fm.tags = tags.filter((t) => !t.startsWith(DONE_TAG_PREFIX)).concat(marks.tag);
    });
  }

  /** Remove completion metadata + any done/* tag (card moved back to an active column). */
  async clearCompleted(file: TFile): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm.completed_at;
      delete fm.completed_week;
      if (Array.isArray(fm.tags)) {
        fm.tags = fm.tags.filter((t: string) => !t.startsWith(DONE_TAG_PREFIX));
      }
    });
  }
}
