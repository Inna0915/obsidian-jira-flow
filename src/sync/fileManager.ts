import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { mapStatusToColumn } from "../types";
import type { JiraIssue, SyncResult, TaskFrontmatter } from "../types";
import { parseJiraSprintName, parseJiraSprintState } from "../utils/jiraParser";

export class FileManager {
  private plugin: JiraFlowPlugin;
  private readonly frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  private get vault() {
    return this.plugin.app.vault;
  }

  private normalizeFrontmatterText(value: unknown): string {
    const text = typeof value === "string" ? value : value == null ? "" : String(value);
    return text.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  }

  private escapeYamlString(value: unknown): string {
    return this.normalizeFrontmatterText(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
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
    console.log(`[Jira Flow] Starting sync of ${issues.length} issues`);
    await this.ensureFolders();
    const result: SyncResult = { created: 0, updated: 0, archived: 0, errors: [] };
    const seenIssueKeys = new Set<string>();
    const taskIndex = this.buildTaskFileIndex();

    for (const issue of issues) {
      try {
        seenIssueKeys.add(issue.key);
        const frontmatter = this.issueToFrontmatter(issue);
        const summary = issue.fields.summary;
        const existing = taskIndex.get(issue.key) ?? this.findExistingTaskFile(issue.key, summary);

        if (existing) {
          taskIndex.set(issue.key, existing);
          const existingFrontmatter = this.getTaskFrontmatter(existing);
          if (existingFrontmatter && this.canSkipSync(existingFrontmatter, frontmatter)) {
            continue;
          }
        }

        // Use rendered HTML description if available, fallback to raw text
        const rawDescription = issue.renderedFields?.description
          || issue.fields.description
          || "";
        const description = await this.processDescription(rawDescription, issue.key);

        if (existing) {
          await this.updateTaskFile(existing, frontmatter, description);
          result.updated++;
        } else {
          const created = await this.createTaskFile(issue.key, summary, frontmatter, description);
          taskIndex.set(issue.key, created);
          result.created++;
        }

        if ((result.created + result.updated) % 10 === 0) {
          await this.yieldToMainThread();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`${issue.key}: ${msg}`);
        console.error(`Jira Flow: Error syncing ${issue.key}:`, e);
      }
    }

    result.archived = await this.archiveMissingJiraIssues(seenIssueKeys);

    return result;
  }

  private issueToFrontmatter(issue: JiraIssue): TaskFrontmatter {
    const f = issue.fields;

    const status = this.normalizeFrontmatterText(f.status.name);
    const mappedColumn = mapStatusToColumn(status);
    const issueTypeName = this.normalizeFrontmatterText(f.issuetype.name);
    const type = issueTypeName.toLowerCase();

    const spField = this.plugin.settings.storyPointsField;
    const storyPoints =
      typeof f[spField as keyof typeof f] === "number"
        ? (f[spField as keyof typeof f] as number)
        : 0;

    // Due date: prefer configured custom field (Planned End Date), fallback to duedate
    const ddField = this.plugin.settings.dueDateField;
    const plannedEnd = f[ddField as keyof typeof f] as string | null;
    const dueDate = this.normalizeFrontmatterText(plannedEnd || f.duedate || "");

    // Sprint info - read from configured sprint field and parse Jira Server format
    const sprintFieldName = this.plugin.settings.sprintField;
    const rawSprintData = f[sprintFieldName as keyof typeof f];
    
    // Use parser to handle Jira Server/Data Center's messy sprint format
    const sprintName = this.normalizeFrontmatterText(parseJiraSprintName(rawSprintData));
    const sprintState = this.normalizeFrontmatterText(parseJiraSprintState(rawSprintData));

    const tags = [
      `jira/status/${status.toLowerCase().replace(/\s+/g, "-")}`,
      `jira/type/${type.replace(/\s+/g, "-")}`,
      `jira/source/jira`,
    ];
    const reporterName = this.normalizeFrontmatterText(f.reporter?.displayName || f.reporter?.name || f.reporter?.emailAddress || "");
    const reporterIdentity = [f.reporter?.name, f.reporter?.emailAddress, reporterName]
      .filter((item): item is string => !!item)
      .map((item) => item.toLowerCase());
    const assigneeName = this.normalizeFrontmatterText(f.assignee?.displayName || f.assignee?.name || f.assignee?.emailAddress || "");
    const assigneeIdentity = [f.assignee?.name, f.assignee?.emailAddress, assigneeName]
      .filter((item): item is string => !!item)
      .map((item) => item.toLowerCase());
    const currentUserIdentity = this.plugin.settings.jiraUsername.toLowerCase();
    const reporterOnly = reporterIdentity.includes(currentUserIdentity) && !assigneeIdentity.includes(currentUserIdentity);
    if (reporterOnly) {
      tags.push("jira/reporter/current-user");
    }
    if (f.labels) {
      tags.push(...f.labels.map((l: string) => `jira/label/${l.toLowerCase()}`));
    }

    const issueLinks = (f.issuelinks as Array<{
      type?: { name?: string; inward?: string; outward?: string };
      inwardIssue?: { key: string; fields?: { summary?: string } };
      outwardIssue?: { key: string; fields?: { summary?: string } };
    }> | undefined) || [];

    const parentLink = issueLinks.find((link) => {
      const outwardLabel = link.type?.outward?.toLowerCase() || "";
      const inwardLabel = link.type?.inward?.toLowerCase() || "";
      const typeName = link.type?.name?.toLowerCase() || "";

      return outwardLabel.includes("child of")
        || outwardLabel.includes("sub-task of")
        || inwardLabel.includes("parent of")
        || typeName.includes("parent")
        || typeName.includes("epic");
    });

    const parentIssue = parentLink?.outwardIssue
      || (parentLink?.type?.inward?.toLowerCase().includes("parent of") ? parentLink.inwardIssue : undefined);
    const parentKey = this.normalizeFrontmatterText(parentIssue?.key || "");
    const parentSummary = this.normalizeFrontmatterText(parentIssue?.fields?.summary || "");

    return {
      jira_key: this.normalizeFrontmatterText(issue.key),
      source: "JIRA",
      status,
      mapped_column: mappedColumn,
      issuetype: issueTypeName,
      priority: this.normalizeFrontmatterText(f.priority.name),
      story_points: storyPoints,
      due_date: dueDate,
      assignee: assigneeName,
      reporter: reporterName,
      reporter_only: reporterOnly,
      parent_key: parentKey,
      parent_summary: parentSummary,
      sprint: sprintName,
      sprint_state: sprintState,
      tags,
      summary: this.normalizeFrontmatterText(f.summary),
      created: this.normalizeFrontmatterText(f.created),
      updated: this.normalizeFrontmatterText(f.updated),
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
      const content = await this.vault.read(file);
      const currentBody = this.extractBody(content);
      const nextDescription = description ?? currentBody;
      const nextFrontmatter: TaskFrontmatter = {
        ...frontmatter,
        archived: false,
        archived_date: "",
      };
      const newContent = this.composeTaskContent(nextFrontmatter, nextDescription);

      if (newContent !== content) {
        await this.modifyFileWithRetry(file, newContent);
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

  /**
   * Find a task file by its jira_key. Supports both old (key.md) and new (key-summary.md) naming formats.
   * Public API for use by UI components (e.g. report hover preview).
   */
  findTaskFileByKey(key: string): TFile | null {
    // Try old format: key.md
    const oldPath = this.getTaskFilePath(key);
    const oldFile = this.vault.getAbstractFileByPath(oldPath);
    if (oldFile instanceof TFile) {
      return oldFile;
    }

    // Scan all task files and match by jira_key frontmatter
    const allFiles = this.getAllTaskFiles();
    for (const file of allFiles) {
      // Quick check: filename should start with the key
      if (!file.basename.startsWith(key)) continue;
      const fm = this.getTaskFrontmatter(file);
      if (fm && fm.jira_key === key) {
        return file;
      }
    }

    return null;
  }

  private frontmatterToYaml(fm: TaskFrontmatter): string {
    const lines: string[] = [];
    lines.push(`jira_key: "${this.escapeYamlString(fm.jira_key)}"`);
    lines.push(`source: "${this.escapeYamlString(fm.source)}"`);
    lines.push(`status: "${this.escapeYamlString(fm.status)}"`);
    lines.push(`mapped_column: "${this.escapeYamlString(fm.mapped_column)}"`);
    lines.push(`issuetype: "${this.escapeYamlString(fm.issuetype)}"`);
    lines.push(`priority: "${this.escapeYamlString(fm.priority)}"`);
    lines.push(`story_points: ${fm.story_points}`);
    lines.push(`due_date: "${this.escapeYamlString(fm.due_date)}"`);
    lines.push(`assignee: "${this.escapeYamlString(fm.assignee)}"`);
    lines.push(`reporter: "${this.escapeYamlString(fm.reporter || "")}"`);
    if (fm.reporter_only) {
      lines.push(`reporter_only: true`);
    }
    lines.push(`parent_key: "${this.escapeYamlString(fm.parent_key || "")}"`);
    lines.push(`parent_summary: "${this.escapeYamlString(fm.parent_summary || "")}"`);
    lines.push(`sprint: "${this.escapeYamlString(fm.sprint)}"`);
    lines.push(`sprint_state: "${this.escapeYamlString(fm.sprint_state)}"`);
    lines.push(`summary: "${this.escapeYamlString(fm.summary)}"`);
    lines.push(`created: "${this.escapeYamlString(fm.created)}"`);
    lines.push(`updated: "${this.escapeYamlString(fm.updated)}"`);
    if (fm.archived) {
      lines.push(`archived: true`);
      lines.push(`archived_date: "${this.escapeYamlString(fm.archived_date || "")}"`);
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
    const imgRegex = /<img[^>]+(?:src|data-image-src|data-src)=["']([^"']+)["']([^>]*)>/gi;
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
    const status = this.normalizeFrontmatterText(fm.status || "");
    return {
      jira_key: this.normalizeFrontmatterText(fm.jira_key || ""),
      source: fm.source || "LOCAL",
      status,
      mapped_column: this.normalizeFrontmatterText(fm.mapped_column || mapStatusToColumn(status)),
      issuetype: this.normalizeFrontmatterText(fm.issuetype || "Task"),
      priority: this.normalizeFrontmatterText(fm.priority || "Medium"),
      story_points: fm.story_points || 0,
      due_date: this.normalizeFrontmatterText(fm.due_date || ""),
      assignee: this.normalizeFrontmatterText(fm.assignee || ""),
      reporter: this.normalizeFrontmatterText(fm.reporter || ""),
      reporter_only: fm.reporter_only === true,
      parent_key: this.normalizeFrontmatterText(fm.parent_key || ""),
      parent_summary: this.normalizeFrontmatterText(fm.parent_summary || ""),
      sprint: this.normalizeFrontmatterText(fm.sprint || ""),
      sprint_state: this.normalizeFrontmatterText(fm.sprint_state || ""),
      tags: fm.tags || [],
      summary: this.normalizeFrontmatterText(fm.summary || file.basename),
      created: this.normalizeFrontmatterText(fm.created || ""),
      updated: this.normalizeFrontmatterText(fm.updated || ""),
      archived: fm.archived || false,
      archived_date: this.normalizeFrontmatterText(fm.archived_date || ""),
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

  private buildTaskFileIndex(): Map<string, TFile> {
    const index = new Map<string, TFile>();

    for (const file of this.getAllTaskFiles()) {
      const frontmatter = this.getTaskFrontmatter(file);
      if (frontmatter?.jira_key) {
        index.set(frontmatter.jira_key, file);
      }
    }

    return index;
  }

  private canSkipSync(existing: TaskFrontmatter, incoming: TaskFrontmatter): boolean {
    if (existing.archived || existing.updated !== incoming.updated) {
      return false;
    }

    return existing.status === incoming.status
      && existing.mapped_column === incoming.mapped_column
      && existing.priority === incoming.priority
      && existing.story_points === incoming.story_points
      && existing.due_date === incoming.due_date
      && existing.assignee === incoming.assignee
      && existing.reporter === incoming.reporter
      && existing.reporter_only === incoming.reporter_only
      && (existing.parent_key || "") === (incoming.parent_key || "")
      && (existing.parent_summary || "") === (incoming.parent_summary || "")
      && existing.sprint === incoming.sprint
      && existing.sprint_state === incoming.sprint_state
      && existing.summary === incoming.summary
      && existing.created === incoming.created
      && existing.updated === incoming.updated
      && JSON.stringify(existing.tags) === JSON.stringify(incoming.tags);
  }

  private composeTaskContent(frontmatter: TaskFrontmatter, description: string): string {
    const normalizedFrontmatter: TaskFrontmatter = {
      ...frontmatter,
      archived: frontmatter.archived || false,
      archived_date: frontmatter.archived ? (frontmatter.archived_date || "") : "",
    };
    const yaml = this.frontmatterToYaml(normalizedFrontmatter);
    return `---\n${yaml}---\n${description}`;
  }

  private extractBody(content: string): string {
    return content.replace(this.frontmatterRegex, "");
  }

  private async modifyFileWithRetry(file: TFile, content: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.vault.modify(file, content);
        return;
      } catch (error) {
        lastError = error;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 40 * (attempt + 1)));
      }
    }

    throw lastError;
  }

  private async archiveMissingJiraIssues(seenIssueKeys: Set<string>): Promise<number> {
    let archivedCount = 0;
    const now = new Date().toISOString();

    for (const file of this.getAllTaskFiles()) {
      const fm = this.getTaskFrontmatter(file);
      if (!fm || fm.source !== "JIRA" || fm.archived || !fm.jira_key) {
        continue;
      }

      if (seenIssueKeys.has(fm.jira_key)) {
        continue;
      }

      await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter.archived = true;
        frontmatter.archived_date = now;
      });
      archivedCount++;

      if (archivedCount % 10 === 0) {
        await this.yieldToMainThread();
      }
    }

    return archivedCount;
  }

  private async yieldToMainThread(): Promise<void> {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
}
