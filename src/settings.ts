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

    containerEl.createEl("h2", { text: "Jira Flow 设置" });

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

    createTab("general", "常规");
    createTab("ai", "AI 模型");

    // === Tab Content ===
    if (this.activeTab === "general") {
      this.displayGeneral(containerEl);
    } else {
      this.displayAI(containerEl);
    }
  }

  private displayGeneral(containerEl: HTMLElement): void {
    // === Jira Connection ===
    containerEl.createEl("h3", { text: "Jira 连接" });

    new Setting(containerEl)
      .setName("Jira 地址")
      .setDesc("你的 Jira 实例地址（例如：https://yourcompany.atlassian.net）")
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
      .setName("用户名")
      .setDesc("你的 Jira 用户名（例如：邮箱地址）")
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
      .setName("密码")
      .setDesc("你的 Jira 密码或 API 令牌")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("输入密码或 API 令牌")
          .setValue(this.plugin.settings.jiraPassword)
          .onChange(async (value) => {
            this.plugin.settings.jiraPassword = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("项目 Key")
      .setDesc("用于敏捷同步的 Jira 项目 Key（例如：PDSTDTTA）。留空则仅使用 JQL 查询。")
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
      .setName("JQL 查询")
      .setDesc("用于筛选问题的 JQL（当项目 Key 为空时作为备用）")
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
      .setName("故事点字段")
      .setDesc("Jira 故事点的自定义字段 ID（例如：customfield_10111）")
      .addText((text) =>
        text
          .setPlaceholder("customfield_10111")
          .setValue(this.plugin.settings.storyPointsField)
          .onChange(async (value) => {
            this.plugin.settings.storyPointsField = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("截止日期字段")
      .setDesc("Jira 截止日期/计划结束日期的自定义字段 ID（例如：customfield_10329）")
      .addText((text) =>
        text
          .setPlaceholder("customfield_10329")
          .setValue(this.plugin.settings.dueDateField)
          .onChange(async (value) => {
            this.plugin.settings.dueDateField = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("测试连接")
      .setDesc("测试 Jira 连接是否正常")
      .addButton((button) =>
        button.setButtonText("测试").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("测试中...");
          try {
            await this.plugin.testConnection();
          } finally {
            button.setDisabled(false);
            button.setButtonText("测试");
          }
        })
      );

    // === Folders ===
    containerEl.createEl("h3", { text: "文件夹" });

    new Setting(containerEl)
      .setName("根文件夹")
      .setDesc("Jira Flow 文件的根文件夹")
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
      .setName("Daily Notes 文件夹")
      .setDesc("存放每日笔记的文件夹")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.dailyNotesFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotesFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // === Kanban ===
    containerEl.createEl("h3", { text: "看板" });

    new Setting(containerEl)
      .setName("列（12列布局）")
      .setDesc("固定的 12 列看板布局，映射 Jira 状态。列顺序：FUNNEL → DEFINING → READY → TO DO → EXECUTION → EXECUTED → TESTING & REVIEW → TEST DONE → VALIDATING → RESOLVED → DONE → CLOSED");

    // === Sync ===
    containerEl.createEl("h3", { text: "同步" });

    new Setting(containerEl)
      .setName("启动时自动同步")
      .setDesc("Obsidian 启动时自动与 Jira 同步")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("同步间隔（分钟）")
      .setDesc("自动同步频率（0 表示禁用）")
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
      .setName("手动同步")
      .setDesc("立即手动从 Jira 同步问题")
      .addButton((button) =>
        button.setButtonText("立即同步").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("同步中...");
          try {
            await this.plugin.syncJira();
          } finally {
            button.setDisabled(false);
            button.setButtonText("立即同步");
          }
        })
      );
  }

  private displayAI(containerEl: HTMLElement): void {
    const models = this.plugin.settings.ai.models;

    // === Active Model ===
    const enabledModels = models.filter((m) => m.enabled);
    new Setting(containerEl)
      .setName("当前模型")
      .setDesc("选择用于 AI 报告生成的模型")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "-- 请选择 --");
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
    containerEl.createEl("h3", { text: "报告提示词" });

    const promptPeriods: { key: keyof import("./types").ReportPrompts; label: string }[] = [
      { key: "weekly", label: "周报提示词" },
      { key: "monthly", label: "月报提示词" },
      { key: "quarterly", label: "季报提示词" },
      { key: "yearly", label: "年报提示词" },
    ];

    for (const { key, label } of promptPeriods) {
      new Setting(containerEl)
        .setName(label)
        .setDesc(`用于 ${key} AI 报告生成的系统提示词`)
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
    containerEl.createEl("h3", { text: "模型管理" });

    new Setting(containerEl)
      .setName("添加模型")
      .setDesc("添加新的 AI 模型配置")
      .addButton((button) =>
        button.setButtonText("+ 添加模型").onClick(() => {
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
    for (const h of ["显示名称", "提供商", "模型", "启用", "操作"]) {
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

      const editBtn = actionsCell.createEl("button", { text: "编辑" });
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

      const delBtn = actionsCell.createEl("button", { text: "删除" });
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

    contentEl.createEl("h3", { text: this.editing ? "编辑模型" : "添加模型" });

    new Setting(contentEl)
      .setName("模型名称")
      .addText((text) =>
        text.setValue(this.name).onChange((v) => { this.name = v; })
      );

    new Setting(contentEl)
      .setName("显示名称")
      .addText((text) =>
        text.setValue(this.displayName).onChange((v) => { this.displayName = v; })
      );

    new Setting(contentEl)
      .setName("提供商")
      .addDropdown((dropdown) => {
        dropdown.addOption("kimi", "Kimi（Moonshot）");
        dropdown.addOption("gemini", "Gemini（Google）");
        dropdown.addOption("claude", "Claude（Anthropic）");
        dropdown.addOption("custom", "自定义");
        dropdown.setValue(this.provider);
        dropdown.onChange((v) => { this.provider = v as AIProvider; });
      });

    new Setting(contentEl)
      .setName("基础 URL")
      .addText((text) =>
        text.setPlaceholder("https://api.example.com/v1").setValue(this.baseUrl).onChange((v) => { this.baseUrl = v; })
      );

    new Setting(contentEl)
      .setName("API 密钥")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("sk-...").setValue(this.apiKey).onChange((v) => { this.apiKey = v; });
      });

    new Setting(contentEl)
      .setName("模型 ID")
      .addText((text) =>
        text.setPlaceholder("例如：gpt-4").setValue(this.model).onChange((v) => { this.model = v; })
      );

    // Buttons
    const btnContainer = contentEl.createDiv();
    Object.assign(btnContainer.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "16px",
    });

    const cancelBtn = btnContainer.createEl("button", { text: "取消" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = btnContainer.createEl("button", { text: "保存" });
    Object.assign(saveBtn.style, {
      backgroundColor: "var(--interactive-accent)",
      color: "var(--text-on-accent)",
      fontWeight: "600",
    });
    saveBtn.addEventListener("click", async () => {
      if (!this.name || !this.baseUrl || !this.model) {
        new Notice("请填写模型名称、基础 URL 和模型 ID。");
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
