import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type JiraFlowPlugin from "./main";
import type { AIModelConfig, AIProvider } from "./types";

export class JiraFlowSettingTab extends PluginSettingTab {
  plugin: JiraFlowPlugin;
  private activeTab: "general" | "ai" = "general";

  constructor(app: App, plugin: JiraFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Jira Flow Settings" });

    // === Tab Bar ===
    const tabBar = containerEl.createDiv({ cls: "jf-settings-tabs" });
    Object.assign(tabBar.style, {
      display: "flex",
      gap: "0",
      borderBottom: "1px solid var(--background-modifier-border)",
      marginBottom: "16px",
    });

    const createTab = (id: "general" | "ai", label: string) => {
      const tab = tabBar.createEl("button", { text: label });
      Object.assign(tab.style, {
        padding: "8px 20px",
        border: "none",
        borderBottom: this.activeTab === id ? "2px solid var(--interactive-accent)" : "2px solid transparent",
        background: "transparent",
        color: this.activeTab === id ? "var(--interactive-accent)" : "var(--text-muted)",
        fontWeight: this.activeTab === id ? "600" : "400",
        cursor: "pointer",
        fontSize: "14px",
      });
      tab.addEventListener("click", () => {
        this.activeTab = id;
        this.display();
      });
    };

    createTab("general", "General");
    createTab("ai", "AI Models");

    // === Tab Content ===
    if (this.activeTab === "general") {
      this.displayGeneral(containerEl);
    } else {
      this.displayAI(containerEl);
    }
  }

