# 工作流配置（设置标签 + 芯片拖拽编辑）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把硬编码的 Story/Bug 看板拖拽流转限制提到设置「工作流」标签，用芯片拖拽编辑，默认值=当前流转逻辑。

**Architecture:** 配置存进 `settings.workflows`（两档 bug/default，每档 = transitions 表 + globalTargets）。`types.ts` 的纯函数 `getAllowedTransitions` 改为读传入的 workflows（默认 `DEFAULT_WORKFLOWS`=现状），看板调用点传 `plugin.settings.workflows`，改动即时生效。设置「工作流」tab 挂载 React `WorkflowEditor`（HTML5 拖拽），复用主题 token。

**Tech Stack:** TypeScript + React 18 + Obsidian API + HTML5 Drag&Drop + Vitest。

---

## File Structure
- 改 `src/types.ts`：新增 `WorkflowProfile`/`WorkflowSettings` 类型、`DEFAULT_WORKFLOWS`、`JiraFlowSettings.workflows`、`DEFAULT_SETTINGS.workflows`；`getAllowedTransitions`/`isTransitionAllowed` 加 `workflows` 参数。
- 改 `src/utils/migrateSettings.ts`：缺失/部分缺失时按档案补 `DEFAULT_WORKFLOWS`。
- 改 `src/components/App.tsx`、`src/components/Card.tsx`：调用传 `plugin.settings.workflows`。
- 改 `src/settings.ts`：标签栏（常规/工作流）+ 挂载/卸载 React 编辑器。
- 增 `src/components/WorkflowEditor.tsx`：拖拽编辑器。
- 测 `src/types.workflow.test.ts`、扩展 `src/utils/migrateSettings.test.ts`。

---

## Task 1: 数据模型 + 纯函数改造（types.ts）

**Files:**
- Modify: `src/types.ts`
- Test: `src/types.workflow.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/types.workflow.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_WORKFLOWS, getAllowedTransitions, isTransitionAllowed } from "./types";

describe("workflow transitions", () => {
  it("default profile matches legacy Story rules (EXECUTION)", () => {
    const t = getAllowedTransitions("Story", "EXECUTION");
    // legacy: workflow[EXECUTION]=[TO DO,EXECUTED,CLOSED] ∪ global[FUNNEL,DEFINING,READY,CLOSED]
    expect(new Set(t)).toEqual(new Set(["TO DO", "EXECUTED", "CLOSED", "FUNNEL", "DEFINING", "READY"]));
  });

  it("bug profile matches legacy Bug rules (EXECUTION)", () => {
    const t = getAllowedTransitions("Bug", "EXECUTION");
    // legacy: workflow[EXECUTION]=[TO DO,VALIDATING,DONE,CLOSED] ∪ global[FUNNEL,TO DO,CLOSED]
    expect(new Set(t)).toEqual(new Set(["TO DO", "VALIDATING", "DONE", "CLOSED", "FUNNEL"]));
  });

  it("excludes self even if listed in globalTargets", () => {
    expect(getAllowedTransitions("Story", "FUNNEL")).not.toContain("FUNNEL");
  });

  it("custom workflows take effect", () => {
    const custom = {
      bug: DEFAULT_WORKFLOWS.bug,
      default: { transitions: { "TO DO": ["DONE"] }, globalTargets: ["CLOSED"] },
    };
    expect(new Set(getAllowedTransitions("Story", "TO DO", custom))).toEqual(new Set(["DONE", "CLOSED"]));
    expect(getAllowedTransitions("Story", "READY", custom)).toEqual(["CLOSED"]); // unknown from -> only global
  });

  it("isTransitionAllowed respects workflows and self", () => {
    expect(isTransitionAllowed("Story", "EXECUTION", "EXECUTED")).toBe(true);
    expect(isTransitionAllowed("Story", "EXECUTION", "EXECUTION")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/types.workflow.test.ts`
Expected: FAIL（`DEFAULT_WORKFLOWS` 未导出 / 签名不符）。

- [ ] **Step 3: 实现 —— 替换 types.ts 的 Workflow Validation 段**

