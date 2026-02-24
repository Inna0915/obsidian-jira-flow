# Jira Flow - Obsidian Plugin

将 Jira 项目管理无缝集成到 Obsidian 中。提供看板视图、双向同步、每日工作日志、AI 驱动的报告生成，以及 Focus View 聚焦视图。

## 核心理念

**"Markdown as Database"** — 每个 Jira 任务对应一个 Markdown 文件，通过 YAML Frontmatter 存储元数据，插件在此基础上提供可视化看板和自动化工作流。

## 功能特性

### 看板视图
- 拖拽式任务管理，状态变更自动同步到 Jira
- 泳道分组：逾期 / 按时 / 其他
- **双语列标签**：看板列显示英文+中文双语标识（如 "IN PROGRESS 进行中"）
- 卡片按类型区分样式（Bug 红色边框背景、Story 绿色边框背景）
- 卡片展示：Jira Key、类型图标、优先级、故事点、截止日期、负责人头像
- 侧边栏详情面板，支持编辑故事点和截止日期并同步到 Jira
- **悬停预览**：鼠标悬停在卡片上可预览任务详情

### Focus View 聚焦视图
- 独立的侧边栏视图（类似 Git 插件）
- **活跃 Sprint 过滤**：只显示当前活跃 Sprint 中的任务
- **今日/逾期**：显示今天到期或已逾期的任务
- **本周剩余**：显示本周内到期的其他任务
- 自动过滤已完成和已归档任务
- **悬停预览**：悬停任务卡片可快速预览内容
- 点击任务卡片直接打开文件

#### Pomodoro 番茄钟
- 内置可配置的番茄钟计时器（默认 35 分钟）
- 支持 +/- 5 分钟快速调整
- 专注时间自动记录到任务文件：
  - 更新 `focused_minutes` frontmatter
  - 在文件末尾追加时间戳日志条目

### Issue Preview 任务预览
- 点击 Linked Issue 打开浮动预览弹窗
- 显示任务详情：状态、负责人、描述、关联任务
- **Linked Issues**：显示关联的任务（relates to/blocks/is blocked by 等）
- **Confluence Pages**：显示关联的 Wiki 页面，支持本地文件解析
- 导航支持：点击关联任务可在预览中切换，带返回按钮

### Confluence 链接集成
- 自动识别 Jira 描述中的 Confluence 链接
- **本地文件解析**：匹配 `confluence_url` 或 `confluence_page_id` frontmatter
- **智能打开**：本地存在时优先打开本地文件，否则打开网页
- **双操作设计**：本地文件可一键切换到网页版本
- **悬停预览**：悬停时显示本地文件的 Obsidian 预览

### Jira 同步
- 基于 Obsidian `requestUrl` 的 Jira REST API 集成（无 CORS 问题）
- 支持 Agile API（Sprint 模式）和 JQL 回退查询
- 自动检测活跃 Sprint 并过滤当前用户任务
- 双向同步：本地修改可推送回 Jira（状态转换、故事点、截止日期）
- **Wiki 图片转换**：自动将 `!image.png!` 转换为 HTML 图片
- **300ms I/O 延迟**：修复 Windows EBUSY 文件锁问题

### 每日工作日志
- 任务完成时自动追加到当日 Daily Note
- 格式：`- [x] [[Task-Key]] - Summary (JIRA-KEY)`
- 支持自定义 Daily Note 文件夹和日期格式

