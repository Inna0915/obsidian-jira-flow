import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { mapStatusToColumn } from "../types";
import type { JiraIssue, SyncResult, TaskFrontmatter } from "../types";
import { parseJiraSprintName, parseJiraSprintState } from "../utils/jiraParser";

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
    console.log(`[Jira Flow Debug] ===== Starting sync of ${issues.length} issues =====`);
    await this.ensureFolders();
    const result: SyncResult = { created: 0, updated: 0, errors: [] };

    for (const issue of issues) {
      console.log(`[Jira Flow Debug] ===== Processing issue: ${issue.key} =====`);
      console.log(`[Jira Flow Debug] ${issue.key} - Full issue data:`, JSON.stringify(issue, null, 2));
      try {
        const frontmatter = this.issueToFrontmatter(issue);
        // Use rendered HTML description if available, fallback to raw text
        const rawDescription = issue.renderedFields?.description 
          || issue.fields.description 
          || "";
        const description = await this.processDescription(
          rawDescription,
          issue.key
        );
        
        // Try to find existing file with new naming format first, then old format
        const summary = issue.fields.summary;
        const existing = this.findExistingTaskFile(issue.key, summary);

        if (existing) {
          await this.updateTaskFile(existing, frontmatter, description);
          result.updated++;
        } else {
          await this.createTaskFile(
            issue.key,
            summary,
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

    // Sprint info - read from configured sprint field and parse Jira Server format
    const sprintFieldName = this.plugin.settings.sprintField;
    const rawSprintData = f[sprintFieldName as keyof typeof f];
    
    // Use parser to handle Jira Server/Data Center's messy sprint format
    const sprintName = parseJiraSprintName(rawSprintData);
    const sprintState = parseJiraSprintState(rawSprintData);
    
    console.log(`[Jira Flow Debug] ${issue.key} - Sprint field: ${sprintFieldName}, Raw:`, JSON.stringify(rawSprintData, null, 2));
    console.log(`[Jira Flow Debug] ${issue.key} - Parsed sprint name: "${sprintName}", state: "${sprintState}"`);

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
    // Use new naming format: jira_key-summary.md
    const filePath = this.getTaskFilePath(key, summary);
    const yaml = this.frontmatterToYaml(frontmatter);
    // Simple format: frontmatter + description HTML
    const content = `---\n${yaml}---\n${description}`;
    return await this.vault.create(filePath, content);
  }

  private async updateTaskFile(
    file: TFile,
    frontmatter: TaskFrontmatter,
    description?: string
  ): Promise<void> {
    try {
      // STEP 1: Update Frontmatter safely using Obsidian API
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
        // Remove old description if it was in frontmatter
        delete (fm as { description?: unknown }).description;
      });

      // CRITICAL FIX: Wait 300ms for Windows and Obsidian to release the file lock
      await new Promise(resolve => setTimeout(resolve, 300));

      // STEP 2: Only after frontmatter is updated, update the body
      if (description !== undefined) {
        // Read the latest state with updated frontmatter
        const content = await this.vault.read(file);
        
        // Extract the frontmatter block safely
        const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
        const match = content.match(frontmatterRegex);
        const frontmatterString = match ? match[0] : '';
        
        // Reconstruct file: Frontmatter + Description
        // Completely replace body to avoid fragile regex matching
        const newContent = `${frontmatterString}${description}`;
        
        if (newContent !== content) {
          await this.vault.modify(file, newContent);
        }
      }
    } catch (error) {
      console.error(`[Jira Flow] EBUSY or Write Error on ${file.name}:`, error);
      throw error;
    }
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

  private getTaskFilePath(key: string, summary?: string): string {
    if (summary) {
      // New format: jira_key-summary.md
      const sanitizedSummary = this.sanitizeFilename(summary);
      return normalizePath(`${this.plugin.settings.tasksFolder}/${key}-${sanitizedSummary}.md`);
    }
    // Old format (fallback): jira_key.md
    return normalizePath(`${this.plugin.settings.tasksFolder}/${key}.md`);
  }

  private sanitizeFilename(summary: string): string {
    // Remove characters that are problematic in filenames
    // Keep: alphanumeric, spaces, hyphens, underscores
    // Replace: slashes, colons, etc. with hyphens
    return summary
      .replace(/[\/\\:?*"<>|]/g, '-')  // Replace invalid chars with hyphen
      .replace(/\s+/g, ' ')              // Collapse multiple spaces
      .trim();
  }

  private findExistingTaskFile(key: string, summary: string): TFile | null {
    // First try new naming format: key-summary.md
    const newPath = this.getTaskFilePath(key, summary);
    const newFile = this.vault.getAbstractFileByPath(newPath);
    if (newFile instanceof TFile) {
      return newFile;
    }

    // Fallback to old format: key.md
    const oldPath = this.getTaskFilePath(key);
    const oldFile = this.vault.getAbstractFileByPath(oldPath);
    if (oldFile instanceof TFile) {
      return oldFile;
    }

    // Last resort: scan all task files and match by jira_key frontmatter
    const allFiles = this.getAllTaskFiles();
    for (const file of allFiles) {
      const fm = this.getTaskFrontmatter(file);
      if (fm && fm.jira_key === key) {
        return file;
      }
    }

    return null;
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

  /**
   * Process description HTML: convert Jira Wiki images to HTML and download assets.
   * Public so it can be used by UI components to process API-fetched descriptions.
   */
  async processDescription(html: string, issueKey: string): Promise<string> {
    if (!html) return "";

    // Keep HTML clean for JiraHtmlRenderer - only process images to local assets
    let processedHtml = html;

    // NEW: Convert Jira Wiki Images (!image.png|width=100! or !http://...!) to HTML
    // This handles 3rd-party plugins like Xray/Raven that return raw Wiki syntax
    const wikiImageRegex = /!([^|!\n]+)(?:\|[^!\n]*)?!/g;
    processedHtml = processedHtml.replace(wikiImageRegex, (match, imageUrl) => {
      return `<img src="${imageUrl}" alt="Jira Wiki Image" />`;
    });

    // EXISTING: Now process all <img> tags (both native and the ones we just converted)
    const imgRegex = /<img[^>]+src="([^"]+)"([^>]*)>/gi;
    const imgMatches = Array.from(processedHtml.matchAll(imgRegex));
    
    for (const match of imgMatches) {
      const imgUrl = match[1];
      const restOfTag = match[2];
      try {
        // If it's an internal Jira image, download it
        if (imgUrl.startsWith('http') || imgUrl.startsWith('/')) {
          const localPath = await this.downloadAsset(imgUrl, issueKey);
          // Replace src with local path, keep all other attributes
          processedHtml = processedHtml.replace(
            match[0],
            `<img src="${localPath}"${restOfTag}>`
          );
        }
      } catch (e) {
        console.log(`[Jira Flow] Failed to download image ${imgUrl}, keeping original.`);
      }
    }

    return processedHtml;
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

  /**
   * Read the description from the file body (content after frontmatter).
   * For JIRA tasks, this is HTML content. For local tasks, this may be markdown.
   */
  async readDescription(file: TFile): Promise<string> {
    const content = await this.vault.read(file);
    // Remove frontmatter to get body content
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
    const body = content.replace(frontmatterRegex, "").trim();
    return body;
  }

  async archiveTask(file: TFile): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.archived = true;
      fm.archived_date = new Date().toISOString();
    });
  }
}
