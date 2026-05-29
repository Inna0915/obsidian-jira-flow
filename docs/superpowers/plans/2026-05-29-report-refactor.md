# 周报重构（移除 AI 生成 + 完成标记）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除插件内置的 AI 周报/月报生成能力，改为在任务完成时写入结构化「完成标记」，让 Claude Code / Codex 能直接定位「本周完成」的任务并自行整理周报，同时报告 `.md` 文件保留为可手动编辑。

**Architecture:** 把目前混在 `src/ai/` 与 `ReportCenter.tsx` 里的「数据收集 / 周序计算 / AI 调用 / UI」拆开。新增三个聚焦模块：纯函数日期工具 `src/utils/dateUtils.ts`（统一现有两套重复的 ISO 周/区间算法）、纯函数完成标记 `src/report/completionMarks.ts`、以及 Obsidian 侧的 `src/sync/completionTracker.ts`（用官方 `processFrontMatter` 写/清标记）。`src/ai/reportGenerator.ts` 去掉 AI 后降级为 `src/report/reportDataService.ts`（只做区间/文件名/数据草稿）。AI 服务、AI 设置、季报/年报整套删除。报告弹窗改为可编辑 + 保存。

**Tech Stack:** TypeScript + React 18 + esbuild + Obsidian API。新增 Vitest 做纯逻辑单测（不依赖 Obsidian），UI/集成部分用「构建 + Obsidian 内手动核对清单」验证。官方合规用 `eslint-plugin-obsidianmd`。

**关键约束（贯穿全程）：**
- **设置向后兼容（重要）**：既有 `data.json` 的 Jira 连接信息（host/账号/密码/projectKey/jql/文件夹/字段映射/看板列等）必须**零改动直接适配**。删 AI 时只丢弃废弃的 `ai` 键（含明文 apiKey），其余键名一律不动；用带单测的纯函数 `migrateSettings` 兜底。
- **官方要求**：frontmatter 改写一律走 `app.fileManager.processFrontMatter`；后台写文件用 `Vault.process` 而非 `Vault.modify`；生产代码不留 `console.log`；UI 文案 sentence case；图标按钮带 aria-label；颜色用 CSS 变量。
- **稳定性**：每个阶段结束必须 `npm run build` 通过，且现有看板/同步/拖拽不回归（见各阶段手动核对）。
- **轻量内存**：复用单个 `WorkLogService` 实例，不在 React effect 里反复 `new`；`DailyWorkLog` 丢弃用不到的 `rawContent`；完成标记是单次 `processFrontMatter`，O(1)。
- **可扩展**：周期相关逻辑全部收敛到 `dateUtils` + `ReportPeriod` 联合类型，未来加回季报只需扩类型与 map，不再散落多份周序算法。

---

## File Structure

**新增：**
- `src/utils/dateUtils.ts` — 纯函数：ISO 周信息、`YYYY-Www`、`YYYY-MM-DD`、`getPeriodRange(period, anchor)`。唯一周序/区间真源。
- `src/utils/migrateSettings.ts` — 纯函数：合并旧 `data.json` 与默认值，保留全部 Jira 字段、丢弃废弃 `ai`。
- `src/utils/migrateSettings.test.ts` — Vitest 单测（向后兼容回归保护）。
- `src/report/completionMarks.ts` — 纯函数：`computeCompletionMarks(date)` 产出 `{ completed_at, completed_week, tag }`。
- `src/sync/completionTracker.ts` — Obsidian 侧：`markCompleted(file)` / `clearCompleted(file)`，用 `processFrontMatter` 写/清标记。
- `src/report/reportDataService.ts` — 由 `src/ai/reportGenerator.ts` 迁移改造，去 AI。
- `src/utils/dateUtils.test.ts`、`src/report/completionMarks.test.ts`、`src/report/reportDataService.test.ts` — Vitest 单测。
- `vitest.config.ts`、`eslint.config.mjs` — 工具配置。

**修改：**
- `src/types.ts` — 删 AI 类型；`ReportPeriod` 收窄为 `"weekly" | "monthly"`；`TaskFrontmatter` 加 `completed_at?`/`completed_week?`。
- `src/main.ts` — 删 AI 命令与 `generateReport` AI 逻辑；接入 `completionTracker`/`reportData`；清理 loadSettings 的 ai 合并。
- `src/settings.ts` — 删 AI tab / `displayAI` / `AddModelModal`。
- `src/components/App.tsx` — 完成/取消完成时调用 completionTracker；工具栏周报/月报按钮直接打开 md；最外层挂 `jira-flow-root`。
- `src/components/Board.tsx`/`Column.tsx`/`Card.tsx` — 硬编码色替换为 Claude `var(--jf-*)`。
- `src/styles/tailwind.css` — Claude 配色 token（亮/暗）+ `jf-toolbar-btn`。
- `src/sync/logger.ts` — 清 `console.log`、`vault.modify`→`Vault.process`、`as any`、死代码。
- `src/sync/workLogService.ts` — 用 `dateUtils`；`DailyWorkLog` 去 `rawContent`。
- `manifest.json` / `package.json` — 描述去 "AI reports" 并补标点。

**删除：**
- `src/ai/aiService.ts`、`src/ai/reportGenerator.ts`（整 `src/ai/` 目录）。
- `src/components/ReportCenter.tsx`（整个报告二级界面：日历视图 + 查看弹窗）。

---

## Phase 0 — 工具链与基线