把 `src/types.ts` 中从 `// ===== Workflow Validation =====` 到 `isTransitionAllowed` 结束（含 `STORY_WORKFLOW`/`STORY_GLOBAL_TARGETS`/`BUG_WORKFLOW`/`BUG_GLOBAL_TARGETS`/`getAllowedTransitions`/`isTransitionAllowed`）整段替换为：

```ts
// ===== Workflow Validation =====
export interface WorkflowProfile {
  transitions: Record<string, string[]>;
  globalTargets: string[];
}
export interface WorkflowSettings {
  bug: WorkflowProfile;
  default: WorkflowProfile;
}

export const DEFAULT_WORKFLOWS: WorkflowSettings = {
  default: {
    transitions: {
      "FUNNEL": ["DEFINING", "CLOSED"],
      "DEFINING": ["FUNNEL", "READY", "CLOSED"],
      "READY": ["TO DO", "CLOSED"],
      "TO DO": ["READY", "EXECUTION", "CLOSED"],
      "EXECUTION": ["TO DO", "EXECUTED", "CLOSED"],
      "EXECUTED": ["EXECUTION", "TESTING & REVIEW", "CLOSED"],
      "TESTING & REVIEW": ["EXECUTED", "TEST DONE", "CLOSED"],
      "TEST DONE": ["TESTING & REVIEW", "VALIDATING", "CLOSED"],
      "VALIDATING": ["DONE", "RESOLVED", "CLOSED"],
      "RESOLVED": ["DONE", "CLOSED"],
      "DONE": ["CLOSED"],
      "CLOSED": [],
    },
    globalTargets: ["FUNNEL", "DEFINING", "READY", "CLOSED"],
  },
  bug: {
    transitions: {
      "FUNNEL": ["DEFINING", "CLOSED"],
      "DEFINING": ["FUNNEL", "TO DO", "CLOSED"],
      "READY": ["TO DO", "CLOSED"],
      "TO DO": ["EXECUTION", "FUNNEL", "CLOSED"],
      "EXECUTION": ["TO DO", "VALIDATING", "DONE", "CLOSED"],
      "EXECUTED": ["VALIDATING", "DONE", "CLOSED"],
      "TESTING & REVIEW": ["VALIDATING", "DONE", "CLOSED"],
      "TEST DONE": ["VALIDATING", "DONE", "CLOSED"],
      "VALIDATING": ["EXECUTION", "DONE", "CLOSED"],
      "RESOLVED": ["DONE", "CLOSED"],
      "DONE": ["EXECUTION", "CLOSED"],
      "CLOSED": ["EXECUTION"],
    },
    globalTargets: ["FUNNEL", "TO DO", "CLOSED"],
  },
};

export function getAllowedTransitions(
  issueType: string,
  fromColumn: string,
  workflows: WorkflowSettings = DEFAULT_WORKFLOWS,
): string[] {
  const profile = issueType.toLowerCase() === "bug" ? workflows.bug : workflows.default;
  const allowed = new Set(profile.transitions[fromColumn] ?? []);
  for (const columnId of profile.globalTargets) {
    if (columnId !== fromColumn) allowed.add(columnId);
  }
  allowed.delete(fromColumn);
  return Array.from(allowed);
}

export function isTransitionAllowed(
  issueType: string,
  fromColumn: string,
  toColumn: string,
  workflows: WorkflowSettings = DEFAULT_WORKFLOWS,
): boolean {
  if (fromColumn === toColumn) return false;
  return getAllowedTransitions(issueType, fromColumn, workflows).includes(toColumn);
}
```

- [ ] **Step 4: 在 JiraFlowSettings 加 workflows 字段**

在 `src/types.ts` 的 `interface JiraFlowSettings` 末尾（`sprintField: string;` 之后）加：

```ts
  workflows: WorkflowSettings;
```

- [ ] **Step 5: 在 DEFAULT_SETTINGS 加 workflows 默认值**

在 `DEFAULT_SETTINGS` 对象末尾（`sprintField: "customfield_10109",` 之后）加：

```ts
  workflows: structuredClone(DEFAULT_WORKFLOWS),
```

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run src/types.workflow.test.ts`
Expected: PASS（5 用例）。

- [ ] **Step 7: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: App.tsx/Card.tsx 暂无新错（默认参数兼容），types.ts 无错。

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/types.workflow.test.ts
git commit -m "feat: configurable workflow transitions with DEFAULT_WORKFLOWS (= current rules)"
```

