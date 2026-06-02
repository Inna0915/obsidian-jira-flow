import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type JiraFlowSettings } from "./types";
import { JiraFlowSettingTab } from "./settings";
import { JiraApi } from "./api/jira";
import { FileManager as JFFileManager } from "./sync/fileManager";
import { WorkLogger } from "./sync/logger";
import { CompletionTracker } from "./sync/completionTracker";
import { migrateSettings } from "./utils/migrateSettings";
import { KANBAN_VIEW_TYPE, KanbanView } from "./views/KanbanView";
import { SIDEBAR_VIEW_TYPE, SidebarView } from "./views/SidebarView";
import { StatusToast } from "./ui/StatusToast";

export default class JiraFlowPlugin extends Plugin {
  settings: JiraFlowSettings = DEFAULT_SETTINGS;
  jiraApi!: JiraApi;
  fileManager!: JFFileManager;
  workLogger!: WorkLogger;
  completionTracker!: CompletionTracker;
  private syncIntervalId: number | null = null;
  private syncInProgress = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.jiraApi = new JiraApi(this);
    this.fileManager = new JFFileManager(this);
    this.workLogger = new WorkLogger(this);
    this.completionTracker = new CompletionTracker(this);

    this.addRibbonIcon("kanban", "打开 Jira Flow 看板", () => {
      void this.activateKanbanView();
    });

    this.addRibbonIcon("check-circle", "打开 Jira Flow 专注视图", () => {
      void this.activateSidebarView();
    });

    this.addSettingTab(new JiraFlowSettingTab(this.app, this));

    this.registerView(KANBAN_VIEW_TYPE, (leaf) => new KanbanView(leaf, this));
    this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new SidebarView(leaf, this));

    this.addCommand({
      id: "open-kanban",
      name: "打开看板",
      callback: () => this.activateKanbanView(),
    });

    this.addCommand({
      id: "sync-jira",
      name: "立即同步",
      callback: () => this.syncJira(),
    });

    this.addCommand({
      id: "open-focus-view",
      name: "打开专注视图（侧边栏）",
      callback: () => this.activateSidebarView(),
    });

    if (this.settings.autoSyncOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        void this.syncJira();
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
    const saved: unknown = await this.loadData();
    this.settings = migrateSettings(saved);
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
        () => void this.syncJira(),
        this.settings.syncIntervalMinutes * 60 * 1000
      );
      this.registerInterval(this.syncIntervalId);
    }
  }

  async activateKanbanView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
    if (existing.length > 0) {
      void this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: KANBAN_VIEW_TYPE, active: true });
    void this.app.workspace.revealLeaf(leaf);
  }


  async activateSidebarView(): Promise<void> {
    const { workspace } = this.app;
    
    let leaf = workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0];

    if (!leaf) {
      // Create in right sidebar
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
        leaf = rightLeaf;
      } else {
        // Fallback to tab if no right leaf available
        const newLeaf = workspace.getLeaf("tab");
        await newLeaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
        leaf = newLeaf;
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }

  async syncJira(): Promise<void> {
    if (!this.settings.jiraHost || !this.settings.jiraUsername || !this.settings.jiraPassword) {
      new Notice("Jira Flow: Please configure Jira connection in settings.");
      return;
    }

    if (this.syncInProgress) {
      new Notice("Jira Flow：同步已在进行中，请稍候。");
      return;
    }

    this.syncInProgress = true;

    const toast = new StatusToast(activeDocument, "Jira Sync");

    const stepFetch = toast.addStep("Fetching issues...");
    let issues: import("./types").JiraIssue[];
    try {
      issues = await this.jiraApi.fetchIssues();
      toast.updateStep(stepFetch, "success", `${issues.length} issues found`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepFetch, "error", msg);
      toast.finish(false);
      this.syncInProgress = false;
      return;
    }

    const stepSync = toast.addStep("Syncing to local files...");
    try {
      const result = await this.fileManager.syncIssues(issues);
      const detail = `Created: ${result.created}, Updated: ${result.updated}` +
        (result.archived > 0 ? `, Archived: ${result.archived}` : "") +
        (result.errors.length > 0 ? `, Errors: ${result.errors.length}` : "");
      toast.updateStep(stepSync, result.errors.length > 0 ? "error" : "success", detail);
      toast.finish(result.errors.length === 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.updateStep(stepSync, "error", msg);
      toast.finish(false);
    } finally {
      this.syncInProgress = false;
    }
  }

  async testConnection(): Promise<void> {
    const toast = new StatusToast(activeDocument, "Test Connection");

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
}
