import { App, Modal, Setting } from "obsidian";

/** Show a simple confirm dialog and resolve to the user's choice. */
export function confirmModal(app: App, message: string, title = "确认"): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    let resolved = false;
    const settle = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
      modal.close();
    };

    modal.titleEl.setText(title);
    modal.contentEl.createEl("p", { text: message });
    new Setting(modal.contentEl)
      .addButton((btn) => btn.setButtonText("取消").onClick(() => settle(false)))
      .addButton((btn) => btn.setButtonText("确定").setCta().onClick(() => settle(true)));

    modal.onClose = () => settle(false);
    modal.open();
  });
}