---

## Task 2: 设置向后兼容迁移

**Files:**
- Modify: `src/utils/migrateSettings.ts`
- Test: `src/utils/migrateSettings.test.ts`

- [ ] **Step 1: 加失败测试**

在 `src/utils/migrateSettings.test.ts` 的 `describe("migrateSettings", ...)` 内追加：

```ts
  it("fills workflows when missing", () => {
    const s = migrateSettings({ jiraHost: "h" });
    expect(s.workflows.bug.globalTargets).toContain("CLOSED");
    expect(s.workflows.default.transitions["EXECUTION"]).toEqual(["TO DO", "EXECUTED", "CLOSED"]);
  });

  it("fills a missing profile but keeps the provided one", () => {
    const s = migrateSettings({ workflows: { bug: { transitions: { "TO DO": ["DONE"] }, globalTargets: ["CLOSED"] } } });
    expect(s.workflows.bug.transitions["TO DO"]).toEqual(["DONE"]);
    expect(s.workflows.default.globalTargets).toContain("FUNNEL"); // default profile filled
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/utils/migrateSettings.test.ts`
Expected: FAIL（workflows 未处理 / 部分缺失未回退）。

- [ ] **Step 3: 实现 migrateSettings**

把 `src/utils/migrateSettings.ts` 整个替换为：

```ts
import { DEFAULT_SETTINGS, DEFAULT_WORKFLOWS, type JiraFlowSettings, type WorkflowProfile } from "../types";

/** Keys from older versions that must not be carried into current settings. */
const DEPRECATED_KEYS = ["ai"] as const;

function mergeProfile(saved: unknown, fallback: WorkflowProfile): WorkflowProfile {
  if (!saved || typeof saved !== "object") return structuredClone(fallback);
  const s = saved as Partial<WorkflowProfile>;
  return {
    transitions: s.transitions && typeof s.transitions === "object" ? s.transitions : structuredClone(fallback.transitions),
    globalTargets: Array.isArray(s.globalTargets) ? s.globalTargets : structuredClone(fallback.globalTargets),
  };
}

/** Merge saved data.json onto defaults, preserving all known keys and dropping deprecated ones. */
export function migrateSettings(saved: unknown): JiraFlowSettings {
  const raw: Record<string, unknown> =
    saved && typeof saved === "object" ? { ...(saved as Record<string, unknown>) } : {};
  for (const key of DEPRECATED_KEYS) {
    delete raw[key];
  }
  const merged = Object.assign({}, DEFAULT_SETTINGS, raw) as JiraFlowSettings;
  if (!merged.jiraBrowseHost) {
    merged.jiraBrowseHost = DEFAULT_SETTINGS.jiraBrowseHost;
  }
  const savedWorkflows = (raw.workflows ?? {}) as { bug?: unknown; default?: unknown };
  merged.workflows = {
    bug: mergeProfile(savedWorkflows.bug, DEFAULT_WORKFLOWS.bug),
    default: mergeProfile(savedWorkflows.default, DEFAULT_WORKFLOWS.default),
  };
  return merged;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/utils/migrateSettings.test.ts`
