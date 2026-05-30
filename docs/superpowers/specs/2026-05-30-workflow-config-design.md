# 工作流配置（设置标签 + 芯片拖拽编辑）Design

**目标**：把目前硬编码的 Story/Bug 看板拖拽流转限制（生命周期）提到设置界面，单开「工作流」标签，用**芯片拖拽**编辑，默认值即当前流转逻辑。

## 决策（已确认）
- 编辑器形态：**芯片拖拽**（列调色板 + 各 from 列 drop 区 + × 移除）。
- 类型粒度：**两档** —— `bug` 一套，其余类型共用 `default`（=当前 Story 表）。
- 全局可达列：**可配，单独一区**。
- 默认配置：**= 当前硬编码的 STORY/BUG 转移表 + 全局可达列，原样搬入**。

## 数据模型
新增到 `JiraFlowSettings`：
```ts
export interface WorkflowProfile {
  transitions: Record<string, string[]>; // from 列 id -> 允许去的列 id[]
  globalTargets: string[];               // 任意列都可去（去重，排除 self）
}
export interface WorkflowSettings { bug: WorkflowProfile; default: WorkflowProfile; }
// JiraFlowSettings.workflows: WorkflowSettings
```

`DEFAULT_WORKFLOWS`（types.ts 导出，**逐字等于现状**）：
- `default.transitions` = 现 `STORY_WORKFLOW`；`default.globalTargets` = `["FUNNEL","DEFINING","READY","CLOSED"]`
- `bug.transitions` = 现 `BUG_WORKFLOW`；`bug.globalTargets` = `["FUNNEL","TO DO","CLOSED"]`

`DEFAULT_SETTINGS.workflows = DEFAULT_WORKFLOWS`（深拷贝）。

## 逻辑改造（types.ts，纯函数，可单测）
```ts
export function getAllowedTransitions(
  issueType: string,
  fromColumn: string,
  workflows: WorkflowSettings = DEFAULT_WORKFLOWS,
): string[]
```
- `profile = issueType.toLowerCase() === "bug" ? workflows.bug : workflows.default`
- 返回 `unique(profile.transitions[fromColumn] ?? []) ∪ profile.globalTargets`，**排除 fromColumn 自身**。
- `isTransitionAllowed(type, from, to, workflows?)` 同步加 `workflows` 透传参数。
- 调用点传 `plugin.settings.workflows`：`App.tsx`（handleCardMove 的 isTransitionAllowed、批量允许列 getAllowedTransitions）、`Card.tsx`（getAllowedTransitions）。

## 设置向后兼容
`migrateSettings`：旧 data.json 无 `workflows` → 用 `DEFAULT_WORKFLOWS` 补齐；若部分缺失（如只有 bug），按档案逐项回退默认。保留既有 Jira 配置不动。

## 设置界面（settings.ts）
- 恢复**标签栏**：`常规` | `工作流`（之前删 AI tab 时移除，现以两 tab 加回）。
- `常规` = 现有 displayGeneral。
- `工作流` tab：在该 tab 容器内 `createRoot` 挂载 React `WorkflowEditor`，切 tab/`hide()` 时 `unmount()` 清理（防泄漏）。

## WorkflowEditor 组件（新增 src/components/WorkflowEditor.tsx）
Props：`{ plugin }`。读写 `plugin.settings.workflows`，改动即 `saveSettings()`。

布局：
1. **顶部条**：档案切换 `Bug` / `默认`（segmented）；右侧「恢复默认」（仅当前档案，带二次确认 confirmModal）。
2. **列调色板 palette**：12 个列芯片（KANBAN_COLUMNS 顺序），`draggable`，作为拖入源。
3. **「全局可达列」drop 区**：显示当前 `globalTargets` 芯片（× 可删）；从 palette 拖列放入=新增；去重。
4. **「逐列转移规则」**：按 KANBAN_COLUMNS 顺序 12 行，每行 = 列名 + drop 区（该列 `transitions[col]` 芯片，× 可删）；palette 拖列放入=新增；**禁止加入自身**（self），去重。

可用性要点：
- drop 区 `onDragOver`(preventDefault) + 拖入高亮（accent 边框/底）；非法（self/重复）拖入时 drop 区显示禁用态、不写入。
- 芯片：列名简短双语缩写（用 KANBAN_COLUMNS.label 或 id），× 按钮有 aria-label。
- 配色全用主题 token（珊瑚强调 + 原生表面），亮暗自适应；scoped 在 `.jira-flow-plugin` 外（settings 不在该 wrapper 内）→ 组件根加 `jira-flow-plugin` class 以复用 token。
- 空 drop 区显示占位提示「拖入列以允许流转」。

数据流：编辑 → setState(local) + 写 `plugin.settings.workflows[profile]` → `plugin.saveSettings()`。看板下次拖拽校验读 `plugin.settings.workflows` → 即时生效（无需重启）。

## 错误处理 / 稳定性
- 拖拽载荷用 `dataTransfer.setData("text/plain", columnId)`；drop 解析校验 columnId ∈ KANBAN_COLUMNS。
- 写入前去重、过滤 self、过滤未知列。
- React root 卸载清理。

## 测试
- 单测（Vitest，纯函数）：
  - `getAllowedTransitions` 用 `DEFAULT_WORKFLOWS` 与旧硬编码逐列等价（默认行为不变）。
  - 自定义 workflows 生效；globalTargets 合并；self 被排除；未知 from 列返回仅 globalTargets。
  - `migrateSettings`：缺失 workflows → 补默认；保留 Jira 字段。
- UI（WorkflowEditor）：构建通过 + 手动核对（拖入/移除/切档/恢复默认/保存后看板生效）。

## 涉及文件
- 改：`src/types.ts`、`src/utils/migrateSettings.ts`、`src/settings.ts`、`src/components/App.tsx`、`src/components/Card.tsx`、`src/styles/tailwind.css`（如需 WorkflowEditor 专用类）
- 增：`src/components/WorkflowEditor.tsx`、`src/types`/`src/utils` 单测扩展
