export type ToastStatus = "running" | "success" | "error";

interface ToastStep {
  label: string;
  status: ToastStatus;
  detail?: string;
}

export class StatusToast {
  private containerEl: HTMLElement;
  private stepsEl: HTMLElement;
  private titleEl: HTMLElement;
  private steps: ToastStep[] = [];
  private autoCloseTimer: number | null = null;

  constructor(private document: Document, title: string) {
    this.containerEl = document.createElement("div");
    this.containerEl.className = "jf-toast";
    Object.assign(this.containerEl.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      width: "320px",
      background: "var(--background-secondary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
      zIndex: "10000",
      padding: "12px 16px",
      fontFamily: "var(--font-interface)",
      fontSize: "13px",
      color: "var(--text-normal)",
      transition: "opacity 0.3s ease",
    });

    this.titleEl = document.createElement("div");
    Object.assign(this.titleEl.style, {
      fontWeight: "600",
      fontSize: "14px",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    });
    this.titleEl.textContent = title;

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
      cursor: "pointer",
      opacity: "0.6",
      fontSize: "14px",
    });
    closeBtn.addEventListener("click", () => this.dismiss());
    this.titleEl.appendChild(closeBtn);

    this.stepsEl = document.createElement("div");

    this.containerEl.appendChild(this.titleEl);
    this.containerEl.appendChild(this.stepsEl);
    document.body.appendChild(this.containerEl);
  }

  addStep(label: string): number {
    const index = this.steps.length;
    this.steps.push({ label, status: "running" });
    this.render();
    return index;
  }

  updateStep(index: number, status: ToastStatus, detail?: string): void {
    if (index < 0 || index >= this.steps.length) return;
    this.steps[index].status = status;
    if (detail !== undefined) this.steps[index].detail = detail;
    this.render();
  }

  finish(success: boolean, autoCloseMs = 4000): void {
    this.titleEl.firstChild!.textContent = success
      ? "✅ " + (this.titleEl.firstChild!.textContent || "")
      : "❌ " + (this.titleEl.firstChild!.textContent || "");

    if (autoCloseMs > 0) {
      this.autoCloseTimer = window.setTimeout(() => this.dismiss(), autoCloseMs);
    }
  }

  dismiss(): void {
    if (this.autoCloseTimer !== null) {
      window.clearTimeout(this.autoCloseTimer);
    }
    this.containerEl.style.opacity = "0";
    window.setTimeout(() => {
      this.containerEl.remove();
    }, 300);
  }

  private render(): void {
    this.stepsEl.empty();
    for (const step of this.steps) {
      const row = this.document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "3px 0",
        lineHeight: "1.4",
      });

      const icon = this.document.createElement("span");
      icon.style.flexShrink = "0";
      if (step.status === "running") {
        icon.textContent = "⏳";
      } else if (step.status === "success") {
        icon.textContent = "✅";
      } else {
        icon.textContent = "❌";
      }

      const text = this.document.createElement("span");
      text.style.flex = "1";
      text.textContent = step.label;
      if (step.detail) {
        const detailEl = this.document.createElement("div");
        Object.assign(detailEl.style, {
          fontSize: "12px",
          opacity: "0.7",
          marginTop: "1px",
        });
        detailEl.textContent = step.detail;
        text.appendChild(detailEl);
      }

      row.appendChild(icon);
      row.appendChild(text);
      this.stepsEl.appendChild(row);
    }
  }
}