Expected: PASS（原有 3 + 新增 2）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/migrateSettings.ts src/utils/migrateSettings.test.ts
git commit -m "feat: migrate workflows setting with per-profile fallback"
```

---

## Task 3: 看板调用点传入 workflows

**Files:**
- Modify: `src/components/App.tsx:375,521`
- Modify: `src/components/Card.tsx:147`

- [ ] **Step 1: App.tsx handleCardMove 传 workflows**

把 `src/components/App.tsx:375`：

```tsx
        if (!isTransitionAllowed(fm.issuetype, originalColumn, targetColumn)) {
```

改为：

```tsx
        if (!isTransitionAllowed(fm.issuetype, originalColumn, targetColumn, plugin.settings.workflows)) {
```

- [ ] **Step 2: App.tsx 批量允许列传 workflows**

把 `src/components/App.tsx:521`：

```tsx
    const intersections = cards.map((card) => new Set(getAllowedTransitions(card.issuetype, card.mappedColumn)));
```

改为：

```tsx
    const intersections = cards.map((card) => new Set(getAllowedTransitions(card.issuetype, card.mappedColumn, plugin.settings.workflows)));
```

> 注：该 useMemo/useCallback 若依赖数组未含 `plugin`，无需改（`plugin` 引用稳定）；保持原依赖。

- [ ] **Step 3: Card.tsx 传 workflows**

`src/components/Card.tsx` 顶部确认有 `plugin` 可用（Card 接收 `plugin` prop）。把 `:147`：

```tsx
  const allowedTargets = getAllowedTransitions(card.issuetype, card.mappedColumn);
```

改为：

```tsx
  const allowedTargets = getAllowedTransitions(card.issuetype, card.mappedColumn, plugin.settings.workflows);
```

> 若 Card 未接收 `plugin` prop，则改用从已传入的 props 获取 settings；先 `grep -n "plugin" src/components/Card.tsx` 确认。若确无 plugin，保留默认参数（读 DEFAULT_WORKFLOWS）并在 Step 5 备注 —— 但拖拽校验主路径在 App.tsx，已生效。

- [ ] **Step 4: 构建**

Run: `npm run build`
Expected: 退出码 0。

- [ ] **Step 5: Commit**

```bash
git add src/components/App.tsx src/components/Card.tsx
git commit -m "feat: kanban transition checks read settings.workflows"
```

---

## Task 4: WorkflowEditor 组件

**Files:**
- Create: `src/components/WorkflowEditor.tsx`

- [ ] **Step 1: 实现组件**

Create `src/components/WorkflowEditor.tsx`:

```tsx
import React, { useCallback, useState } from "react";
import { KANBAN_COLUMNS, DEFAULT_WORKFLOWS, type WorkflowSettings } from "../types";
import type JiraFlowPlugin from "../main";
import { confirmModal } from "../ui/confirmModal";

type ProfileKey = "bug" | "default";
const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);
const DRAG_MIME = "application/x-jf-column";

const chipBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "4px",
  padding: "2px 8px", borderRadius: "var(--radius-s, 4px)",
  fontSize: "var(--font-ui-smaller, 11px)", fontWeight: 600,
  border: "1px solid var(--background-modifier-border)", userSelect: "none",
};

