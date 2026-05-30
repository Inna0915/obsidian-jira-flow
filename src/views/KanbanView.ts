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
  private scopePushed = false;

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

  // Ctrl+F focuses the board search. Only reached while this view's scope is on
  // the keymap stack — which happens only while this board is the active leaf
  // (see syncScope), so it never affects other panes/editors.
  private focusSearchInput = (event: KeyboardEvent): boolean => {
    const activeElement = activeDocument.activeElement as HTMLElement | null;
    if (activeElement?.id === this.searchInputId) {
      return false;
    }
    event.preventDefault();
    const searchInput = activeDocument.getElementById(this.searchInputId) as HTMLInputElement | null;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    return false;
  };

  // Keep the Ctrl+F scope on the global keymap stack ONLY while this board is the
  // active leaf. When another view is active the scope is popped, so Obsidian's
  // keymap never "claims" Ctrl+F there and the native/editor search works.
  private syncScope = (): void => {
    const isActive = this.app.workspace.getActiveViewOfType(KanbanView) === this;
    if (isActive && !this.scopePushed && this.keyScope) {
      this.app.keymap.pushScope(this.keyScope);
      this.scopePushed = true;
    } else if (!isActive && this.scopePushed && this.keyScope) {
      this.app.keymap.popScope(this.keyScope);
      this.scopePushed = false;
    }
  };

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    const wrapper = container.createDiv({ cls: "jira-flow-plugin" });

    this.reactRoot = createRoot(wrapper);
    this.reactRoot.render(createElement(App, { plugin: this.plugin, searchInputId: this.searchInputId }));

    // Build the Ctrl+F scope but only push it while this board is the active leaf.
    this.keyScope = new Scope(this.app.scope);
    this.keyScope.register(["Mod"], "f", this.focusSearchInput);
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.syncScope));
    this.syncScope();
  }

  async onClose(): Promise<void> {
    if (this.scopePushed && this.keyScope) {
      this.app.keymap.popScope(this.keyScope);
      this.scopePushed = false;
    }
    this.keyScope = null;

    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}
