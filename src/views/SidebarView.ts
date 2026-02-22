import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type JiraFlowPlugin from "../main";
import { SidebarPanel } from "../components/SidebarPanel";

export const SIDEBAR_VIEW_TYPE = "jira-flow-sidebar-view";

export class SidebarView extends ItemView {
  plugin: JiraFlowPlugin;
  private reactRoot: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: JiraFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Jira Flow 专注";
  }

  getIcon(): string {
    return "check-circle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-plugin" });
    wrapper.style.height = "100%";
    wrapper.style.overflow = "auto";

    this.reactRoot = createRoot(wrapper);
    this.reactRoot.render(createElement(SidebarPanel, { plugin: this.plugin }));
  }

  async onClose(): Promise<void> {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
