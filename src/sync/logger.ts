import { TFile, normalizePath, Notice } from "obsidian";
import type JiraFlowPlugin from "../main";

export interface WorkLogTaskInfo {
  jiraKey: string;
  summary: string;
}

export class WorkLogger {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  /**
   * Log a completed task to today's daily note under ### Work Log section.
   * Called when a kanban card is moved to DONE or CLOSED.
   *
   * @param taskFile - The task file that was moved
   * @param taskInfo - Optional pre-fetched task info to avoid metadata cache timing issues.
   *                   When called right after updateStatus(), the cache may be stale.
   */
  async logWork(taskFile: TFile, taskInfo?: WorkLogTaskInfo): Promise<void> {
    console.log(`[Jira Flow] logWork called for: ${taskFile.path}`);

    // Use passed-in data first (avoids metadata cache timing issue),
    // fall back to reading from cache
    let jiraKey = taskInfo?.jiraKey;
    let summary = taskInfo?.summary;

    if (!jiraKey || !summary) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(taskFile);
      if (fm) {
        jiraKey = jiraKey || fm.jira_key;
        summary = summary || fm.summary;
      }
    }

    if (!jiraKey) {
      console.warn("[Jira Flow] logWork: No jira_key found, skipping.", taskFile.path);
      return;
    }

    const dailyNote = await this.getOrCreateDailyNote();
    if (!dailyNote) {
      console.error("[Jira Flow] logWork: Failed to get or create daily note.");
      new Notice("Jira Flow：无法创建或找到今日日记文件");
      return;
    }

    console.log(`[Jira Flow] logWork: Daily note found at ${dailyNote.path}`);

    // Re-read content after potential Templater processing
    const content = await this.vault.read(dailyNote);
    const logEntry = `- [x] [[${taskFile.basename}]] - ${summary} (${jiraKey})`;
    const workLogHeader = "### Work Log";

    // Check for duplicate entry
    if (content.includes(logEntry)) {
      console.log("[Jira Flow] logWork: Entry already exists, skipping.");
      return;
    }

    if (content.includes(workLogHeader)) {
      // Find Work Log section boundaries
      const headerIndex = content.indexOf(workLogHeader);
      const afterSection = content.slice(headerIndex + workLogHeader.length);

      // Find end of Work Log section (next ##/### header or end of file)
      const nextHeaderMatch = afterSection.match(/\n#{1,3}\s/);
      const sectionEndOffset = nextHeaderMatch
        ? headerIndex + workLogHeader.length + nextHeaderMatch.index!
        : content.length;

      // Insert entry at end of Work Log section (chronological order)
      const before = content.slice(0, sectionEndOffset).trimEnd();
      const after = content.slice(sectionEndOffset);
      await this.vault.modify(dailyNote, before + "\n" + logEntry + "\n" + after);
    } else {
      // No Work Log section found - append at end of file
      const separator = content.endsWith("\n") ? "\n" : "\n\n";
      await this.vault.modify(
        dailyNote,
        content +
          separator +
          workLogHeader +
          "\n> ⚙️ jira-flow 自动写入区域，拖任务到 DONE 自动出现，请勿手动修改\n\n" +
          logEntry +
          "\n"
      );
    }

    console.log(`[Jira Flow] logWork: Successfully logged ${jiraKey} to ${dailyNote.path}`);
    new Notice(`📝 已记录到日记: ${jiraKey}`);
  }

  /**
   * Get today's daily note, or create it via Periodic Notes plugin (with template),
   * falling back to a built-in template if the plugin is unavailable.
   */
  private async getOrCreateDailyNote(): Promise<TFile | null> {
    const folder = this.plugin.settings.dailyNotesFolder;
    const today = this.formatDate(new Date());
    const filePath = normalizePath(`${folder}/${today}.md`);

    // 1. Check if daily note already exists
    const existing = this.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      return existing;
    }

    // 2. Try to create via Periodic Notes plugin (respects user's template + Templater)
    const created = await this.createDailyNoteViaPlugin(filePath);
    if (created) return created;

