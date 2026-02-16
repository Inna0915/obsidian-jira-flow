import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { mapStatusToColumn } from "../types";
import type { JiraIssue, SyncResult, TaskFrontmatter } from "../types";

export class FileManager {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  async ensureFolders(): Promise<void> {
    const folders = [
      this.plugin.settings.tasksFolder,
      this.plugin.settings.reportsFolder,
      this.plugin.settings.assetsFolder,
    ];
    for (const folder of folders) {
      const path = normalizePath(folder);
      if (!this.vault.getAbstractFileByPath(path)) {
        await this.vault.createFolder(path);
      }
    }
  }

  async syncIssues(issues: JiraIssue[]): Promise<SyncResult> {
    await this.ensureFolders();
    const result: SyncResult = { created: 0, updated: 0, errors: [] };

    for (const issue of issues) {
      try {
        const frontmatter = this.issueToFrontmatter(issue);
        const description = await this.processDescription(
          issue.fields.description || "",
          issue.key
        );
        const filePath = this.getTaskFilePath(issue.key);
        const existing = this.vault.getAbstractFileByPath(filePath);

        if (existing instanceof TFile) {
          await this.updateTaskFile(existing, frontmatter);
          result.updated++;
        } else {
          await this.createTaskFile(
            issue.key,
            issue.fields.summary,
            frontmatter,
            description
          );
          result.created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`${issue.key}: ${msg}`);
        console.error(`Jira Flow: Error syncing ${issue.key}:`, e);
      }
    }

    return result;
  }

  private issueToFrontmatter(issue: JiraIssue): TaskFrontmatter {
    const f = issue.fields;

    // Debug: log all custom fields for the first few issues to help identify story points field
    const customFields: Record<string, unknown> = {};
    for (const key of Object.keys(f)) {
      if (key.startsWith("customfield_")) {
        customFields[key] = f[key as keyof typeof f];
      }
    }
    console.log(`[Jira Flow] ${issue.key} custom fields:`, JSON.stringify(customFields, null, 2));

    const status = f.status.name;
    const mappedColumn = mapStatusToColumn(status);
    const type = f.issuetype.name.toLowerCase();

    const spField = this.plugin.settings.storyPointsField;
    const storyPoints =
      typeof f[spField as keyof typeof f] === "number"
        ? (f[spField as keyof typeof f] as number)
        : 0;

    // Due date: prefer configured custom field (Planned End Date), fallback to duedate
    const ddField = this.plugin.settings.dueDateField;
    const plannedEnd = f[ddField as keyof typeof f] as string | null;
    const dueDate = plannedEnd || f.duedate || "";

    // Sprint info
    const sprint = f.sprint;
    const sprintName = sprint?.name || "";
    const sprintState = sprint?.state || "";

    const tags = [
      `jira/status/${status.toLowerCase().replace(/\s+/g, "-")}`,
      `jira/type/${type.replace(/\s+/g, "-")}`,
      `jira/source/jira`,
    ];
    if (f.labels) {
      tags.push(...f.labels.map((l: string) => `jira/label/${l.toLowerCase()}`));
    }

    return {
      jira_key: issue.key,
      source: "JIRA",
      status,
      mapped_column: mappedColumn,
      issuetype: f.issuetype.name,
      priority: f.priority.name,
      story_points: storyPoints,
      due_date: dueDate,
      assignee: f.assignee?.displayName || "",
      sprint: sprintName,
      sprint_state: sprintState,
      tags,
      summary: f.summary,
      created: f.created,
      updated: f.updated,
    };
  }

  async createTaskFile(
    key: string,
    summary: string,
    frontmatter: TaskFrontmatter,
    description: string
  ): Promise<TFile> {
    await this.ensureFolders();
    const filePath = this.getTaskFilePath(key);
    const yaml = this.frontmatterToYaml(frontmatter);
    const content = `---\n${yaml}---\n\n# [${key}] ${summary}\n\n## Description\n${description}\n`;
    return await this.vault.create(filePath, content);
  }