### 报告中心
- 农历日历（显示农历日期、节日、天干地支年份）
- 左侧周数栏标记已有周报的周（绿色圆点）
- 日 / 周 / 月 / 年四种视图切换
- **活跃 Sprint 任务**：报告中心只显示活跃 Sprint 的任务
- 每个视图展示：预计完成任务 + 已完成工作 + 工作日志
- **交互式任务列表**：点击任务打开文件，悬停预览任务内容
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
├── settings.ts                # 设置界面（含 FolderSuggest 集成）
├── api/
│   └── jira.ts                # Jira REST API 客户端（含 remotelink 获取）
├── sync/
│   ├── fileManager.ts         # Markdown 文件 CRUD（Frontmatter 管理）
│   ├── logger.ts              # Daily Note 工作日志写入
│   └── workLogService.ts      # 工作日志解析与统计
├── ai/
│   ├── aiService.ts           # AI 模型抽象层（多提供商）
│   └── reportGenerator.ts     # 报告生成编排
├── views/
│   ├── KanbanView.ts          # 看板视图（React 挂载）
│   ├── ArchiveView.ts         # 归档视图
│   └── SidebarView.ts         # Focus View 侧边栏视图
├── components/
│   ├── App.tsx                # React 主容器，路由状态管理
│   ├── Board.tsx              # 看板布局（泳道 + 列）
│   ├── Swimlane.tsx           # 泳道行组件
│   ├── Column.tsx             # 看板列组件
│   ├── Card.tsx               # 任务卡片（Bug/Story 样式区分）
│   ├── TaskDetailModal.tsx    # 侧边栏详情面板（含 Save to Jira）
│   ├── IssuePreviewModal.tsx  # 任务预览弹窗（含 Linked Issues / Confluence）
│   ├── SidebarPanel.tsx       # Focus View 聚焦视图面板（含 Pomodoro 计时器）
│   ├── JiraHtmlRenderer.tsx   # HTML 渲染器（含链接拦截）
│   ├── JiraAuthImage.tsx      # 认证图片加载组件
│   └── ReportCenter.tsx       # 报告中心（农历日历 + 视图切换 + 任务交互）
├── utils/
│   ├── FolderSuggest.ts       # Obsidian 文件夹自动补全组件
│   ├── jiraParser.ts          # Jira 内容解析工具
│   └── linkHandler.ts         # Confluence 链接本地文件查找
├── ui/
│   └── StatusToast.ts         # Toast 通知
└── styles/
    └── tailwind.css           # Tailwind CSS 源文件
```

## 设置面板

### 智能文件夹选择
- 文件夹路径输入支持**自动补全**（类似 Daily Notes 插件）
- 输入时实时显示匹配的文件夹列表
- 支持键盘导航和选择

### 功能设置
- **Jira 配置**：Host URL、Email、API Token、Project Key
- **文件夹路径**：Tasks、Reports、Daily Notes、Assets（支持自动补全）
- **日期格式**：Daily Note 命名格式 (YYYY-MM-DD)
- **AI 模型**：多模型管理（名称、提供商、API Key、端点、启用/禁用）
- **报告模板**：各周期的自定义 Prompt

## 数据模型

### 任务文件 Frontmatter

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

### Confluence 本地文件 Frontmatter

要实现 Confluence 链接到本地文件的映射，本地文件需要包含以下 frontmatter：

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
4. 配置文件夹路径（支持自动补全输入）
5. 配置 AI 模型（可选，用于报告生成）

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
| Open Focus View (Sidebar) | 打开 Focus View 聚焦视图 |
| Sync Now | 立即同步 Jira 数据 |
| Create Local Task | 创建本地任务 |
| Generate Weekly Report | 生成周报 |
| Generate Monthly Report | 生成月报 |
| Generate Quarterly Report | 生成季报 |
| Generate Yearly Report | 生成年报 |
| Open Archive View | 打开归档视图 |

## 最近更新

### v1.x.x (最新)
- **FolderSuggest**: 设置面板文件夹选择支持智能自动补全
- **Pomodoro 计时器**: Focus View 新增番茄钟，专注时间自动记录到任务文件
- **活跃 Sprint 过滤**: 侧边栏和报告中心只显示当前活跃 Sprint 的任务
- **双语看板列**: 看板列显示英文+中文双语标签
- **报告任务交互**: 报告中心的任务列表支持点击打开和悬停预览
- **Focus View**: 新增侧边栏聚焦视图，快速查看今日/本周任务
- **Issue Preview**: 点击关联任务可预览详情，支持导航和返回
- **Confluence 集成**: 自动解析 Confluence 链接，优先打开本地文件
- **悬停预览**: 任务卡片和链接支持 Obsidian 原生悬停预览
- **Wiki 图片**: 自动转换 Jira Wiki 图片语法 `!image.png!`
- **稳定性**: 修复 Windows EBUSY 文件锁问题

## License

MIT