    // 3. Fallback: create manually with built-in template
    return await this.createDailyNoteFallback(folder, today, filePath);
  }

  /**
   * Create daily note using Periodic Notes plugin settings (template + folder config),
   * or core Daily Notes plugin. Does NOT open/navigate to the note.
   * Uses Templater API if available for template processing.
   */
  private async createDailyNoteViaPlugin(expectedPath: string): Promise<TFile | null> {
    const app = this.plugin.app;

    // Try Periodic Notes community plugin first
    const periodicNotes = (app as any).plugins?.plugins?.["periodic-notes"];
    if (periodicNotes) {
      console.log("[Jira Flow] Periodic Notes plugin detected.");
      try {
        // Read Periodic Notes' daily note settings
        const pnSettings = periodicNotes.settings?.daily || periodicNotes.settings;
        const templatePath = pnSettings?.template;
        
        if (templatePath) {
          console.log(`[Jira Flow] Periodic Notes template: ${templatePath}`);
          // Read template content
          const templateFile = this.vault.getAbstractFileByPath(
            normalizePath(templatePath.endsWith(".md") ? templatePath : templatePath + ".md")
          );
          
          if (templateFile instanceof TFile) {
            let templateContent = await this.vault.read(templateFile);
            
            // Create the file first with raw template content
            const folder = expectedPath.substring(0, expectedPath.lastIndexOf("/"));
            const folderPath = normalizePath(folder);
            if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
              await this.vault.createFolder(folderPath);
            }

            const newFile = await this.vault.create(expectedPath, templateContent);
            console.log(`[Jira Flow] Created daily note at ${expectedPath}`);
            
            // Try to trigger Templater to process the new file (if Templater is installed)
            const templater = (app as any).plugins?.plugins?.["templater-obsidian"];
            if (templater) {
              console.log("[Jira Flow] Templater detected, processing template...");
              try {
                // Use Templater's API to process the file
                const templaterPlugin = templater;
                if (templaterPlugin.templater?.overwrite_file_commands) {
                  await templaterPlugin.templater.overwrite_file_commands(newFile);
                } else if (templaterPlugin.templater?.append_template_to_active_file) {
                  // Alternative API path
                  await templaterPlugin.templater.overwrite_file_commands?.(newFile);
                }
                // Wait for Templater to finish
                await new Promise((r) => setTimeout(r, 1000));
                console.log("[Jira Flow] Templater processing complete.");
              } catch (templaterError) {
                console.log("[Jira Flow] Templater processing failed (non-fatal):", templaterError);
              }
            }
            
            return this.vault.getAbstractFileByPath(expectedPath) as TFile;
          } else {
            console.log(`[Jira Flow] Template file not found: ${templatePath}`);
          }
        }
      } catch (e) {
        console.log("[Jira Flow] Periodic Notes integration failed:", e);
      }
    }

    // Try core Daily Notes internal plugin
    const corePlugin = (app as any).internalPlugins?.plugins?.["daily-notes"];
    if (corePlugin?.enabled) {
      console.log("[Jira Flow] Core Daily Notes plugin detected.");
      try {
        const coreSettings = corePlugin.instance?.options || corePlugin.options;
        const templatePath = coreSettings?.template;
        if (templatePath) {
          const templateFile = this.vault.getAbstractFileByPath(
            normalizePath(templatePath.endsWith(".md") ? templatePath : templatePath + ".md")
          );
          if (templateFile instanceof TFile) {
            const templateContent = await this.vault.read(templateFile);
            const folder = expectedPath.substring(0, expectedPath.lastIndexOf("/"));
            const folderPath = normalizePath(folder);
            if (folderPath && !this.vault.getAbstractFileByPath(folderPath)) {
              await this.vault.createFolder(folderPath);
            }
            const newFile = await this.vault.create(expectedPath, templateContent);
            console.log(`[Jira Flow] Created daily note via core plugin template at ${expectedPath}`);
            return newFile;
          }
        }
      } catch (e) {
        console.log("[Jira Flow] Core Daily Notes integration failed:", e);
      }
    }

    console.log("[Jira Flow] No daily notes plugin template available, using fallback.");
    return null;
  }

  /**
   * Poll the vault for a file to appear (created by external plugin).
   * Includes extra delay for Templater to finish processing.
   */
  private async waitForFile(filePath: string, timeoutMs: number): Promise<TFile | null> {
    const interval = 100;
    const maxAttempts = Math.floor(timeoutMs / interval);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        // Wait extra for Templater to finish processing the template
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.vault.getAbstractFileByPath(filePath) as TFile;
      }
    }

    return null;
  }

  /**
   * Fallback: create a daily note manually with the standard template.
   * Used when no Daily Notes / Periodic Notes plugin is available.
   */
  private async createDailyNoteFallback(
    folder: string,
    today: string,
    filePath: string
  ): Promise<TFile> {
    // Ensure folder exists
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

    console.log("[Jira Flow] Created daily note via fallback template.");
    return await this.vault.create(filePath, content);
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
