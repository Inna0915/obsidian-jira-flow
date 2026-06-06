# Jira Flow - Obsidian Plugin

将 Jira 项目管理集成到 Obsidian：看板视图、双向同步、每日工作日志、完成标记，以及 Focus View 聚焦视图。报表交给 Obsidian 原生 **Bases / Dataview** 或 AI（Claude Code / Codex）直接查询，插件本身只负责「同步 + 看板 + 记录」。

## 核心理念

**"Markdown as Database"** — 每个 Jira 任务对应一个 Markdown 文件，元数据存在 YAML Frontmatter 里。插件做两件事：

1. 把 Jira 同步成任务 md，并用看板做状态流转；
2. 任务完成时把**结构化标记**写进 frontmatter / 标签 / 日记，供后续直接查询。

> 统计与周报**不再由插件生成** —— 完成数据都在 frontmatter（`completed_at` / `completed_week` / `status` / `due_date`）和 `done/YYYY-Www` 标签里，用 Bases / Dataview / AI 直接查即可（见下方「完成数据查询」）。

## 功能特性

### 看板视图
- 拖拽式任务管理，状态变更自动同步到 Jira
- 泳道分组：逾期 / 按时 / 其他
- 双语列标签（如 "EXECUTION 执行中"）
- 卡片按类型区分样式（Bug / Story）
- 当前迭代 / 待办列表两种视图，支持批量更新截止日期
- Bug 从 FUNNEL/DEFINING 拖出时自动把经办人设为自己
- **流转屏幕**：拖拽触发的 Jira 流转若带屏幕字段，弹出动态表单（解决结果 / 修复版本 / 模块 / 经办人 / 工时 / 备注）后再提交；无屏幕流转静默直通
- 侧边栏详情面板（只读查看 + 编辑故事点/截止日期并同步 Jira）
- 悬停预览

### 完成记录（查询的数据源）
任务被拖到「完成」列时，插件会：
- 在当天 Daily Note 的 `### Work Log` 追加：`- [x] [[Task-Key]] - Summary (JIRA-KEY)`
- 给任务 frontmatter 写入 `completed_at`、`completed_week`，并加 `done/YYYY-Www` 标签
- 拖回未完成列时自动清除以上标记

### Focus View 聚焦视图
- 独立侧边栏视图，活跃 Sprint 过滤、今日/逾期、本周剩余
- 内置 Pomodoro 番茄钟，专注时间记录到任务文件（`focused_minutes` + 时间戳日志）

### Issue Preview / Confluence
- 关联任务浮窗预览；Confluence 链接本地文件解析与智能打开

### Jira 同步
- 基于 `requestUrl` 的 Jira REST（无 CORS）；Agile API（Sprint）+ JQL 回退
- 双向同步（状态转换 / 故事点 / 截止日期）；Wiki 图片转换
- 流转带屏幕字段时弹出动态表单（含 resolution/comment 自愈重试）
- 同步对账：已流转/已解决任务自动隐藏；`statusCategory != Done` 召回残留 resolution 的重开任务

## 完成数据查询（Bases / Dataview）

完成数据是结构化的，直接查询即可，无需插件生成报表。

### 本周完成（DataviewJS）

````markdown
```dataviewjs
function isoWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-((t.getDay()+6)%7));const y=t.getFullYear();const w1=new Date(y,0,4);const w=1+Math.round(((t-w1)/86400000-3+((w1.getDay()+6)%7))/7);return `${y}-W${String(w).padStart(2,"0")}`;}
const week = isoWeek(new Date());
dv.header(3, "本周完成 " + week);
dv.table(["任务", "摘要", "完成日期"],
  dv.pages('"Jira-Flow/Tasks"')
    .where(p => p.completed_week === week)
    .sort(p => p.completed_at, "desc")
    .map(p => [p.jira_key, p.summary, p.completed_at]));
```
````

### 上周完成（DataviewJS）

````markdown
```dataviewjs
function isoWeek(d){const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-((t.getDay()+6)%7));const y=t.getFullYear();const w1=new Date(y,0,4);const w=1+Math.round(((t-w1)/86400000-3+((w1.getDay()+6)%7))/7);return `${y}-W${String(w).padStart(2,"0")}`;}
const week = isoWeek(new Date(Date.now() - 7 * 86400000));
dv.header(3, "上周完成 " + week);
dv.table(["任务", "摘要", "完成日期"],
  dv.pages('"Jira-Flow/Tasks"')
    .where(p => p.completed_week === week)
    .sort(p => p.completed_at, "desc")
    .map(p => [p.jira_key, p.summary, p.completed_at]));
```
````

> 也可用 **Bases** 视图按 `done/2026-W22` 标签或 `completed_week` 字段筛选，或让 Claude Code / Codex 直接读取 `Jira-Flow/Tasks` 下 `completed_week` 匹配的任务来整理周报。

## 项目结构