### Task 0.1: 引入 Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm i -D vitest
```

- [ ] **Step 2: 加 test 脚本**

`package.json` 的 `"scripts"` 增加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 写 vitest 配置**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: 冒烟测试**

Create `src/utils/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed。随后删除 `src/utils/smoke.test.ts`。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit testing"
```

### Task 0.2: 引入官方 ESLint 合规检查

**Files:**
- Modify: `package.json`
- Create: `eslint.config.mjs`

- [ ] **Step 1: 安装依赖**

```bash
npm i -D eslint typescript-eslint eslint-plugin-obsidianmd
```

- [ ] **Step 2: 写 flat config（带 type-aware 规则，社区扫描器要求）**

Create `eslint.config.mjs`:

```js
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  {
    ignores: ["main.js", "dist/**", "node_modules/**", "*.config.*"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
```

- [ ] **Step 3: 加 lint 脚本**

`package.json` 的 `"scripts"` 增加：

```json
"lint": "eslint src"
```

- [ ] **Step 4: 跑一次记录基线（允许失败）**

Run: `npm run lint`
Expected: 输出一批 warning/error（内联样式、`as any`、`console.log` 等）。**这是基线，不在本任务修复**，仅确认工具可用。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json eslint.config.mjs
git commit -m "chore: add eslint-plugin-obsidianmd compliance config"
```

### Task 0.3: 确认构建基线

- [ ] **Step 1: 生产构建**

Run: `npm run build`
Expected: 生成 `main.js`，无报错退出码 0。

- [ ] **Step 2: 记录基线**

Run: `git status`
Expected: 仅 `main.js`/`styles.css` 变动（构建产物），工作区其余干净。

---

## Phase 1 — 统一日期工具（消除重复周序算法）

### Task 1.1: 创建 dateUtils 纯函数 + 单测

**Files:**
- Create: `src/utils/dateUtils.ts`
- Test: `src/utils/dateUtils.test.ts`

> 背景：现 `ReportCenter.tsx:155-209` 与 `reportGenerator.ts:309-414` 各有一份 ISO 周/区间逻辑，必须合并成一处，`completed_week` 也复用它，否则两套算法会算出不同周号。

- [ ] **Step 1: 写失败测试**

Create `src/utils/dateUtils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getIsoWeekInfo, formatIsoWeek, formatYmd, getPeriodRange } from "./dateUtils";

describe("dateUtils", () => {
  it("formatYmd zero-pads", () => {
    expect(formatYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("getIsoWeekInfo: 2026-05-29 is W22", () => {
    expect(getIsoWeekInfo(new Date(2026, 4, 29))).toEqual({ year: 2026, week: 22 });
  });

  it("formatIsoWeek pads week", () => {
    expect(formatIsoWeek(new Date(2026, 4, 29))).toBe("2026-W22");
  });

  it("weekly range is Mon..Sun covering the anchor", () => {
    const { start, end } = getPeriodRange("weekly", new Date(2026, 4, 29)); // Fri
    expect(formatYmd(start)).toBe("2026-05-25"); // Monday
    expect(formatYmd(end)).toBe("2026-05-31");   // Sunday
  });

  it("monthly range covers the whole month", () => {
    const { start, end } = getPeriodRange("monthly", new Date(2026, 4, 29));
    expect(formatYmd(start)).toBe("2026-05-01");
    expect(formatYmd(end)).toBe("2026-05-31");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/utils/dateUtils.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

Create `src/utils/dateUtils.ts`:

```ts
import type { ReportPeriod } from "../types";

export interface DateRange {
  start: Date;
  end: Date;
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const isoYear = target.getFullYear();
  const week1 = new Date(isoYear, 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { year: isoYear, week };
}

export function formatIsoWeek(date: Date): string {
  const info = getIsoWeekInfo(date);
  return `${info.year}-W${String(info.week).padStart(2, "0")}`;
}

export function getPeriodRange(period: ReportPeriod, anchor: Date): DateRange {
  const a = new Date(anchor);
  a.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    const start = new Date(a);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // monthly
  const start = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/utils/dateUtils.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/utils/dateUtils.ts src/utils/dateUtils.test.ts
git commit -m "feat: add unified date/iso-week utilities with tests"
```

---

## Phase 2 — 完成标记（方案 A+B）

### Task 2.1: 完成标记纯函数 + 单测

**Files:**
- Create: `src/report/completionMarks.ts`
- Test: `src/report/completionMarks.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/report/completionMarks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCompletionMarks } from "./completionMarks";

describe("computeCompletionMarks", () => {
  it("derives date/week/tag from a date", () => {
    expect(computeCompletionMarks(new Date(2026, 4, 29))).toEqual({
      completed_at: "2026-05-29",
      completed_week: "2026-W22",
      tag: "done/2026-W22",
    });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/report/completionMarks.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现**

Create `src/report/completionMarks.ts`:

```ts
import { formatYmd, formatIsoWeek } from "../utils/dateUtils";

export interface CompletionMarks {
  completed_at: string;   // YYYY-MM-DD
  completed_week: string; // YYYY-Www
  tag: string;            // done/YYYY-Www
}

export const DONE_TAG_PREFIX = "done/";

export function computeCompletionMarks(date: Date): CompletionMarks {
  const week = formatIsoWeek(date);
  return {
    completed_at: formatYmd(date),
    completed_week: week,
    tag: `${DONE_TAG_PREFIX}${week}`,
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/report/completionMarks.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/report/completionMarks.ts src/report/completionMarks.test.ts
git commit -m "feat: add completion-marks pure computation with tests"
```

### Task 2.2: TaskFrontmatter 增加完成字段

**Files:**
- Modify: `src/types.ts:457-479`

- [ ] **Step 1: 加字段**

在 `TaskFrontmatter` 接口 `archived_date?: string;` 之后、闭合 `}` 之前加入：

```ts
  completed_at?: string;   // YYYY-MM-DD, set when moved to a completed column
  completed_week?: string; // YYYY-Www, ISO week of completion
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无新增报错。

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add completed_at/completed_week to task frontmatter type"
```

### Task 2.3: CompletionTracker（Obsidian 侧写/清标记）

**Files:**
- Create: `src/sync/completionTracker.ts`

> 不写单测（依赖 Obsidian `processFrontMatter`），用 Task 2.5 手动核对。

- [ ] **Step 1: 实现**

Create `src/sync/completionTracker.ts`:

```ts
import { TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import { computeCompletionMarks, DONE_TAG_PREFIX } from "../report/completionMarks";

export class CompletionTracker {
  private plugin: JiraFlowPlugin;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
  }

  /** Stamp completion metadata + done/YYYY-Www tag onto a task file. */
  async markCompleted(file: TFile, date: Date = new Date()): Promise<void> {
    const marks = computeCompletionMarks(date);
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm.completed_at = marks.completed_at;
      fm.completed_week = marks.completed_week;
      const tags: string[] = Array.isArray(fm.tags) ? fm.tags : [];
      fm.tags = tags.filter((t) => !t.startsWith(DONE_TAG_PREFIX)).concat(marks.tag);
    });
  }

  /** Remove completion metadata + any done/* tag (card moved back to an active column). */
  async clearCompleted(file: TFile): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm.completed_at;
      delete fm.completed_week;
      if (Array.isArray(fm.tags)) {
        fm.tags = fm.tags.filter((t: string) => !t.startsWith(DONE_TAG_PREFIX));
      }
    });
  }
}
```

- [ ] **Step 2: 在 main.ts 注册**

`src/main.ts` 顶部 import 区加：

```ts
import { CompletionTracker } from "./sync/completionTracker";
```

在类属性区（`workLogger!: WorkLogger;` 附近）加：

```ts
  completionTracker!: CompletionTracker;
```

在 `onload()` 中实例化（`this.workLogger = new WorkLogger(this);` 之后）：

```ts
    this.completionTracker = new CompletionTracker(this);
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无新增报错。

- [ ] **Step 4: Commit**

```bash
git add src/sync/completionTracker.ts src/main.ts
git commit -m "feat: add CompletionTracker to stamp/clear completion frontmatter"
```

### Task 2.4: 拖拽完成/取消完成时打标

**Files:**
- Modify: `src/components/App.tsx:420-436`

- [ ] **Step 1: 在 handleCardMove 接入打标**

把 `App.tsx` 中 `console.log(...checking work log trigger...)` 到 `shouldLog` 调用 `logWork` 的整段（约 420-436 行）替换为：

```tsx
        // Completion state is defined by the target column.
        const isCompletedNow = isCompletedWorkflowColumn(fm.issuetype, targetColumn, fm.source);

        if (isCompletedNow) {
          await plugin.completionTracker.markCompleted(file);
        } else {
          await plugin.completionTracker.clearCompleted(file);
        }

        // Work-log rule: Story/Task -> EXECUTED, Bug -> VALIDATING, plus any completed column.
        const isBug = fm.issuetype.toLowerCase() === "bug";
        const shouldLog =
          (!isBug && targetColumn === "EXECUTED") ||
          (isBug && targetColumn === "VALIDATING") ||
          isCompletedNow;

        if (shouldLog) {
          await plugin.workLogger.logWork(file, { jiraKey: fm.jira_key, summary: fm.summary });
        }
```

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 退出码 0，生成 `main.js`。

- [ ] **Step 3: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: stamp completion marks on card move (set/clear by column)"
```

### Task 2.5: 手动核对（完成标记）

- [ ] **Step 1: 部署到测试 vault**

把 `main.js`、`manifest.json`、`styles.css` 拷贝到测试 vault 的 `.obsidian/plugins/obsidian-jira-flow/`，重载 Obsidian。

- [ ] **Step 2: 验证打标**

拖一个任务卡到完成列 → 打开该任务 `.md`，确认 frontmatter 出现 `completed_at`、`completed_week`，`tags` 含 `done/2026-Www`。

- [ ] **Step 3: 验证清标**

把同一张卡拖回未完成列 → 确认 `completed_at`/`completed_week` 消失、`done/*` 标签移除。

- [ ] **Step 4: 验证 CC 可定位**

Run（在 vault 根目录）: `grep -rl "completed_week: $(date +%G-W%V)" "Jira-Flow/Tasks"`
Expected: 列出本周完成的任务文件路径（这正是 CC/Codex 的定位方式）。

---

## Phase 3 — 移除 AI，reportGenerator 降级为 reportDataService

### Task 3.1: 收窄 ReportPeriod 并删 AI 类型

**Files:**
- Modify: `src/types.ts:2-29,54`（AI 块）、`:22`（ReportPeriod）

- [ ] **Step 1: 收窄 ReportPeriod**

把 `src/types.ts:22`：

```ts
export type ReportPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
```

改为：

```ts
export type ReportPeriod = "weekly" | "monthly";
```

- [ ] **Step 2: 删除 AI 类型**

删除 `src/types.ts` 中：`AIProvider`（行 2）、`AIModelConfig`（4-13）、`ReportPrompts`（15-20）、`AISettings`（24-29），以及 `JiraFlowSettings` 里的 `ai: AISettings;`（行 51）。

- [ ] **Step 3: 删 BUILTIN_MODELS 与默认 ai**

删除 `BUILTIN_MODELS`（从 `export const BUILTIN_MODELS` 起整个数组），以及 `DEFAULT_SETTINGS` 中的 `ai: { ... }` 整块（约 319-372 行）。

- [ ] **Step 4: 类型检查（预期暴露引用点）**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 在 `settings.ts`、`main.ts`、`reportGenerator.ts`、`aiService.ts`、`ReportCenter.tsx` 报「找不到 ai/AIModelConfig」——这些在 Task 3.2-3.6 逐一清除，**本步不求通过**。

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "refactor: drop AI types, narrow ReportPeriod to weekly|monthly"
```

### Task 3.2: 删除 AI 服务，迁移 reportGenerator → reportDataService（去 AI）

**Files:**
- Delete: `src/ai/aiService.ts`
- Create: `src/report/reportDataService.ts`
- Delete: `src/ai/reportGenerator.ts`
- Test: `src/report/reportDataService.test.ts`

- [ ] **Step 1: 删除 AI 服务**

```bash
git rm src/ai/aiService.ts
```

- [ ] **Step 2: 写 reportDataService（基于原 reportGenerator，去掉 AI 调用，复用 dateUtils）**

Create `src/report/reportDataService.ts`:

```ts
import { TFile, normalizePath } from "obsidian";
import type JiraFlowPlugin from "../main";
import { WorkLogService, type DailyWorkLog } from "../sync/workLogService";
import type { ReportPeriod } from "../types";
import {
  formatYmd,
  getIsoWeekInfo,
  getPeriodRange,
  type DateRange,
} from "../utils/dateUtils";

const REPORT_PREFIX_MAP: Record<ReportPeriod, string> = {
  weekly: "Weekly-Report",
  monthly: "Monthly-Report",
};

interface ReportStats {
  totalDays: number;
  activeDays: number;
  totalEntries: number;
  completedEntries: number;
  taskKeys: Set<string>;
}

export class ReportDataService {
  private plugin: JiraFlowPlugin;
  private workLogService: WorkLogService;

  constructor(plugin: JiraFlowPlugin) {
    this.plugin = plugin;
    this.workLogService = new WorkLogService(plugin);
  }

  /** Collect logs + stats for the calendar task view. */
  async getTasksForPeriod(start: Date, end: Date): Promise<{ logs: DailyWorkLog[]; stats: ReportStats }> {
    const personalTaskKeys = this.collectPersonalTaskKeys();
    const logs = this.filterLogs(await this.workLogService.collectLogs(start, end), personalTaskKeys);
    const stats = this.buildStatsFromLogs(logs, start, end);
    return { logs, stats };
  }

  /** Build a pre-filled, human-editable markdown draft from real data (no AI). */
  async buildReportDraft(period: ReportPeriod, range: DateRange): Promise<string> {
    const normalized = getPeriodRange(period, range.start);
    const personalTaskKeys = this.collectPersonalTaskKeys();
    const logs = this.filterLogs(await this.workLogService.collectLogs(normalized.start, normalized.end), personalTaskKeys);
    const stats = this.buildStatsFromLogs(logs, normalized.start, normalized.end);

    const title = period === "weekly" ? "周报" : "月报";
    const label = `${formatYmd(normalized.start)} ~ ${formatYmd(normalized.end)}`;
    const parts: string[] = [];
    parts.push(`# ${title}`);
    parts.push(`\n**周期:** ${label}`);
    parts.push(`**统计:** 活跃 ${stats.activeDays}/${stats.totalDays} 天 · 条目 ${stats.totalEntries} · 完成 ${stats.completedEntries} · 涉及任务 ${stats.taskKeys.size}\n`);
    parts.push(`## 本期完成`);
    if (logs.length === 0) {
      parts.push(`> 暂无记录\n`);
    } else {
      for (const log of logs) {
        parts.push(`\n### ${log.date}`);
        for (const e of log.entries) {
          const key = e.taskKey ? `${e.taskKey}: ` : "";
          parts.push(`- [${e.completed ? "x" : " "}] ${key}${e.summary}`);
        }
      }
      parts.push("");
    }
    parts.push(`## 总结\n\n`);
    parts.push(`## 下期计划\n\n`);
    return parts.join("\n");
  }

  getReportFile(period: ReportPeriod, range: DateRange): TFile | null {
    const normalized = getPeriodRange(period, range.start);
    const canonicalPath = this.getReportPath(period, normalized);
    const canonicalFile = this.plugin.app.vault.getAbstractFileByPath(canonicalPath);
    return canonicalFile instanceof TFile ? canonicalFile : null;
  }

  listReportKeys(period: ReportPeriod): Set<string> {
    const prefix = REPORT_PREFIX_MAP[period];
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    const keys = new Set<string>();
    for (const file of this.plugin.app.vault.getFiles()) {
      if (!file.path.startsWith(folderPath) || !file.name.startsWith(prefix)) continue;
      const key = this.getReportKeyFromFileName(period, file.name);
      if (key) keys.add(key);
    }
    return keys;
  }

  /** Save (create or update) a report file, using atomic Vault.process for updates. */
  async saveReport(period: ReportPeriod, content: string, range: DateRange): Promise<TFile> {
    const vault = this.plugin.app.vault;
    const folderPath = normalizePath(this.plugin.settings.reportsFolder);
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }
    const normalized = getPeriodRange(period, range.start);
    const filePath = this.getReportPath(period, normalized);
    const existing = vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await vault.process(existing, () => content);
      return existing;
    }
    return await vault.create(filePath, content);
  }

  getReportKey(period: ReportPeriod, range: DateRange): string {
    const start = getPeriodRange(period, range.start).start;
    if (period === "weekly") {
      const info = getIsoWeekInfo(start);
      return `${info.year}-W${String(info.week).padStart(2, "0")}`;
    }
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  }

  private getReportPath(period: ReportPeriod, range: DateRange): string {
    const key = this.getReportKey(period, range);
    return normalizePath(`${this.plugin.settings.reportsFolder}/${REPORT_PREFIX_MAP[period]}-${key}.md`);
  }

  private getReportKeyFromFileName(period: ReportPeriod, fileName: string): string | null {
    if (period === "weekly") {
      const m = fileName.match(/^Weekly-Report-(\d{4})-W(\d{2})\.md$/);
      return m ? `${m[1]}-W${m[2]}` : null;
    }
    const m = fileName.match(/^Monthly-Report-(\d{4})-(\d{2})\.md$/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  private collectPersonalTaskKeys(): Set<string> {
    const keys = new Set<string>();
    for (const file of this.plugin.fileManager.getAllTaskFiles()) {
      const fm = this.plugin.fileManager.getTaskFrontmatter(file);
      if (fm && this.isPersonalIssueType(fm.issuetype)) keys.add(fm.jira_key);
    }
    return keys;
  }

  private filterLogs(logs: DailyWorkLog[], personalTaskKeys: Set<string>): DailyWorkLog[] {
    return logs
      .map((log) => ({
        ...log,
        entries: log.entries.filter((e) => !e.taskKey || !personalTaskKeys.has(e.taskKey)),
      }))
      .filter((log) => log.entries.length > 0);
  }

  private buildStatsFromLogs(logs: DailyWorkLog[], start: Date, end: Date): ReportStats {
    const taskKeys = new Set<string>();
    let totalEntries = 0;
    let completedEntries = 0;
    for (const log of logs) {
      for (const e of log.entries) {
        totalEntries++;
        if (e.completed) completedEntries++;
        if (e.taskKey) taskKeys.add(e.taskKey);
      }
    }
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    return { totalDays, activeDays: logs.length, totalEntries, completedEntries, taskKeys };
  }

  private isPersonalIssueType(issueType: string): boolean {
    const n = (issueType || "").trim().toLowerCase();
    return n === "personal" || n === "个人任务" || n === "personal task";
  }
}
```

- [ ] **Step 3: 删除旧 reportGenerator**

```bash
git rm src/ai/reportGenerator.ts
```

- [ ] **Step 4: 写 reportDataService 单测（getReportKey 纯逻辑）**

Create `src/report/reportDataService.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getIsoWeekInfo } from "../utils/dateUtils";

// getReportKey delegates to dateUtils; verify the weekly key shape it produces.
describe("report key shape", () => {
  it("weekly key matches Weekly-Report file pattern", () => {
    const info = getIsoWeekInfo(new Date(2026, 4, 29));
    const key = `${info.year}-W${String(info.week).padStart(2, "0")}`;
    expect(key).toBe("2026-W22");
    expect(`Weekly-Report-${key}.md`).toMatch(/^Weekly-Report-\d{4}-W\d{2}\.md$/);
  });
});
```

- [ ] **Step 5: 运行单测**

Run: `npx vitest run src/report/reportDataService.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/report/reportDataService.ts src/report/reportDataService.test.ts
git rm src/ai/aiService.ts src/ai/reportGenerator.ts
git commit -m "refactor: replace AI reportGenerator with AI-free ReportDataService"
```

### Task 3.3: main.ts 去 AI 命令与接线

**Files:**
- Modify: `src/main.ts:7,18,28,62-84,114-129,291-325`

- [ ] **Step 1: 换 import 与属性**

`src/main.ts:7` 把：

```ts
import { ReportGenerator } from "./ai/reportGenerator";
```

改为：

```ts
import { ReportDataService } from "./report/reportDataService";
```

`:18` 把 `reportGenerator!: ReportGenerator;` 改为 `reportData!: ReportDataService;`
`:28` 把 `this.reportGenerator = new ReportGenerator(this);` 改为 `this.reportData = new ReportDataService(this);`

- [ ] **Step 2: 删季报/年报命令**

删除 `src/main.ts:74-84` 的 `generate-quarterly-report` 与 `generate-yearly-report` 两个 `addCommand` 块。

- [ ] **Step 3: 周报/月报命令改为「打开预填草稿」（无 AI）**

把 `generate-weekly-report`、`generate-monthly-report` 两个命令的 `callback` 改为：

```ts
      callback: () => this.openReportDraft("weekly"),
```
```ts
      callback: () => this.openReportDraft("monthly"),
```

并把命令名由「生成周报/月报」改为「打开周报草稿」「打开月报草稿」。

- [ ] **Step 4: 用 openReportDraft 替换 generateReport 方法**

把 `src/main.ts:291-325` 的整个 `async generateReport(...)` 方法替换为：

```ts
  async openReportDraft(period: import("./types").ReportPeriod = "weekly"): Promise<void> {
    try {
      const range = getPeriodRange(period, new Date());
      let file = this.reportData.getReportFile(period, range);
      if (!file) {
        const draft = await this.reportData.buildReportDraft(period, range);
        file = await this.reportData.saveReport(period, draft, range);
      }
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    } catch (e) {
      new Notice(`Jira Flow：打开报告失败 ${e instanceof Error ? e.message : String(e)}`);
    }
  }
```

并在 `main.ts` 顶部 import 区补：

```ts
import { getPeriodRange } from "./utils/dateUtils";
```

确认 `Notice` 已在 `main.ts` 的 obsidian import 中（若无则补）。

- [ ] **Step 5: 写 migrateSettings 失败测试（向后兼容核心）**

Create `src/utils/migrateSettings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrateSettings } from "./migrateSettings";

describe("migrateSettings", () => {
  it("preserves existing Jira connection info verbatim", () => {
    const saved = {
      jiraHost: "https://jira.x", jiraUsername: "u", jiraPassword: "p",
      projectKey: "ABC", jql: "assignee = currentUser()",
      tasksFolder: "X/Tasks", sprintField: "customfield_1",
    };
    const s = migrateSettings(saved);
    expect(s.jiraHost).toBe("https://jira.x");
    expect(s.jiraUsername).toBe("u");
    expect(s.jiraPassword).toBe("p");
    expect(s.projectKey).toBe("ABC");
    expect(s.tasksFolder).toBe("X/Tasks");
    expect(s.sprintField).toBe("customfield_1");
  });

  it("drops deprecated ai config (incl. apiKey)", () => {
    const saved = { jiraHost: "h", ai: { models: [{ apiKey: "secret" }], activeModelId: "x" } };
    const s = migrateSettings(saved) as Record<string, unknown>;
    expect(s.ai).toBeUndefined();
  });

  it("fills defaults for missing keys and null input", () => {
    expect(migrateSettings(null).jiraBrowseHost).toBeTruthy();
    expect(migrateSettings({}).tasksFolder).toBeTruthy();
  });
});
```

- [ ] **Step 6: 运行确认失败**

Run: `npx vitest run src/utils/migrateSettings.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 7: 实现 migrateSettings**

Create `src/utils/migrateSettings.ts`:

```ts
import { DEFAULT_SETTINGS, type JiraFlowSettings } from "../types";

/** Keys from older versions that must not be carried into current settings. */
const DEPRECATED_KEYS = ["ai"] as const;

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
  return merged;
}
```

- [ ] **Step 8: 运行确认通过**

Run: `npx vitest run src/utils/migrateSettings.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 9: 用 migrateSettings 重写 loadSettings**

把 `src/main.ts:113-130` 的整个 `loadSettings` 方法替换为：

```ts
  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    this.settings = migrateSettings(saved);
  }
```

并在 `main.ts` 顶部 import 区补：

```ts
import { migrateSettings } from "./utils/migrateSettings";
```

> 说明：`migrateSettings` 内部已 `Object.assign({}, DEFAULT_SETTINGS, saved)`，所以全部 Jira/文件夹/字段配置原样保留；`ai` 被剔除后，下次 `saveSettings()` 写回的 data.json 自动不再含 apiKey。

- [ ] **Step 10: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: `main.ts` 不再报错（剩余报错应只在 settings.ts / ReportCenter.tsx，下两任务处理）。

- [ ] **Step 11: Commit**

```bash
git add src/main.ts src/utils/migrateSettings.ts src/utils/migrateSettings.test.ts
git commit -m "refactor: drop AI commands; migrate settings preserving Jira config"
```

### Task 3.4: settings.ts 删 AI 设置页

**Files:**
- Modify: `src/settings.ts:4,49,55,296-600`

- [ ] **Step 1: 删 AI tab 注册**

删除 `src/settings.ts:49` 的 `createTab("ai", "AI 模型");` 与 `:55` 调用 `this.displayAI(containerEl);` 的分支。

- [ ] **Step 2: 删 displayAI 与 AddModelModal**

删除 `private displayAI(...)` 整个方法（约 296-473）与 `class AddModelModal extends Modal { ... }` 整个类（约 475 到文件末该类结束）。

- [ ] **Step 3: 删无用 import**

删除 `src/settings.ts:4` 的 `import type { AIModelConfig, AIProvider } from "./types";`（若该行还 import 了其它在用类型，仅删 AI 两个）。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: settings.ts 无报错。

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts
git commit -m "refactor: remove AI models settings tab and modal"
```

---

## Phase 4 — 废弃 ReportCenter 二级界面，报告入口移到看板工具栏

> 决策：保留原看板布局；删除整个 `ReportCenter.tsx`（日历视图 + 查看弹窗全删）；工具栏「Reports」按钮换成「周报 / 月报」两个按钮，直接在 Obsidian 标签页打开对应报告 `.md`（不存在则用 `buildReportDraft` 预填真实数据后创建）。报告用 Obsidian 原生 markdown 编辑器查看/编辑。

### Task 4.1: 在 App 工具栏用周报/月报按钮替换 Reports 入口

**Files:**
- Modify: `src/components/App.tsx:17,84,763-765,878-882`

- [ ] **Step 1: 删除 ReportCenter import 与全屏切换**

删除 `App.tsx` 的 `import { ReportCenter } ...`、`const [showReportCenter...] = useState(false);`，以及全屏分支：

```tsx
  if (showReportCenter) {
    return <ReportCenter plugin={plugin} onBack={() => setShowReportCenter(false)} />;
  }
```

- [ ] **Step 2: 工具栏改为周报/月报按钮，直接打开 md**

把 Reports 按钮块替换为：

```tsx
          <button className="jf-toolbar-btn" aria-label="打开周报" onClick={() => plugin.openReportDraft("weekly")}>周报</button>
          <button className="jf-toolbar-btn" aria-label="打开月报" onClick={() => plugin.openReportDraft("monthly")}>月报</button>
```

> `openReportDraft`（Task 3.3）：存在则打开，不存在则 `buildReportDraft` 预填真实数据后创建并打开。

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 退出码 0。

- [ ] **Step 4: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: open weekly/monthly report md from toolbar, drop full-screen report"
```

### Task 4.2: 删除 ReportCenter.tsx

- [ ] **Step 1: 确认无引用**

Run: `grep -rn "ReportCenter" src`
Expected: 无结果。

- [ ] **Step 2: 删文件 + 验证**

```bash
git rm src/components/ReportCenter.tsx
```
Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 均退出码 0。

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove ReportCenter secondary interface"
```

### Task 4.3: 手动核对（报告入口）

- [ ] 部署重载后，工具栏「周报/月报」在标签页打开对应 md（含真实数据草稿）；确认无全屏报告中心/日历。

---

## Phase 5 — 合规与清理

### Task 5.1: logger.ts 合规化

**Files:**
- Modify: `src/sync/logger.ts`

- [ ] **Step 1: 后台写文件改 Vault.process**

把 `logWork` 中两处 `await this.vault.modify(dailyNote, X)`（83, 87-95）改为 `await this.vault.process(dailyNote, () => X)`。

- [ ] **Step 2: 删 console.* 与死代码**

删除 `logger.ts` 内所有 `console.log`/`console.warn`/`console.error`（29,45,51,56,65,98,136,143,160,177,179,185,189,212,217,221,289 等）。删除整个未被调用的 `waitForFile` 方法（229-244）。

- [ ] **Step 3: 收敛 as any**

把 `(app as any).plugins?.plugins?.["periodic-notes"]` 等改为局部类型别名：

```ts
type PluginHost = { plugins?: { plugins?: Record<string, unknown> }; internalPlugins?: { plugins?: Record<string, unknown> } };
const host = this.plugin.app as unknown as PluginHost;
```

后续用 `host.plugins?.plugins?.["periodic-notes"]`。裸 `setTimeout(r, 1000)`（176, 238 已随死代码删）保留的改为 `this.plugin.app.workspace ? window.activeWindow.setTimeout(r, 1000) : setTimeout(r, 1000)`——若仅剩 Templater 等待处，统一用 `activeWindow.setTimeout`。

- [ ] **Step 4: 构建 + lint（仅看 logger）**

Run: `npm run build`
Expected: 退出码 0。
Run: `npx eslint src/sync/logger.ts`
Expected: 较基线显著减少（无 `no-console`、`no-explicit-any`(本文件)、`prefer-vault-process`）。

- [ ] **Step 5: Commit**

```bash
git add src/sync/logger.ts
git commit -m "refactor: logger uses Vault.process, drop console logs and dead code"
```

### Task 5.2: workLogService 轻量化

**Files:**
- Modify: `src/sync/workLogService.ts`

- [ ] **Step 1: DailyWorkLog 去 rawContent**

删除 `DailyWorkLog.rawContent`（13-15 接口字段）与 `readDailyLog` 里 `rawContent: content`（116）。确认无其它引用：

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 无报错（若有引用一并清除）。

- [ ] **Step 2: 复用 dateUtils.formatDate**

`workLogService` 与 `logger` 的 `formatDate` 仍受 `dailyNoteFormat` 影响，保留其自定义格式逻辑（不强行换 dateUtils，避免破坏自定义文件名）。本步仅确认行为不变。

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 退出码 0。

- [ ] **Step 4: Commit**

```bash
git add src/sync/workLogService.ts
git commit -m "perf: drop unused rawContent from daily work logs"
```

### Task 5.3: manifest / package 描述合规

**Files:**
- Modify: `manifest.json`、`package.json`

- [ ] **Step 1: 改描述（去 AI、补标点、sentence case）**

`manifest.json` 的 `description` 改为：

```json
"description": "Kanban board with Jira sync and daily work logging."
```

`package.json` 的 `description` 同步改为：

```json
"description": "Jira-Flow plugin for Obsidian - Kanban board with Jira sync and daily logging"
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json package.json
git commit -m "docs: update plugin description, drop AI mention"
```

### Task 5.4: 设置向后兼容验证（非破坏性）

> `migrateSettings`（Task 3.3）已自动保留 Jira 配置并丢弃 `ai`，**无需手动改 data.json**。此任务仅验证。

- [ ] **Step 1: 用真实旧 data.json 验证**

把一份**含 `ai` 和完整 Jira 信息的旧 `data.json`** 放进测试 vault 的插件目录，部署新 `main.js` 并重载 Obsidian。

- [ ] **Step 2: 确认 Jira 连接信息原样保留**

打开插件设置 → Jira 连接页，确认 host/账号/密码/projectKey/jql/文件夹/字段映射**全部与旧值一致**；触发一次同步成功。

- [ ] **Step 3: 确认 ai 与 apiKey 被清除**

在插件里改任意设置触发一次保存（或同步），然后在 vault 插件目录执行：

Run: `grep -c '"ai"' data.json`
Expected: `0`（apiKey 已随 `ai` 被丢弃且不再写回）。

- [ ] **Step 4: 确认无 AI 残留 UI**

确认设置无「AI 模型」tab、无控制台报错。

---

## Phase 6 — Claude 经典配色系统（亮/暗跟随 Obsidian 主题）

> 设计：暖中性面 + 单一珊瑚/黏土橙强调 + 暖语义色。给插件根容器加 `jira-flow-root`，token 在亮色定义、`.theme-dark` 下覆盖，组件全部用 `var(--jf-*)`，自动跟随 Obsidian 明暗切换（官方规则 32）。

### Task 6.1: 定义 Claude 配色 token

**Files:**
- Modify: `src/styles/tailwind.css`

- [ ] **Step 1: 追加 token（亮 + 暗）到 tailwind.css 末尾**

```css
.jira-flow-root {
  --jf-bg: #FAF9F5;
  --jf-bg-secondary: #F0EEE6;
  --jf-border: #E3E1D7;
  --jf-text: #1F1E1D;
  --jf-text-muted: #73726C;
  --jf-accent: #D97757;
  --jf-accent-hover: #C15F3C;
  --jf-on-accent: #FFFFFF;
  --jf-success: #6B8E5A;
  --jf-danger: #BF4D43;
}
.theme-dark .jira-flow-root {
  --jf-bg: #262624;
  --jf-bg-secondary: #30302E;
  --jf-border: #3A3A37;
  --jf-text: #ECEAE1;
  --jf-text-muted: #9A9890;
  --jf-accent: #E08A6A;
  --jf-accent-hover: #D97757;
  --jf-on-accent: #1F1E1D;
  --jf-success: #7FA06A;
  --jf-danger: #D2685C;
}
.jf-toolbar-btn {
  padding: var(--size-4-1, 6px) var(--size-4-3, 12px);
  border: 1px solid var(--jf-border);
  border-radius: var(--radius-m, 6px);
  background: var(--jf-bg-secondary);
  color: var(--jf-accent);
  cursor: pointer;
  font-size: var(--font-ui-small, 13px);
  font-weight: 600;
}
.jf-toolbar-btn:hover { background: var(--background-modifier-hover); }
.jf-toolbar-btn:focus-visible { outline: 2px solid var(--jf-accent); outline-offset: 2px; }
```

- [ ] **Step 2: 构建刷新 styles.css**

Run: `npm run build`
Expected: 退出码 0，`styles.css` 含 `--jf-accent`。

- [ ] **Step 3: Commit**

```bash
git add src/styles/tailwind.css styles.css
git commit -m "feat: add Claude classic color tokens with light/dark variants"
```

### Task 6.2: 根容器挂 jira-flow-root

**Files:**
- Modify: `src/components/App.tsx`（最外层容器 div）

- [ ] **Step 1: 给 App 最外层容器加 class**

在 App 返回的最外层 `<div>` 的 `className` 上加入 `jira-flow-root`（与既有 class 合并）。

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 退出码 0。

- [ ] **Step 3: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: scope plugin color tokens via jira-flow-root container"
```

### Task 6.3: 主组件着色（去硬编码色）

**Files:**
- Modify: `src/components/Board.tsx`, `src/components/Column.tsx`, `src/components/Card.tsx`, `src/components/App.tsx`

- [ ] **Step 1: 替换硬编码十六进制色**

把这些组件里的硬编码色（如 `#0052CC`、`#FF5630`、`#36B37E`、`#006644` 等内联 style 与常量）替换为 `var(--jf-*)`：强调/链接/激活 → `--jf-accent`；完成/成功 → `--jf-success`；逾期/危险 → `--jf-danger`；面背景 → `--jf-bg`/`--jf-bg-secondary`；边框 → `--jf-border`；文字 → `--jf-text`/`--jf-text-muted`。

- [ ] **Step 2: 构建 + lint**

Run: `npm run build && npx eslint src/components`
Expected: 退出码 0；hardcoded-color 警告显著下降。

- [ ] **Step 3: 手动核对（亮/暗）**

测试 vault 切换浅色/深色主题各看一遍，看板颜色随主题切换、呈 Claude 暖色风、无突兀蓝色。

- [ ] **Step 4: Commit**

```bash
git add src/components
git commit -m "style: apply Claude color tokens across kanban components"
```

---

## 最终验收（全部阶段后）

- [ ] **Step 1: 单测**

Run: `npm test`
Expected: 全部 PASS（dateUtils / completionMarks / reportDataService）。

- [ ] **Step 2: 类型 + 构建**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 均退出码 0。

- [ ] **Step 3: ESLint 合规**

Run: `npm run lint`
Expected: 较 Phase 0 基线，`no-console`/`prefer-vault-process`/`no-explicit-any`(已处理文件) 清零；剩余项记录在案。

- [ ] **Step 4: Obsidian 内回归核对**
  - 看板拖拽、Jira 同步、归档视图、专注视图照常工作（无回归）。
  - 完成卡片打标 / 移回清标正确。
  - 周报/月报草稿含真实数据、可编辑、可保存。
  - 无 AI 设置、无 AI 命令、无季报/年报。
  - `grep -rl "completed_week: $(date +%G-W%V)" Jira-Flow/Tasks` 能列出本周完成任务（CC/Codex 入口验证）。

- [ ] **Step 5: 收尾**

参考 superpowers:finishing-a-development-branch 决定 `refactor` 分支合并方式。

---

## Self-Review 备注

- **Spec 覆盖**：移除 AI（Phase 3）✓；完成标记 A+B（Phase 2）✓；报告可手动编辑（Phase 4.2）✓；保留周报+月报（Phase 3.1 收窄类型）✓；**既有配置直接适配/Jira 信息不丢（Task 3.3 migrateSettings + 单测 + Task 5.4 验证）✓**；架构/可扩展（dateUtils/report 模块化）✓；官方合规（Phase 0.2 + 5）✓；运行时稳定（每阶段 build/手动核对）✓；轻量内存（5.2 去 rawContent、4.1 复用 WorkLogService）✓；UI（Phase 4 + 6）✓。
- **类型一致**：`ReportPeriod` 全程 `weekly|monthly`；`reportData`（非 `reportGenerator`）；`completed_at`/`completed_week`/`done/YYYY-Www` 三处一致；`buildReportDraft`/`saveReport`/`getReportFile`/`listReportKeys` 在 main 与 ReportCenter 调用名一致。
- **已知取舍**：Phase 6 体量大且纯质量，标注为可拆分，不阻塞功能交付。
