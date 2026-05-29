import { ItemView, Scope, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type JiraFlowPlugin from "../main";
import { App } from "../components/App";

export const KANBAN_VIEW_TYPE = "jira-flow-kanban";

export class KanbanView extends ItemView {
  plugin: JiraFlowPlugin;
  private reactRoot: Root | null = null;
  private searchInputId = "jira-flow-search-input";
  private keyScope: Scope | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: JiraFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return KANBAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Jira Flow 看板";
  }

  getIcon(): string {
    return "kanban";
  }

  // Handle Ctrl+F to focus search input
  private focusSearchInput = (event: KeyboardEvent): boolean => {
    const activeElement = activeDocument.activeElement as HTMLElement | null;
    if (activeElement?.id === this.searchInputId) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const searchInput = activeDocument.getElementById(this.searchInputId) as HTMLInputElement | null;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }

    return false;
  };

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-plugin" });

    this.reactRoot = createRoot(wrapper);
    this.reactRoot.render(createElement(App, { plugin: this.plugin, searchInputId: this.searchInputId }));

    // Register Ctrl+F shortcut using Obsidian's Scope API
    const scope = new Scope(this.app.scope);
    scope.register(["Mod"], "f", this.focusSearchInput);
    this.app.keymap.pushScope(scope);

    // Store scope for cleanup
    this.keyScope = scope;
  }

  async onClose(): Promise<void> {
    // Cleanup keyboard scope
    if (this.keyScope) {
      this.app.keymap.popScope(this.keyScope);
    }

    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