```
src/
├── main.ts                    # 插件入口，注册命令和视图
├── types.ts                   # 类型 + 看板列定义 + 工作流/泳道纯函数 + 默认设置
├── settings.ts                # 设置界面
├── api/
│   └── jira.ts                # Jira REST API 客户端
├── sync/                      # 唯一的「写」层
│   ├── fileManager.ts         # Jira issue ⇄ 任务 md（Frontmatter）
│   ├── logger.ts              # 完成 → 写 Daily Note Work Log
│   ├── completionTracker.ts   # 完成 → 写 completed_at/week + done/ 标签
│   └── completionMarks.ts     # 纯函数：计算完成标记
├── views/                     # KanbanView / SidebarView（Obsidian ItemView 外壳）
├── components/                # React UI（App/Board/Column/Swimlane/Card/详情/列表/侧栏/预览/HTML）
├── ui/                        # StatusToast / confirmModal
├── utils/                     # dateUtils / migrateSettings / jiraParser / linkHandler / FolderSuggest
└── styles/tailwind.css        # 配色 token（Claude 风，亮/暗跟随 Obsidian 主题）+ Tailwind 源
```

## 数据模型

### 任务文件 Frontmatter

```yaml
---
jira_key: "PROJ-123"
status: "EXECUTION"
mapped_column: "EXECUTION"
issuetype: "Bug"
priority: "High"
story_points: 5
due_date: "2026-02-15"
assignee: "username"
sprint: "Sprint 1"
sprint_state: "active"
completed_at: "2026-05-29"      # 拖到完成列时写入
completed_week: "2026-W22"      # ISO 周
tags:
  - jira/status/execution
  - jira/type/bug
  - done/2026-W22               # 完成时加，便于标签查询
---
```

### Confluence 本地文件 Frontmatter

```yaml
---
confluence_url: "http://wiki.company.com/pages/viewpage.action?pageId=90801066"
confluence_page_id: "90801066"
title: "页面标题"
---
```

## Vault 文件夹结构

```
Vault Root/
├── Jira-Flow/           # 可配置
│   ├── Tasks/           # 任务 Markdown 文件
│   └── Assets/          # 下载的图片附件
└── Daily Notes/         # 可配置
    └── YYYY-MM-DD.md    # 每日工作日志（### Work Log）
```

## 设置面板

- **Jira 连接**：Host、浏览域名、用户名、密码/Token、Project Key、JQL
- **文件夹路径**：Tasks、Daily Notes、Assets（支持自动补全）
- **字段映射**：故事点 / 计划开始 / 截止日期 / Sprint 自定义字段
- **同步**：启动自动同步、定时间隔

## 命令

| 命令 | 说明 |
|------|------|
| Open Kanban Board | 打开看板视图 |
| Open Focus View (Sidebar) | 打开 Focus View 聚焦视图 |
| Sync Now | 立即同步 Jira 数据 |

## 安装

1. 将 `main.js`、`manifest.json`、`styles.css` 复制到 Vault 的 `.obsidian/plugins/obsidian-jira-flow/` 目录
2. 在 Obsidian 设置中启用插件
3. 配置 Jira 连接信息与文件夹路径

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 开发模式（watch）
npm run build    # 生产构建
npm test         # 单元测试（Vitest）
npm run lint     # ESLint（eslint-plugin-obsidianmd）
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 核心 | TypeScript, Obsidian Plugin API |
| UI | React 18, TailwindCSS（`jf-` 前缀） |
| 网络 | Obsidian `requestUrl`（避免 CORS） |
| 文件 | Obsidian `app.vault` & `app.fileManager` |
| 构建 | esbuild + PostCSS |
| 测试 | Vitest |

## 最近更新

### v2.3.0
- **新建任务支持指定迭代**：弹窗新增「迭代 Sprint」下拉（动态拉取、默认活跃 sprint、可选进入 Backlog），聚合项目下所有 scrum 看板的 active+future sprint
- **经办人默认当前用户**：新建任务弹窗与流转屏幕弹窗的「经办人」均默认填为自己

### v2.2.0
- **流转屏幕复刻**：拖拽触发的 Jira 流转若带屏幕字段，弹出动态表单（解决结果 / 修复版本 / 模块 / 经办人 / 工时 / 备注）收集后提交，1:1 还原 Jira「解决」面板；无屏幕流转仍静默直通
- **同步归档对账回归**：同步时自动隐藏「已流转给他人 / 已解决、本次查询未返回」的卡片，重回查询时自动恢复
- **修复重开 Bug 不显示**：同步 JQL 增补 `statusCategory != Done`，按状态召回残留 resolution 的重开任务

### v2.0.0
- **移除 AI 报告生成** 与 AI 模型设置（不再存储 API Key）
- **移除报告中心二级界面**（含农历日历）与 `reportData` 层 —— 统计改用原生 Bases / Dataview / AI 查询
- **移除归档模块** 与**个人/本地任务模块**（彻底清除 LOCAL 概念）
- **新增完成标记**：完成时写 `completed_at` / `completed_week` + `done/YYYY-Www` 标签
- **新配色**：Claude 经典风，亮/暗跟随 Obsidian 主题
- 工程：引入 Vitest 单测、ESLint（eslint-plugin-obsidianmd）合规清零、设置向后兼容迁移

[查看完整更新日志](./CHANGELOG.md)

## License

MIT