  private async updateTaskFile(
    file: TFile,
    frontmatter: TaskFrontmatter
  ): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.jira_key = frontmatter.jira_key;
      fm.source = frontmatter.source;
      fm.status = frontmatter.status;
      fm.mapped_column = frontmatter.mapped_column;
      fm.issuetype = frontmatter.issuetype;
      fm.priority = frontmatter.priority;
      fm.story_points = frontmatter.story_points;
      fm.due_date = frontmatter.due_date;
      fm.assignee = frontmatter.assignee;
      fm.sprint = frontmatter.sprint;
      fm.sprint_state = frontmatter.sprint_state;
      fm.tags = frontmatter.tags;
      fm.summary = frontmatter.summary;
      fm.updated = frontmatter.updated;
    });
  }

  async updateStatus(file: TFile, newColumnId: string): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.mapped_column = newColumnId;
      fm.status = newColumnId;
      const oldStatusTag = fm.tags?.find((t: string) =>
        t.startsWith("jira/status/")
      );
      if (oldStatusTag && Array.isArray(fm.tags)) {
        const idx = fm.tags.indexOf(oldStatusTag);
        fm.tags[idx] = `jira/status/${newColumnId.toLowerCase().replace(/\s+/g, "-")}`;
      }
    });
  }

  private getTaskFilePath(key: string): string {
    return normalizePath(`${this.plugin.settings.tasksFolder}/${key}.md`);
  }

  private frontmatterToYaml(fm: TaskFrontmatter): string {
    const lines: string[] = [];
    lines.push(`jira_key: "${fm.jira_key}"`);
    lines.push(`source: "${fm.source}"`);
    lines.push(`status: "${fm.status}"`);
    lines.push(`mapped_column: "${fm.mapped_column}"`);
    lines.push(`issuetype: "${fm.issuetype}"`);
    lines.push(`priority: "${fm.priority}"`);
    lines.push(`story_points: ${fm.story_points}`);
    lines.push(`due_date: "${fm.due_date}"`);
    lines.push(`assignee: "${fm.assignee}"`);
    lines.push(`sprint: "${fm.sprint}"`);
    lines.push(`sprint_state: "${fm.sprint_state}"`);
    lines.push(`summary: "${fm.summary.replace(/"/g, '\\"')}"`);
    lines.push(`created: "${fm.created}"`);
    lines.push(`updated: "${fm.updated}"`);
    if (fm.archived) {
      lines.push(`archived: true`);
      lines.push(`archived_date: "${fm.archived_date || ""}"`);
    }
    lines.push("tags:");
    for (const tag of fm.tags) {
      lines.push(`  - ${tag}`);
    }
    return lines.join("\n") + "\n";
  }

  private async processDescription(
    html: string,
    issueKey: string
  ): Promise<string> {
    if (!html) return "";

    let md = html
      // Headers
      .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_m, level: string, text: string) => {
        return "#".repeat(parseInt(level)) + " " + text.trim();
      })
      // Bold
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      // Italic
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      // Code blocks
      .replace(/<pre>(.*?)<\/pre>/gis, "\n```\n$1\n```\n")
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      // Links
      .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      // Lists
      .replace(/<li>(.*?)<\/li>/gi, "- $1")
      .replace(/<\/?[uo]l[^>]*>/gi, "")
      // Line breaks
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<p>(.*?)<\/p>/gis, "$1\n\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, "")
      // Clean up whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Download images
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
    const imgMatches = html.matchAll(imgRegex);
    for (const match of imgMatches) {
      const imgUrl = match[1];
      const alt = match[2] || "image";
      try {
        const localPath = await this.downloadAsset(imgUrl, issueKey);
        md = md.replace(match[0], `![${alt}](${localPath})`);
      } catch {
        md += `\n![${alt}](${imgUrl})`;
      }
    }

    return md;
  }

  private async downloadAsset(
    url: string,
    issueKey: string
  ): Promise<string> {
    const filename = url.split("/").pop() || "image.png";
    const assetPath = normalizePath(
      `${this.plugin.settings.assetsFolder}/${issueKey}-${filename}`
    );

    if (!this.vault.getAbstractFileByPath(assetPath)) {
      const data = await this.plugin.jiraApi.downloadImage(url);
      await this.vault.createBinary(assetPath, data);
    }

    return assetPath;
  }

  getAllTaskFiles(): TFile[] {
    const folder = this.plugin.settings.tasksFolder;
    return this.vault.getFiles().filter(
      (f) => f.path.startsWith(folder) && f.extension === "md"
    );
  }

  getTaskFrontmatter(file: TFile): TaskFrontmatter | null {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter) return null;
    const fm = cache.frontmatter;
    const status = fm.status || "";
    return {
      jira_key: fm.jira_key || "",
      source: fm.source || "LOCAL",
      status,
      mapped_column: fm.mapped_column || mapStatusToColumn(status),
      issuetype: fm.issuetype || "Task",
      priority: fm.priority || "Medium",
      story_points: fm.story_points || 0,
      due_date: fm.due_date || "",
      assignee: fm.assignee || "",
      sprint: fm.sprint || "",
      sprint_state: fm.sprint_state || "",
      tags: fm.tags || [],
      summary: fm.summary || file.basename,
      created: fm.created || "",
      updated: fm.updated || "",
      archived: fm.archived || false,
      archived_date: fm.archived_date || "",
    };
  }

  async archiveTask(file: TFile): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.archived = true;
      fm.archived_date = new Date().toISOString();
    });
  }
}
