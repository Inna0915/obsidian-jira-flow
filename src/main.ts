import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type JiraFlowSettings } from "./types";
import { JiraFlowSettingTab } from "./settings";
import { JiraApi } from "./api/jira";
import { FileManager as JFFileManager } from "./sync/fileManager";
import { WorkLogger } from "./sync/logger";
import { ReportGenerator } from "./ai/reportGenerator";
import { KANBAN_VIEW_TYPE, KanbanView } from "./views/KanbanView";
import { ARCHIVE_VIEW_TYPE, ArchiveView } from "./views/ArchiveView";
import { StatusToast } from "./ui/StatusToast";

export default class JiraFlowPlugin extends Plugin {
  settings: JiraFlowSettings = DEFAULT_SETTINGS;
  jiraApi!: JiraApi;
  fileManager!: JFFileManager;
  workLogger!: WorkLogger;
  reportGenerator!: ReportGenerator;
  private syncIntervalId: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.jiraApi = new JiraApi(this);
    this.fileManager = new JFFileManager(this);
    this.workLogger = new WorkLogger(this);
    this.reportGenerator = new ReportGenerator(this);

    this.addRibbonIcon("kanban", "Open Jira Flow Kanban", () => {
      this.activateKanbanView();
    });

    this.addSettingTab(new JiraFlowSettingTab(this.app, this));

    this.registerView(KANBAN_VIEW_TYPE, (leaf) => new KanbanView(leaf, this));
    this.registerView(ARCHIVE_VIEW_TYPE, (leaf) => new ArchiveView(leaf, this));

    this.addCommand({
      id: "open-kanban",
      name: "Open Kanban Board",
      callback: () => this.activateKanbanView(),
    });

    this.addCommand({
      id: "sync-jira",
      name: "Sync Now",
      callback: () => this.syncJira(),
    });

    this.addCommand({
      id: "create-local-task",
      name: "Create Local Task",
      callback: () => this.createLocalTask(),
    });

    this.addCommand({
      id: "generate-weekly-report",
      name: "Generate Weekly Report",
      callback: () => this.generateReport("weekly"),
    });

    this.addCommand({
      id: "generate-monthly-report",
      name: "Generate Monthly Report",
      callback: () => this.generateReport("monthly"),
    });

    this.addCommand({
      id: "generate-quarterly-report",
      name: "Generate Quarterly Report",
      callback: () => this.generateReport("quarterly"),
    });

    this.addCommand({
      id: "generate-yearly-report",
      name: "Generate Yearly Report",
      callback: () => this.generateReport("yearly"),
    });

    this.addCommand({
      id: "open-archive",
      name: "Open Archive View",
      callback: () => this.activateArchiveView(),
    });