export const WorkflowEditor: React.FC<{ plugin: JiraFlowPlugin }> = ({ plugin }) => {
  const [profile, setProfile] = useState<ProfileKey>("default");
  const [workflows, setWorkflows] = useState<WorkflowSettings>(
    () => structuredClone(plugin.settings.workflows)
  );
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const persist = useCallback((next: WorkflowSettings) => {
    setWorkflows(next);
    plugin.settings.workflows = next;
    void plugin.saveSettings();
  }, [plugin]);

  const addTo = useCallback((zone: string, columnId: string) => {
    if (!COLUMN_IDS.includes(columnId)) return;
    const next = structuredClone(workflows);
    const p = next[profile];
    if (zone === "__global__") {
      if (!p.globalTargets.includes(columnId)) p.globalTargets.push(columnId);
    } else {
      if (zone === columnId) return; // no self
      const list = p.transitions[zone] ?? (p.transitions[zone] = []);
      if (!list.includes(columnId)) list.push(columnId);
    }
    persist(next);
  }, [workflows, profile, persist]);

  const removeFrom = useCallback((zone: string, columnId: string) => {
    const next = structuredClone(workflows);
    const p = next[profile];
    if (zone === "__global__") {
      p.globalTargets = p.globalTargets.filter((c) => c !== columnId);
    } else {
      p.transitions[zone] = (p.transitions[zone] ?? []).filter((c) => c !== columnId);
    }
    persist(next);
  }, [workflows, profile, persist]);

  const resetProfile = useCallback(async () => {
    const ok = await confirmModal(plugin.app, `恢复「${profile === "bug" ? "Bug" : "默认"}」档案到默认配置？`, "恢复默认");
    if (!ok) return;
    const next = structuredClone(workflows);
    next[profile] = structuredClone(DEFAULT_WORKFLOWS[profile]);
    persist(next);
  }, [plugin.app, profile, workflows, persist]);

  const onChipDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData(DRAG_MIME, columnId);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onZoneDrop = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    setDropTarget(null);
    const columnId = e.dataTransfer.getData(DRAG_MIME);
    if (columnId) addTo(zone, columnId);
  };
  const onZoneOver = (e: React.DragEvent, zone: string) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); setDropTarget(zone); }
  };

  const Chip = ({ id, onRemove }: { id: string; onRemove?: () => void }) => (
    <span style={{ ...chipBase, background: "var(--jf-accent-soft, var(--background-secondary))", color: "var(--jf-accent, var(--text-normal))" }}>
      {id}
      {onRemove && (
        <button aria-label={`移除 ${id}`} onClick={onRemove}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>×</button>
      )}
    </span>
  );

  const Zone = ({ zone, items }: { zone: string; items: string[] }) => (
    <div
      onDrop={(e) => onZoneDrop(e, zone)}
      onDragOver={(e) => onZoneOver(e, zone)}
      onDragLeave={() => setDropTarget((z) => (z === zone ? null : z))}
      style={{
        display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "32px",
        padding: "6px 8px", borderRadius: "var(--radius-m, 6px)",
        border: `1px dashed ${dropTarget === zone ? "var(--jf-accent, var(--interactive-accent))" : "var(--background-modifier-border)"}`,
        background: dropTarget === zone ? "var(--jf-accent-soft, var(--background-secondary))" : "var(--background-primary)",
      }}
    >
      {items.length === 0
        ? <span style={{ fontSize: "var(--font-ui-smaller,11px)", color: "var(--text-faint)" }}>拖入列以允许流转</span>
        : items.map((id) => <Chip key={id} id={id} onRemove={() => removeFrom(zone, id)} />)}
    </div>
  );

  const p = workflows[profile];

  return (
    <div className="jira-flow-plugin" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Profile switch + reset */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["default", "bug"] as ProfileKey[]).map((k) => (
            <button key={k} onClick={() => setProfile(k)}
              style={{
                padding: "5px 14px", borderRadius: "var(--radius-m,6px)", cursor: "pointer",
                border: "1px solid var(--background-modifier-border)", fontWeight: 600,
                background: profile === k ? "var(--jf-accent, var(--interactive-accent))" : "var(--background-secondary)",
                color: profile === k ? "var(--jf-on-accent, #fff)" : "var(--text-muted)",
              }}>{k === "bug" ? "Bug" : "默认"}</button>
          ))}
        </div>
        <button onClick={resetProfile}
          style={{ padding: "5px 12px", borderRadius: "var(--radius-m,6px)", cursor: "pointer", border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", color: "var(--text-muted)" }}>
          恢复默认
        </button>
      </div>

      {/* Palette */}
      <div>
        <div style={{ fontSize: "var(--font-ui-smaller,11px)", color: "var(--text-muted)", marginBottom: "4px" }}>列（拖到下方区域）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {COLUMN_IDS.map((id) => (
            <span key={id} draggable onDragStart={(e) => onChipDragStart(e, id)}
              style={{ ...chipBase, cursor: "grab", background: "var(--background-secondary)", color: "var(--text-normal)" }}>{id}</span>
          ))}
        </div>
      </div>

      {/* Global targets */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>全局可达列<span style={{ fontWeight: 400, color: "var(--text-muted)" }}>（任意列都能流转到）</span></div>
        <Zone zone="__global__" items={p.globalTargets} />
      </div>

      {/* Per-column transitions */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>逐列转移规则</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {COLUMN_IDS.map((from) => (
            <div key={from} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "10px", alignItems: "start" }}>
              <div style={{ fontSize: "var(--font-ui-small,13px)", fontWeight: 600, paddingTop: "8px" }}>{from}</div>
              <Zone zone={from} items={p.transitions[from] ?? []} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 均退出码 0。

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkflowEditor.tsx
git commit -m "feat: WorkflowEditor chip-drag component"
```

---

## Task 5: 设置标签栏 + 挂载编辑器

**Files:**
- Modify: `src/settings.ts`

- [ ] **Step 1: 改 imports 与类成员**

把 `src/settings.ts` 顶部：

```ts
import { App, PluginSettingTab, Setting } from "obsidian";
import { FolderSuggest } from "./utils/FolderSuggest";
import type JiraFlowPlugin from "./main";

export class JiraFlowSettingTab extends PluginSettingTab {
  plugin: JiraFlowPlugin;

  constructor(app: App, plugin: JiraFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
```

替换为：

```ts
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
```

- [ ] **Step 2: 改 display() 加 tab 栏**

把 `display()` 方法体替换为：

```ts
  display(): void {
    const { containerEl } = this;
    this.unmountWorkflow();
    containerEl.empty();

    const tabBar = containerEl.createDiv({ cls: "jf-settings-tabs" });
    tabBar.style.display = "flex";
    tabBar.style.gap = "8px";
    tabBar.style.marginBottom = "12px";
    const mkTab = (id: "general" | "workflow", label: string) => {
      const btn = tabBar.createEl("button", { text: label });
      btn.style.padding = "6px 14px";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = this.activeTab === id ? "600" : "400";
      btn.style.borderBottom = this.activeTab === id ? "2px solid var(--interactive-accent)" : "2px solid transparent";
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
```

> `displayGeneral(containerEl)` 保持不变（已接收容器参数）。

- [ ] **Step 3: 类型检查 + 构建**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 均退出码 0。

- [ ] **Step 4: Lint**

Run: `npx eslint src/settings.ts src/components/WorkflowEditor.tsx`
Expected: exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts
git commit -m "feat: settings tabs (general/workflow) mounting WorkflowEditor"
```

---

## Task 6: 手动核对

- [ ] **Step 1: 部署重载**

`npm run build`，拷 `main.js`/`manifest.json`/`styles.css` 到测试 vault 插件目录，重载。

- [ ] **Step 2: 设置页**

打开插件设置 → 见「常规 / 工作流」两 tab。进「工作流」：
- 顶部「默认 / Bug」切换；调色板 12 列；「全局可达列」与「逐列转移规则」区显示**当前默认配置**（如默认档 EXECUTION 行含 TO DO / EXECUTED / CLOSED）。

- [ ] **Step 3: 拖拽编辑**

- 从调色板拖一列到某 from 行 → 该行新增芯片；拖到「全局可达列」→ 新增；点芯片 × → 移除。
- 拖列到它自己的行 → 不新增（self 被禁）。
- 切到 Bug 档独立编辑；「恢复默认」二次确认后还原该档。

- [ ] **Step 4: 看板即时生效**

回看板，按新规则拖卡：被移除的目标列不再高亮/不允许落下；新增的目标列允许。无需重启。

- [ ] **Step 5: 向后兼容**

用不含 workflows 的旧 data.json 重载 → 设置页工作流显示默认配置、Jira 连接信息保留。

---

## 最终验收
- [ ] `npm test`（types.workflow + migrateSettings + 既有）全 PASS。
- [ ] `npx tsc --noEmit` + `npm run build` 退出码 0；`npx eslint src` exit 0。
- [ ] Obsidian 内：工作流 tab 拖拽增删/切档/恢复默认/保存即时生效；默认值=旧行为；旧 vault 兼容。
- [ ] 收尾参考 superpowers:finishing-a-development-branch。

## Self-Review 备注
- **Spec 覆盖**：数据模型（Task1）✓；纯函数+默认值=现状（Task1，DEFAULT_WORKFLOWS 逐字搬入 + 等价单测）✓；迁移兼容（Task2）✓；调用点传 workflows 即时生效（Task3）✓；tab+挂载（Task5）✓；芯片拖拽编辑器+全局区+恢复默认+可用性(高亮/禁 self/占位)（Task4）✓；测试（Task1/2 单测 + Task6 手动）✓。
- **类型一致**：`WorkflowSettings`/`WorkflowProfile`/`DEFAULT_WORKFLOWS`/`getAllowedTransitions(…, workflows?)` 全程一致；`plugin.settings.workflows` 读写一致；`confirmModal(app,msg,title)` 签名与现有一致。
- **可用性**：拖放高亮、禁 self、去重、空区占位、每档恢复默认、保存即时生效 —— 均已含。