  private displayGeneral(containerEl: HTMLElement): void {
    // === Jira Connection ===
    containerEl.createEl("h3", { text: "Jira Connection" });

    new Setting(containerEl)
      .setName("Jira Host")
      .setDesc("Your Jira instance URL (e.g. https://yourcompany.atlassian.net)")
      .addText((text) =>
        text
          .setPlaceholder("https://yourcompany.atlassian.net")
          .setValue(this.plugin.settings.jiraHost)
          .onChange(async (value) => {
            this.plugin.settings.jiraHost = value.trim().replace(/\/+$/, "");
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Username")
      .setDesc("Your Jira username (e.g. email address)")
      .addText((text) =>
        text
          .setPlaceholder("user@example.com")
          .setValue(this.plugin.settings.jiraUsername)
          .onChange(async (value) => {
            this.plugin.settings.jiraUsername = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Your Jira password or API token")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("Enter password or API token")
          .setValue(this.plugin.settings.jiraPassword)
          .onChange(async (value) => {
            this.plugin.settings.jiraPassword = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Project Key")
      .setDesc("Jira project key for Agile sync (e.g. PDSTDTTA). Leave empty to use JQL only.")
      .addText((text) =>
        text
          .setPlaceholder("PDSTDTTA")
          .setValue(this.plugin.settings.projectKey)
          .onChange(async (value) => {
            this.plugin.settings.projectKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("JQL Query")
      .setDesc("JQL to filter issues (used as fallback when Project Key is empty)")
      .addTextArea((text) =>
        text
          .setPlaceholder("assignee = currentUser()")
          .setValue(this.plugin.settings.jql)
          .onChange(async (value) => {
            this.plugin.settings.jql = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Test whether the Jira connection is working")
      .addButton((button) =>
        button.setButtonText("Test").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("Testing...");
          try {
            await this.plugin.testConnection();
          } finally {
            button.setDisabled(false);
            button.setButtonText("Test");
          }
        })
      );

    // === Folders ===
    containerEl.createEl("h3", { text: "Folders" });

    new Setting(containerEl)
      .setName("Root Folder")
      .setDesc("Root folder for Jira Flow files")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.rootFolder)
          .onChange(async (value) => {
            this.plugin.settings.rootFolder = value;
            this.plugin.settings.tasksFolder = value + "/Tasks";
            this.plugin.settings.reportsFolder = value + "/Reports";
            this.plugin.settings.assetsFolder = value + "/Assets";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Daily Notes Folder")
      .setDesc("Folder where your daily notes are stored")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // === Kanban ===
    containerEl.createEl("h3", { text: "Kanban Board" });

    new Setting(containerEl)
      .setName("Columns (12-column layout)")
      .setDesc("Fixed 12-column Kanban layout with Jira status mapping. Columns: FUNNEL → DEFINING → READY → TO DO → EXECUTION → EXECUTED → TESTING & REVIEW → TEST DONE → VALIDATING → RESOLVED → DONE → CLOSED");

    // === Sync ===
    containerEl.createEl("h3", { text: "Sync" });

    new Setting(containerEl)
      .setName("Auto-sync on startup")
      .setDesc("Automatically sync with Jira when Obsidian starts")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often to auto-sync (0 to disable)")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.syncIntervalMinutes = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Manual Sync")
      .setDesc("Manually sync issues from Jira now")
      .addButton((button) =>
        button.setButtonText("Sync Now").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("Syncing...");
          try {
            await this.plugin.syncJira();
          } finally {
            button.setDisabled(false);
            button.setButtonText("Sync Now");
          }
        })
      );
  }

  private displayAI(containerEl: HTMLElement): void {
    const models = this.plugin.settings.ai.models;

    // === Active Model ===
    const enabledModels = models.filter((m) => m.enabled);
    new Setting(containerEl)
      .setName("Active Model")
      .setDesc("Select which model to use for AI report generation")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "-- Select --");
        for (const m of enabledModels) {
          dropdown.addOption(m.id, m.displayName);
        }
        dropdown.setValue(this.plugin.settings.ai.activeModelId);
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.activeModelId = value;
          await this.plugin.saveSettings();
        });
      });

    // === Report Prompts ===
    containerEl.createEl("h3", { text: "Report Prompts" });

    const promptPeriods: { key: keyof import("./types").ReportPrompts; label: string }[] = [
      { key: "weekly", label: "Weekly Report Prompt" },
      { key: "monthly", label: "Monthly Report Prompt" },
      { key: "quarterly", label: "Quarterly Report Prompt" },
      { key: "yearly", label: "Yearly Report Prompt" },
    ];

    for (const { key, label } of promptPeriods) {
      new Setting(containerEl)
        .setName(label)
        .setDesc(`System prompt for ${key} AI report generation`)
        .addTextArea((text) => {
          text.inputEl.rows = 3;
          text.inputEl.style.width = "100%";
          text
            .setValue(this.plugin.settings.ai.reportPrompts[key])
            .onChange(async (value) => {
              this.plugin.settings.ai.reportPrompts[key] = value;
              await this.plugin.saveSettings();
            });
        });
    }

    // === Model Table ===
    containerEl.createEl("h3", { text: "Model Management" });

    new Setting(containerEl)
      .setName("Add Model")
      .setDesc("Add a new AI model configuration")
      .addButton((button) =>
        button.setButtonText("+ Add Model").onClick(() => {
          new AddModelModal(this.app, this.plugin, () => this.display()).open();
        })
      );

    // Table
    const tableWrapper = containerEl.createDiv();
    tableWrapper.style.overflowX = "auto";

    const table = tableWrapper.createEl("table");
    Object.assign(table.style, {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
    });

    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    for (const h of ["Display Name", "Provider", "Model", "Enabled", "Actions"]) {
      const th = headerRow.createEl("th", { text: h });
      Object.assign(th.style, {
        textAlign: "left",
        padding: "8px 10px",
        borderBottom: "1px solid var(--background-modifier-border)",
        color: "var(--text-muted)",
        fontWeight: "500",
      });
    }

    const tbody = table.createEl("tbody");
    for (const model of models) {
      const row = tbody.createEl("tr");
      row.style.borderBottom = "1px solid var(--background-modifier-border)";

      const cellStyle = { padding: "8px 10px", verticalAlign: "middle" };

      // Display Name
      const nameCell = row.createEl("td");
      Object.assign(nameCell.style, cellStyle);
      nameCell.textContent = model.displayName;

      // Provider
      const providerCell = row.createEl("td");
      Object.assign(providerCell.style, cellStyle);
      const badge = providerCell.createEl("span", { text: model.provider.toUpperCase() });
      Object.assign(badge.style, {
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "600",
        background: this.getProviderColor(model.provider),
        color: "white",
      });

      // Model
      const modelCell = row.createEl("td");
      Object.assign(modelCell.style, cellStyle);
      modelCell.textContent = model.model;
      modelCell.style.fontFamily = "var(--font-monospace)";
      modelCell.style.fontSize = "12px";

      // Enabled toggle
      const toggleCell = row.createEl("td");
      Object.assign(toggleCell.style, cellStyle);
      const toggle = toggleCell.createEl("input", { type: "checkbox" });
      toggle.checked = model.enabled;
      toggle.style.cursor = "pointer";
      toggle.addEventListener("change", async () => {
        model.enabled = toggle.checked;
        if (!model.enabled && this.plugin.settings.ai.activeModelId === model.id) {
          this.plugin.settings.ai.activeModelId = "";
        }
        await this.plugin.saveSettings();
        this.display();
      });

      // Actions
      const actionsCell = row.createEl("td");
      Object.assign(actionsCell.style, cellStyle);

      const editBtn = actionsCell.createEl("button", { text: "Edit" });
      Object.assign(editBtn.style, {
        marginRight: "6px",
        padding: "3px 10px",
        fontSize: "12px",
        cursor: "pointer",
        borderRadius: "4px",
        border: "1px solid var(--background-modifier-border)",
        background: "transparent",
        color: "var(--text-normal)",
      });
      editBtn.addEventListener("click", () => {
        new AddModelModal(this.app, this.plugin, () => this.display(), model).open();
      });

      const delBtn = actionsCell.createEl("button", { text: "Delete" });
      Object.assign(delBtn.style, {
        padding: "3px 10px",
        fontSize: "12px",
        cursor: "pointer",
        borderRadius: "4px",
        border: "1px solid var(--background-modifier-border)",
        background: "transparent",
        color: "#FF5630",
      });
      delBtn.addEventListener("click", async () => {
        this.plugin.settings.ai.models = models.filter((m) => m.id !== model.id);
        if (this.plugin.settings.ai.activeModelId === model.id) {
          this.plugin.settings.ai.activeModelId = "";
        }
        await this.plugin.saveSettings();
        this.display();
      });
    }
  }

  private getProviderColor(provider: AIProvider): string {
    switch (provider) {
      case "kimi": return "#6366F1";
      case "gemini": return "#4285F4";
      case "claude": return "#D97706";
      case "custom": return "#6B7280";
    }
  }
}

class AddModelModal extends Modal {
  private plugin: JiraFlowPlugin;
  private onSave: () => void;
  private editing: AIModelConfig | null;

  private name: string;
  private displayName: string;
  private provider: AIProvider;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(app: App, plugin: JiraFlowPlugin, onSave: () => void, editing?: AIModelConfig) {
    super(app);
    this.plugin = plugin;
    this.onSave = onSave;
    this.editing = editing ?? null;

    this.name = editing?.name ?? "";
    this.displayName = editing?.displayName ?? "";
    this.provider = editing?.provider ?? "custom";
    this.baseUrl = editing?.baseUrl ?? "";
    this.apiKey = editing?.apiKey ?? "";
    this.model = editing?.model ?? "";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: this.editing ? "Edit Model" : "Add Model" });

    new Setting(contentEl)
      .setName("Model Name")
      .addText((text) =>
        text.setValue(this.name).onChange((v) => { this.name = v; })
      );

    new Setting(contentEl)
      .setName("Display Name")
      .addText((text) =>
        text.setValue(this.displayName).onChange((v) => { this.displayName = v; })
      );

    new Setting(contentEl)
      .setName("Provider")
      .addDropdown((dropdown) => {
        dropdown.addOption("kimi", "Kimi (Moonshot)");
        dropdown.addOption("gemini", "Gemini (Google)");
        dropdown.addOption("claude", "Claude (Anthropic)");
        dropdown.addOption("custom", "Custom");
        dropdown.setValue(this.provider);
        dropdown.onChange((v) => { this.provider = v as AIProvider; });
      });

    new Setting(contentEl)
      .setName("Base URL")
      .addText((text) =>
        text.setPlaceholder("https://api.example.com/v1").setValue(this.baseUrl).onChange((v) => { this.baseUrl = v; })
      );

    new Setting(contentEl)
      .setName("API Key")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("sk-...").setValue(this.apiKey).onChange((v) => { this.apiKey = v; });
      });

    new Setting(contentEl)
      .setName("Model ID")
      .addText((text) =>
        text.setPlaceholder("e.g. gpt-4").setValue(this.model).onChange((v) => { this.model = v; })
      );

    // Buttons
    const btnContainer = contentEl.createDiv();
    Object.assign(btnContainer.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "16px",
    });

    const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = btnContainer.createEl("button", { text: "Save" });
    Object.assign(saveBtn.style, {
      backgroundColor: "var(--interactive-accent)",
      color: "var(--text-on-accent)",
      fontWeight: "600",
    });
    saveBtn.addEventListener("click", async () => {
      if (!this.name || !this.baseUrl || !this.model) {
        new Notice("Please fill in Model Name, Base URL, and Model ID.");
        return;
      }

      const models = this.plugin.settings.ai.models;

      if (this.editing) {
        const idx = models.findIndex((m) => m.id === this.editing!.id);
        if (idx >= 0) {
          models[idx] = {
            ...models[idx],
            name: this.name,
            displayName: this.displayName || this.name,
            provider: this.provider,
            baseUrl: this.baseUrl.replace(/\/+$/, ""),
            apiKey: this.apiKey,
            model: this.model,
          };
        }
      } else {
        models.push({
          id: `custom-${Date.now()}`,
          name: this.name,
          displayName: this.displayName || this.name,
          provider: this.provider,
          baseUrl: this.baseUrl.replace(/\/+$/, ""),
          apiKey: this.apiKey,
          model: this.model,
          enabled: false,
        });
      }

      await this.plugin.saveSettings();
      this.onSave();
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
