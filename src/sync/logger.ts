import { TFile, normalizePath, Notice } from "obsidian";
import type JiraFlowPlugin from "../main";

export interface WorkLogTaskInfo {
  jiraKey: string;
  summary: string;
}

interface PeriodicNotesPlugin {
  settings?: { daily?: { template?: string }; template?: string };
}
interface TemplaterPlugin {
  templater?: { overwrite_file_commands?: (file: TFile) => Promise<void> };
}
interface DailyNotesCorePlugin {
  enabled?: boolean;
  instance?: { options?: { template?: string } };
  options?: { template?: string };
}
interface PluginHost {
  plugins?: { plugins?: Record<string, unknown> };
  internalPlugins?: { plugins?: Record<string, unknown> };
}

export class WorkLogger {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  private get host(): PluginHost {
    return this.plugin.app as unknown as PluginHost;
  }

  /**
   * Log a completed task to today's daily note under ### Work Log section.
   * Called when a kanban card is moved to a completed column.
   *
   * @param taskFile - The task file that was moved
   * @param taskInfo - Optional pre-fetched task info to avoid metadata cache timing issues.
   */
  async logWork(taskFile: TFile, taskInfo?: WorkLogTaskInfo): Promise<void> {
    let jiraKey = taskInfo?.jiraKey;
    let summary = taskInfo?.summary;

    if (!jiraKey || !summary) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(taskFile);
      if (fm) {
        jiraKey = jiraKey || fm.jira_key;
        summary = summary || fm.summary;
      }
    }

    if (!jiraKey) return;

    const dailyNote = await this.getOrCreateDailyNote();
    if (!dailyNote) {
      new Notice("Jira Flow：无法创建或找到今日日记文件");
      return;
    }

    const logEntry = `- [x] [[${taskFile.basename}]] - ${summary} (${jiraKey})`;
    const workLogHeader = "### Work Log";
    let added = false;

    await this.vault.process(dailyNote, (content) => {
      if (content.includes(logEntry)) return content;
      added = true;

      if (content.includes(workLogHeader)) {
        const headerIndex = content.indexOf(workLogHeader);
        const afterSection = content.slice(headerIndex + workLogHeader.length);
        const nextHeaderMatch = afterSection.match(/\n#{1,3}\s/);
        const sectionEndOffset = nextHeaderMatch
          ? headerIndex + workLogHeader.length + nextHeaderMatch.index!
          : content.length;
        const before = content.slice(0, sectionEndOffset).trimEnd();
        const after = content.slice(sectionEndOffset);
        return before + "\n" + logEntry + "\n" + after;
      }

      const separator = content.endsWith("\n") ? "\n" : "\n\n";
      return (
        content +
        separator +
        workLogHeader +
        "\n> ⚙️ jira-flow 自动写入区域，拖任务到 DONE 自动出现，请勿手动修改\n\n" +
        logEntry +
        "\n"
      );
    });

    if (added) {
      new Notice(`📝 已记录到日记: ${jiraKey}`);
    }
  }

  /**
   * Get today's daily note, or create it via Periodic Notes / core Daily Notes (with template),
   * falling back to a built-in template if neither is available.
   */
  private async getOrCreateDailyNote(): Promise<TFile | null> {
    const folder = this.plugin.settings.dailyNotesFolder;
    const today = this.formatDate(new Date());
    const filePath = normalizePath(`${folder}/${today}.md`);

    const existing = this.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      return existing;
    }

    const created = await this.createDailyNoteViaPlugin(filePath);
    if (created) return created;

    return await this.createDailyNoteFallback(folder, today, filePath);
  }

  /**
   * Create daily note using Periodic Notes / core Daily Notes template (+ Templater if present).
   */
  private async createDailyNoteViaPlugin(expectedPath: string): Promise<TFile | null> {
    // Periodic Notes community plugin
    const periodicNotes = this.host.plugins?.plugins?.["periodic-notes"] as PeriodicNotesPlugin | undefined;
    if (periodicNotes) {
      const pnSettings = periodicNotes.settings?.daily || periodicNotes.settings;
      const templatePath = pnSettings?.template;
      if (templatePath) {
        const templateFile = this.vault.getAbstractFileByPath(
          normalizePath(templatePath.endsWith(".md") ? templatePath : templatePath + ".md")
        );
        if (templateFile instanceof TFile) {
          const templateContent = await this.vault.read(templateFile);
          await this.ensureFolderFor(expectedPath);
          const newFile = await this.vault.create(expectedPath, templateContent);

          const templater = this.host.plugins?.plugins?.["templater-obsidian"] as TemplaterPlugin | undefined;
          if (templater?.templater?.overwrite_file_commands) {
            try {
              await templater.templater.overwrite_file_commands(newFile);
              await new Promise((r) => window.setTimeout(r, 1000));
            } catch {
              // Templater processing is best-effort; ignore failures.
            }
          }
          const result = this.vault.getAbstractFileByPath(expectedPath);
          return result instanceof TFile ? result : newFile;
        }
      }
    }

    // Core Daily Notes internal plugin
    const corePlugin = this.host.internalPlugins?.plugins?.["daily-notes"] as DailyNotesCorePlugin | undefined;
    if (corePlugin?.enabled) {
      const coreSettings = corePlugin.instance?.options || corePlugin.options;
      const templatePath = coreSettings?.template;
      if (templatePath) {
        const templateFile = this.vault.getAbstractFileByPath(
          normalizePath(templatePath.endsWith(".md") ? templatePath : templatePath + ".md")
        );
        if (templateFile instanceof TFile) {
          const templateContent = await this.vault.read(templateFile);
          await this.ensureFolderFor(expectedPath);
          return await this.vault.create(expectedPath, templateContent);
        }
      }
    }

    return null;
  }

  private async ensureFolderFor(filePath: string): Promise<void> {
    const folder = filePath.substring(0, filePath.lastIndexOf("/"));
    const folderPath = normalizePath(folder);
    if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
      await this.vault.createFolder(folderPath);
    }
  }

  /**
   * Fallback: create a daily note manually with the standard template.
   */
  private async createDailyNoteFallback(folder: string, today: string, filePath: string): Promise<TFile> {
    const folderPath = normalizePath(folder);
    if (!this.vault.getAbstractFileByPath(folderPath)) {
      await this.vault.createFolder(folderPath);
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = dayNames[new Date().getDay()];

    const content = [
      "---",
      "tags:",
      "  - daily",
      "type: daily",
      `created: ${today}`,
      "---",
      "",
      `# ${today} ${dayOfWeek}`,
      "",
      "## 📌 Today Focus",
      "> 今天最重要的 1-3 件事（可选，不写也不碍事）",
      "",
      "- ",
      "",
      "## 📝 Notes",
      "> 踩坑记录、技术决策、会议要点、临时想法 — 随手记，不强制",
      "",
      "",
      "",
      "### Work Log",
      "> ⚙️ jira-flow 自动写入区域，拖任务到 DONE 自动出现，请勿手动修改",
      "",
    ].join("\n");

    return await this.vault.create(filePath, content);
  }

  private formatDate(date: Date): string {
    const format = this.plugin.settings.dailyNoteFormat;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return format.replace("YYYY", String(year)).replace("MM", month).replace("DD", day);
  }
}