    if (this.settings.autoSyncOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        this.syncJira();
      });
    }

    this.setupSyncInterval();
  }

  onunload(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
    }
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // Deep merge ai settings so existing users get defaults
    this.settings.ai = Object.assign({}, DEFAULT_SETTINGS.ai, saved?.ai);
    if (!this.settings.ai.models || this.settings.ai.models.length === 0) {
      this.settings.ai.models = [...DEFAULT_SETTINGS.ai.models];
    }
    // Deep merge reportPrompts
    this.settings.ai.reportPrompts = Object.assign(
      {},
      DEFAULT_SETTINGS.ai.reportPrompts,
      saved?.ai?.reportPrompts
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.setupSyncInterval();
  }

  private setupSyncInterval(): void {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.settings.syncIntervalMinutes > 0) {
      this.syncIntervalId = window.setInterval(
        () => this.syncJira(),
        this.settings.syncIntervalMinutes * 60 * 1000
      );
      this.registerInterval(this.syncIntervalId);
    }
  }

  async activateKanbanView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: KANBAN_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async activateArchiveView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(ARCHIVE_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: ARCHIVE_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async syncJira(): Promise<void> {
    if (!this.settings.jiraHost || !this.settings.jiraUsername || !this.settings.jiraPassword) {
      new Notice("Jira Flow: Please configure Jira connection in settings.");
      return;
    }

    const toast = new StatusToast(document, "Jira Sync");

    const stepConnect = toast.addStep("Connecting to Jira...");
    try {
      await this.jiraApi.testConnection();
      toast.updateStep(stepConnect, "success", this.settings.jiraHost);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepConnect, "error", msg);
      toast.finish(false);
      return;
    }

    const stepFetch = toast.addStep("Fetching issues...");
    let issues: import("./types").JiraIssue[];
    try {
      if (this.settings.projectKey) {
        // Agile 4-step sync
        const result = await this.jiraApi.fetchIssuesAgile(this.settings.projectKey);
        issues = result.issues;
        const sprintInfo = result.sprint ? ` (Sprint: ${result.sprint.name})` : " (no active sprint)";
        toast.updateStep(stepFetch, "success", `${issues.length} issues found${sprintInfo}`);
      } else {
        // JQL fallback
        issues = await this.jiraApi.fetchIssues();
        toast.updateStep(stepFetch, "success", `${issues.length} issues found`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepFetch, "error", msg);
      toast.finish(false);
      return;
    }

    const stepSync = toast.addStep("Syncing to local files...");
    try {
      const result = await this.fileManager.syncIssues(issues);
      const detail = `Created: ${result.created}, Updated: ${result.updated}` +
        (result.errors.length > 0 ? `, Errors: ${result.errors.length}` : "");
      toast.updateStep(stepSync, result.errors.length > 0 ? "error" : "success", detail);
      toast.finish(result.errors.length === 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepSync, "error", msg);
      toast.finish(false);
    }
  }

  async testConnection(): Promise<void> {
    const toast = new StatusToast(document, "Test Connection");

    const stepValidate = toast.addStep("Validating settings...");
    const { jiraHost, jiraUsername, jiraPassword } = this.settings;
    if (!jiraHost || !jiraUsername || !jiraPassword) {
      toast.updateStep(stepValidate, "error", "Host, Username, and Password are required");
      toast.finish(false);
      return;
    }
    toast.updateStep(stepValidate, "success", "Settings OK");

    const stepConnect = toast.addStep("Connecting to " + jiraHost + "...");
    try {
      await this.jiraApi.testConnection();
      toast.updateStep(stepConnect, "success", "Authenticated successfully");
      toast.finish(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepConnect, "error", msg);
      toast.finish(false);
    }
  }

  async createLocalTask(): Promise<void> {
    const key = `LOCAL-${Date.now()}`;
    const frontmatter = {
      jira_key: key,
      source: "LOCAL" as const,
      status: "TO DO",
      mapped_column: "TO DO",
      issuetype: "Task",
      priority: "Medium",
      story_points: 0,
      due_date: "",
      assignee: "",
      sprint: "",
      sprint_state: "",
      tags: ["jira/source/local"],
      summary: "New Local Task",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    await this.fileManager.createTaskFile(key, "New Local Task", frontmatter, "");
    new Notice("Jira Flow: Local task created.");
  }

  async generateReport(period: import("./types").ReportPeriod = "weekly"): Promise<void> {
    const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
    const toast = new StatusToast(document, `${periodLabel} Report`);

    const stepCheck = toast.addStep("Checking AI configuration...");
    const activeModel = this.settings.ai.models.find(
      (m) => m.id === this.settings.ai.activeModelId && m.enabled
    );
    if (!activeModel) {
      toast.updateStep(stepCheck, "error", "No active AI model. Configure one in Settings > AI Models.");
      toast.finish(false);
      return;
    }
    toast.updateStep(stepCheck, "success", activeModel.displayName);

    const stepCollect = toast.addStep("Collecting work logs & tasks...");
    try {
      const stepGenerate = toast.addStep("Generating report via AI...");
      toast.updateStep(stepCollect, "success", "Data collected");

      const result = await this.reportGenerator.generateReport(period);
      toast.updateStep(stepGenerate, "success", result.file.path);

      toast.finish(true);

      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(result.file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(
        toast.addStep("Error"),
        "error",
        msg
      );
      toast.finish(false);
    }
  }
}
