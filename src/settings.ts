import { App, PluginSettingTab, Setting } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { FolderSuggest } from "./utils/FolderSuggest";
import { WorkflowEditor } from "./components/WorkflowEditor";
import type JiraFlowPlugin from "./main";

export class JiraFlowSettingTab extends PluginSettingTab {
  plugin: JiraFlowPlugin;
  private activeTab: "general" | "workflow" = "general";
  private workflowRoot: Root | null = null;

  constructor(app: App, plugin: JiraFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    this.unmountWorkflow();
    containerEl.empty();

    const tabBar = containerEl.createDiv({ cls: "jf-settings-tabs" });
    const mkTab = (id: "general" | "workflow", label: string) => {
      const btn = tabBar.createEl("button", { text: label, cls: "jf-settings-tab" });
      btn.toggleClass("jf-settings-tab--active", this.activeTab === id);
      btn.onclick = () => { this.activeTab = id; this.display(); };
    };
    mkTab("general", "常规");
    mkTab("workflow", "工作流");

    const body = containerEl.createDiv();
    if (this.activeTab === "general") {
      this.displayGeneral(body);
    } else {
      this.displayWorkflow(body);
    }
  }

  private displayWorkflow(containerEl: HTMLElement): void {
    const host = containerEl.createDiv();
    this.workflowRoot = createRoot(host);
    this.workflowRoot.render(createElement(WorkflowEditor, { plugin: this.plugin }));
  }

  private unmountWorkflow(): void {
    if (this.workflowRoot) {
      this.workflowRoot.unmount();
      this.workflowRoot = null;
    }
  }

  hide(): void {
    this.unmountWorkflow();
  }

  private displayGeneral(containerEl: HTMLElement): void {
    // === Jira Connection ===
    new Setting(containerEl).setName("Jira 连接").setHeading();

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
      .setName("Jira 浏览域名")
      .setDesc("用于复制任务链接时替换成对外可访问的浏览域名")
      .addText((text) =>
        text
          .setPlaceholder("https://jira.ykeey.cn")
          .setValue(this.plugin.settings.jiraBrowseHost)
          .onChange(async (value) => {
            this.plugin.settings.jiraBrowseHost = value.trim().replace(/\/+$/, "");
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
      .setName("计划开始日期字段")
      .setDesc("Jira Planned Start Date 的自定义字段 ID（例如：customfield_10328）")
      .addText((text) =>
        text
          .setPlaceholder("customfield_10328")
          .setValue(this.plugin.settings.plannedStartDateField)
          .onChange(async (value) => {
            this.plugin.settings.plannedStartDateField = value.trim();
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
      .setName("Sprint 字段")
      .setDesc("Jira Sprint 的自定义字段 ID（例如：customfield_10109）")
      .addText((text) =>
        text
          .setPlaceholder("customfield_10109")
          .setValue(this.plugin.settings.sprintField)
          .onChange(async (value) => {
            this.plugin.settings.sprintField = value.trim();
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
    new Setting(containerEl).setName("文件夹").setHeading();

    new Setting(containerEl)
      .setName("根文件夹")
      .setDesc("Jira Flow 文件的根文件夹")
      .addText((text) => {
        text.setPlaceholder('输入或选择文件夹路径...');
        text.setValue(this.plugin.settings.rootFolder || '/');
        new FolderSuggest(this.app, text.inputEl);
        text.onChange(async (value) => {
          this.plugin.settings.rootFolder = value;
          this.plugin.settings.tasksFolder = value + "/Tasks";
          this.plugin.settings.assetsFolder = value + "/Assets";
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Daily Notes 文件夹")
      .setDesc("存放每日笔记的文件夹")
      .addText((text) => {
        text.setPlaceholder('输入或选择文件夹路径...');
        text.setValue(this.plugin.settings.dailyNotesFolder || '/');
        new FolderSuggest(this.app, text.inputEl);
        text.onChange(async (value) => {
          this.plugin.settings.dailyNotesFolder = value;
          await this.plugin.saveSettings();
        });
      });

    // === Kanban ===
    new Setting(containerEl).setName("看板").setHeading();

    new Setting(containerEl)
      .setName("列（12列布局）")
      .setDesc("固定的 12 列看板布局，映射 Jira 状态。列顺序：FUNNEL → DEFINING → READY → TO DO → EXECUTION → EXECUTED → TESTING & REVIEW → TEST DONE → VALIDATING → RESOLVED → DONE → CLOSED");

    // === Sync ===
    new Setting(containerEl).setName("同步").setHeading();

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

}
