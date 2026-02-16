# Jira Flow - Obsidian Plugin

将 Jira 项目管理无缝集成到 Obsidian 中。提供看板视图、双向同步、每日工作日志和 AI 驱动的报告生成。

## 核心理念

**"Markdown as Database"** — 每个 Jira 任务对应一个 Markdown 文件，通过 YAML Frontmatter 存储元数据，插件在此基础上提供可视化看板和自动化工作流。

## 功能特性

### 看板视图
- 拖拽式任务管理，状态变更自动同步到 Jira
- 泳道分组：逾期 / 按时 / 其他
- 卡片按类型区分样式（Bug 红色边框背景、Story 绿色边框背景）
- 卡片展示：Jira Key、类型图标、优先级、故事点、截止日期、负责人头像
- 侧边栏详情面板，支持编辑故事点和截止日期并同步到 Jira

### Jira 同步
- 基于 Obsidian `requestUrl` 的 Jira REST API 集成（无 CORS 问题）
- 支持 Agile API（Sprint 模式）和 JQL 回退查询
- 自动检测活跃 Sprint 并过滤当前用户任务
- 双向同步：本地修改可推送回 Jira（状态转换、故事点、截止日期）

### 每日工作日志
- 任务完成时自动追加到当日 Daily Note
- 格式：`- [x] [[Task-Key]] - Summary (JIRA-KEY)`
- 支持自定义 Daily Note 文件夹和日期格式

### 报告中心
- 农历日历（显示农历日期、节日、天干地支年份）
- 左侧周数栏标记已有周报的周（绿色圆点）
- 日 / 周 / 月 / 年四种视图切换
- 每个视图展示：预计完成任务 + 已完成工作 + 工作日志
- 弹窗式报告查看与 AI 生成（周报 / 月报 / 季报 / 年报）

### AI 报告生成
- 支持多种 AI 提供商：OpenAI、DeepSeek、Moonshot (Kimi)、Qwen (通义千问)、自定义
- 自动收集工作日志和任务数据作为上下文
- 可自定义各周期的 Prompt 模板
- 报告保存到 Vault 的 Reports 文件夹

## 项目结构

```
src/
├── main.ts                    # 插件入口，注册命令和视图
├── types.ts                   # TypeScript 类型定义
├── settings.ts                # 设置界面
├── api/
│   └── jira.ts                # Jira REST API 客户端
├── sync/
│   ├── fileManager.ts         # Markdown 文件 CRUD（Frontmatter 管理）
│   ├── logger.ts              # Daily Note 工作日志写入
│   └── workLogService.ts      # 工作日志解析与统计
├── ai/
│   ├── aiService.ts           # AI 模型抽象层（多提供商）
│   └── reportGenerator.ts     # 报告生成编排
├── views/
│   ├── KanbanView.ts          # Obsidian ItemView（React 挂载）
│   └── ArchiveView.ts         # 归档视图
├── components/
│   ├── App.tsx                # React 主容器，路由状态管理
│   ├── Board.tsx              # 看板布局（泳道 + 列）
│   ├── Swimlane.tsx           # 泳道行组件
│   ├── Column.tsx             # 看板列组件
│   ├── Card.tsx               # 任务卡片（Bug/Story 样式区分）
│   ├── TaskDetailModal.tsx    # 侧边栏详情面板（含 Save to Jira）
│   └── ReportCenter.tsx       # 报告中心（农历日历 + 视图切换）
├── ui/
│   └── StatusToast.ts         # Toast 通知
└── styles/
    └── tailwind.css           # Tailwind CSS 源文件
```

## 数据模型

每个任务文件的 Frontmatter 结构：

```yaml
---
jira_key: "PROJ-123"
source: "JIRA"           # JIRA | LOCAL
status: "IN PROGRESS"
mapped_column: "IN PROGRESS"
issuetype: "Bug"          # Bug | Story | Task | Sub-task | Epic
priority: "High"          # Highest | High | Medium | Low | Lowest
story_points: 5
due_date: "2026-02-15"
assignee: "username"
sprint: "Sprint 1"
sprint_state: "active"
tags:
  - jira/status/in-progress
  - jira/type/bug
  - jira/source/jira
---
```

## Vault 文件夹结构

```
Vault Root/
├── Jira-Flow/           # 可配置
│   ├── Tasks/           # 任务 Markdown 文件
│   ├── Reports/         # AI 生成的报告
│   └── Assets/          # 下载的图片附件
└── Daily Notes/         # 可配置
    └── YYYY-MM-DD.md    # 每日工作日志
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 核心 | TypeScript, Obsidian Plugin API |
| UI | React 18, TailwindCSS (jf- 前缀) |
| 网络 | Obsidian `requestUrl`（避免 CORS） |
| 文件 | Obsidian `app.vault` & `app.fileManager` |
| 图标 | Lucide React |
| 构建 | esbuild + PostCSS |
| AI | OpenAI 兼容 API 端点 |

## 安装

1. 将 `main.js`、`manifest.json`、`styles.css` 复制到 Vault 的 `.obsidian/plugins/obsidian-jira-flow/` 目录
2. 在 Obsidian 设置中启用插件
3. 配置 Jira 连接信息（Host、API Token、Project Key）
4. 配置 AI 模型（可选，用于报告生成）

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 编译 Tailwind CSS
npm run css
```

## 命令

| 命令 | 说明 |
|------|------|
| Open Kanban Board | 打开看板视图 |
| Sync Now | 立即同步 Jira 数据 |
| Create Local Task | 创建本地任务 |
| Generate Weekly Report | 生成周报 |
| Generate Monthly Report | 生成月报 |
| Generate Quarterly Report | 生成季报 |
| Generate Yearly Report | 生成年报 |
| Open Archive View | 打开归档视图 |

## License

MIT
