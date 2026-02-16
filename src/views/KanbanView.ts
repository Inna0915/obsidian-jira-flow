import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type JiraFlowPlugin from "../main";
import { App } from "../components/App";

export const KANBAN_VIEW_TYPE = "jira-flow-kanban";

export class KanbanView extends ItemView {
  plugin: JiraFlowPlugin;
  private reactRoot: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: JiraFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return KANBAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Jira Flow Kanban";
  }

  getIcon(): string {
    return "kanban";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-plugin" });
    wrapper.style.height = "100%";
    wrapper.style.overflow = "auto";

    this.reactRoot = createRoot(wrapper);
    this.reactRoot.render(createElement(App, { plugin: this.plugin }));
  }

  async onClose(): Promise<void> {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
