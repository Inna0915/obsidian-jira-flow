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
  // Use a different approach - listen on container element to avoid conflict with Obsidian's native Ctrl+F
  private handleKeyDown = (event: KeyboardEvent): boolean => {
    // Check for Ctrl+F or Cmd+F (Mac) - but only when not already in search input
    if ((event.ctrlKey || event.metaKey) && event.key === "f") {
      const activeElement = document.activeElement;
      // If already in search input, let it be (allow default behavior)
      if (activeElement?.id === this.searchInputId) {
        return true;
      }
      // Otherwise, focus the search input
      event.preventDefault();
      const searchInput = document.getElementById(this.searchInputId) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return false;
    }
    return true;
  };

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-plugin" });
    wrapper.style.height = "100%";
    wrapper.style.overflow = "auto";

    this.reactRoot = createRoot(wrapper);
    this.reactRoot.render(createElement(App, { plugin: this.plugin, searchInputId: this.searchInputId }));

    // Register Ctrl+F shortcut using Obsidian's Scope API
    const scope = new Scope(this.app.scope);
    scope.register([], "Mod+f", this.handleKeyDown);
    this.app.keymap.pushScope(scope);

    // Store scope for cleanup
    (this as any)._keyScope = scope;
  }

  async onClose(): Promise<void> {
    // Cleanup keyboard scope
    const scope = (this as any)._keyScope;
    if (scope) {
      this.app.keymap.popScope(scope);
    }

    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
