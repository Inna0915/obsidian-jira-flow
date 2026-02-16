import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";

export class WorkLogger {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  async logWork(taskFile: TFile): Promise<void> {
    const fm = this.plugin.fileManager.getTaskFrontmatter(taskFile);
    if (!fm) return;

    const dailyNote = await this.getOrCreateDailyNote();
    if (!dailyNote) return;

    const content = await this.vault.read(dailyNote);
    const logEntry = `- [x] [[${taskFile.basename}]] - ${fm.summary} (${fm.jira_key})`;

    const workLogHeader = "### Work Log";

    if (content.includes(logEntry)) {
      // Already logged
      return;
    }

    if (content.includes(workLogHeader)) {
      // Append under existing header
      const headerIndex = content.indexOf(workLogHeader);
      const afterHeader = headerIndex + workLogHeader.length;
      // Find the next line after the header
      const nextLineIndex = content.indexOf("\n", afterHeader);
      if (nextLineIndex === -1) {
        // Header is at end of file
        await this.vault.modify(dailyNote, content + "\n" + logEntry);
      } else {
        // Insert after header line
        const before = content.slice(0, nextLineIndex + 1);
        const after = content.slice(nextLineIndex + 1);
        await this.vault.modify(dailyNote, before + logEntry + "\n" + after);
      }
    } else {
      // Add header and entry at end
      const separator = content.endsWith("\n") ? "\n" : "\n\n";
      await this.vault.modify(
        dailyNote,
        content + separator + workLogHeader + "\n" + logEntry + "\n"
      );
    }
  }

  private async getOrCreateDailyNote(): Promise<TFile | null> {
    const folder = this.plugin.settings.dailyNotesFolder;
    const today = this.formatDate(new Date());
    const filePath = normalizePath(`${folder}/${today}.md`);

    const existing = this.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      return existing;
    }

    // Ensure folder exists
    const folderPath = normalizePath(folder);
    if (!this.vault.getAbstractFileByPath(folderPath)) {
      await this.vault.createFolder(folderPath);
    }

    // Create daily note
    const content = `# ${today}\n\n`;
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
