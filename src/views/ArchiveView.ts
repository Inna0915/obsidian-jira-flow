import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import type { TaskFrontmatter } from "../types";

export const ARCHIVE_VIEW_TYPE = "jira-flow-archive";

export class ArchiveView extends ItemView {
  plugin: JiraFlowPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: JiraFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return ARCHIVE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Jira Flow Archive";
  }

  getIcon(): string {
    return "archive";
  }

  async onOpen(): Promise<void> {
    this.render();
    // Re-render on vault changes
    this.registerEvent(this.app.vault.on("modify", () => this.render()));
    this.registerEvent(this.app.vault.on("create", () => this.render()));
    this.registerEvent(this.app.vault.on("delete", () => this.render()));
  }

  async onClose(): Promise<void> {
    // cleanup handled by Obsidian
  }

  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-archive-view" });
    wrapper.style.padding = "20px";
    wrapper.style.height = "100%";
    wrapper.style.overflow = "auto";

    // Header
    const header = wrapper.createDiv();
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "16px";

    const title = header.createEl("h2", { text: "Archived Tasks" });
    title.style.margin = "0";

    // Collect archived tasks
    const archivedTasks = this.getArchivedTasks();

    const countBadge = header.createSpan({ text: `${archivedTasks.length} tasks` });
    countBadge.style.fontSize = "13px";
    countBadge.style.color = "var(--text-muted)";
    countBadge.style.padding = "4px 10px";
    countBadge.style.borderRadius = "12px";
    countBadge.style.backgroundColor = "var(--background-secondary)";

    if (archivedTasks.length === 0) {
      const empty = wrapper.createDiv();
      empty.style.textAlign = "center";
      empty.style.padding = "60px 20px";
      empty.style.color = "var(--text-muted)";
      empty.style.fontSize = "14px";
      empty.setText("No archived tasks yet. Archive LOCAL tasks from the Kanban board.");
      return;
    }

    // Table
    const table = wrapper.createEl("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "13px";

    // Table header
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    const columns = ["Key", "Summary", "Type", "Priority", "Points", "Due Date", "Assignee", "Archived"];
    for (const col of columns) {
      const th = headerRow.createEl("th", { text: col });
      th.style.textAlign = "left";
      th.style.padding = "10px 12px";
      th.style.borderBottom = "2px solid var(--background-modifier-border)";
      th.style.fontSize = "11px";
      th.style.fontWeight = "600";
      th.style.textTransform = "uppercase";
      th.style.letterSpacing = "0.5px";
      th.style.color = "var(--text-muted)";
    }

    // Table body
    const tbody = table.createEl("tbody");
    for (const { fm, file } of archivedTasks) {
      const row = tbody.createEl("tr");
      row.style.cursor = "pointer";
      row.addEventListener("mouseenter", () => {
        row.style.backgroundColor = "var(--background-secondary)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.backgroundColor = "";
      });
      row.addEventListener("click", () => {
        const leaf = this.app.workspace.getLeaf("tab");
        leaf.openFile(file);
      });

      // Key
      const keyCell = row.createEl("td", { text: fm.jira_key });
      keyCell.style.padding = "8px 12px";
      keyCell.style.borderBottom = "1px solid var(--background-modifier-border)";
      keyCell.style.fontFamily = "var(--font-monospace)";
      keyCell.style.color = "#0052CC";
      keyCell.style.fontWeight = "500";

      // Summary
      const summaryCell = row.createEl("td", { text: fm.summary });
      summaryCell.style.padding = "8px 12px";
      summaryCell.style.borderBottom = "1px solid var(--background-modifier-border)";
      summaryCell.style.maxWidth = "300px";
      summaryCell.style.overflow = "hidden";
      summaryCell.style.textOverflow = "ellipsis";
      summaryCell.style.whiteSpace = "nowrap";

      // Type
      const typeCell = row.createEl("td", { text: fm.issuetype });
      typeCell.style.padding = "8px 12px";
      typeCell.style.borderBottom = "1px solid var(--background-modifier-border)";

      // Priority
      const priorityCell = row.createEl("td");
      priorityCell.style.padding = "8px 12px";
      priorityCell.style.borderBottom = "1px solid var(--background-modifier-border)";
      const pColors: Record<string, string> = {
        Highest: "#FF5630", High: "#FF7452", Medium: "#FFAB00", Low: "#36B37E", Lowest: "#00875A",
      };
      const dot = priorityCell.createSpan();
      dot.style.display = "inline-block";
      dot.style.width = "8px";
      dot.style.height = "8px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = pColors[fm.priority] || "#6B778C";
      dot.style.marginRight = "6px";
      priorityCell.createSpan({ text: fm.priority });

      // Story Points
      const spCell = row.createEl("td", { text: fm.story_points > 0 ? String(fm.story_points) : "-" });
      spCell.style.padding = "8px 12px";
      spCell.style.borderBottom = "1px solid var(--background-modifier-border)";
      spCell.style.textAlign = "center";

      // Due Date
      const dueDateCell = row.createEl("td", { text: fm.due_date ? fm.due_date.slice(0, 10) : "-" });
      dueDateCell.style.padding = "8px 12px";
      dueDateCell.style.borderBottom = "1px solid var(--background-modifier-border)";

      // Assignee
      const assigneeCell = row.createEl("td", { text: fm.assignee || "-" });
      assigneeCell.style.padding = "8px 12px";
      assigneeCell.style.borderBottom = "1px solid var(--background-modifier-border)";

      // Archived Date
      const archivedCell = row.createEl("td", { text: fm.archived_date ? fm.archived_date.slice(0, 10) : "-" });
      archivedCell.style.padding = "8px 12px";
      archivedCell.style.borderBottom = "1px solid var(--background-modifier-border)";
      archivedCell.style.color = "var(--text-muted)";
    }
  }

  private getArchivedTasks(): { fm: TaskFrontmatter; file: TFile }[] {
    const files = this.plugin.fileManager.getAllTaskFiles();
    const result: { fm: TaskFrontmatter; file: TFile }[] = [];

    for (const file of files) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(file);
      if (fm && fm.archived) {
        result.push({ fm, file });
      }
    }

    // Sort by archived_date descending (newest first)
    result.sort((a, b) => {
      const da = a.fm.archived_date || "";
      const db = b.fm.archived_date || "";
      return db.localeCompare(da);
    });

    return result;
  }
}
