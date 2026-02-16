---
# Project: Jira-Flow Obsidian Plugin (Specification)

## 1. Project Overview
**Goal**: 将 Jira 项目管理无缝集成到 Obsidian，提供看板视图、双向同步、每日工作日志和 AI 报告生成。
**Philosophy**: "Markdown as Database"。每个任务是一个带 YAML Frontmatter 的 Markdown 文件，插件在此基础上提供 React 看板视图。

**Core Features**:
1. **Jira Sync**: 从 Jira 获取 Issue → 创建/更新 Obsidian 中的 MD 文件，支持双向同步。
2. **Kanban View**: React + Tailwind 看板界面，拖拽管理任务，泳道分组。
3. **Daily Logging**: 任务完成时自动追加工作日志到 Daily Note。
4. **Report Center**: 农历日历 + 日/周/月/年视图 + AI 报告生成。
5. **Task Detail Panel**: 侧边栏详情面板，编辑字段并同步回 Jira。

## 2. Tech Stack & Constraints
- **Core**: TypeScript, Obsidian API (Plugin)
- **UI**: React 18, TailwindCSS (PostCSS/esbuild, `jf-` 前缀)
- **Network**: `requestUrl` (Obsidian API) ONLY. **NO** `axios` or `fetch`
- **File System**: `app.vault` & `app.fileManager` ONLY. **NO** `fs` or `path`
- **Icons**: Lucide React
- **AI**: OpenAI 兼容 API（支持 DeepSeek, Moonshot, Qwen, 自定义）
- **Build**: esbuild + PostCSS

## 3. Data Architecture

### A. Folder Structure
```text
Vault Root
 ├── Jira-Flow/          (可配置)
 │    ├── Tasks/          # 每个任务一个 MD 文件
 │    ├── Reports/        # AI 生成的周报/月报/季报/年报
 │    └── Assets/         # 下载的图片附件
 └── Daily Notes/         (可配置)
      └── YYYY-MM-DD.md   # 每日工作日志
```

### B. Task File Model (Frontmatter)
```yaml
---
jira_key: "PROJ-123"
source: "JIRA"             # JIRA | LOCAL
status: "IN PROGRESS"      # Jira 原始状态
mapped_column: "IN PROGRESS" # 映射到看板列
issuetype: "Bug"           # Bug | Story | Task | Sub-task | Epic
priority: "High"           # Highest | High | Medium | Low | Lowest
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

### C. Daily Note Work Log Format
```markdown
### Work Log
- [x] [[TASK-KEY]] - Summary (JIRA-KEY)
- [ ] JIRA-KEY: Summary
```

## 4. Module Architecture

### 4.1 Plugin Entry (`src/main.ts`)
- 加载设置，初始化核心服务（JiraApi, FileManager, WorkLogger, ReportGenerator）
- 注册视图：KanbanView, ArchiveView
- 注册命令：同步、创建任务、生成报告（周/月/季/年）
- 启动时自动同步 + 定时同步

### 4.2 Jira API (`src/api/jira.ts`)
- 基于 `requestUrl` 的 REST API 客户端
- Basic Auth 认证
- 支持 Agile API（Sprint 模式）和 JQL 回退
- 方法：fetchIssues, updateIssueFields, transitionIssue, getTransitions

### 4.3 Sync Engine (`src/sync/`)
- **fileManager.ts**: Markdown 文件 CRUD，Frontmatter 读写，状态映射
  - `issueToFrontmatter()`: Jira Issue → YAML Frontmatter
  - `syncIssues()`: 批量同步，创建/更新文件
  - 同步时打印所有 customfield_* 字段到控制台（调试用）
- **logger.ts**: 任务完成时追加到 Daily Note 的 `### Work Log` 区块
- **workLogService.ts**: 解析 Daily Note 中的工作日志，统计活跃天数/完成率

### 4.4 AI Service (`src/ai/`)
- **aiService.ts**: 多 AI 提供商抽象（OpenAI, DeepSeek, Moonshot, Qwen, Custom）
- **reportGenerator.ts**: 报告生成编排
  - 收集工作日志 + 任务数据
  - 构建 Prompt（含统计信息）
  - 调用 AI 生成报告
  - 保存到 Reports 文件夹

### 4.5 Views (`src/views/`)
- **KanbanView.ts**: Obsidian ItemView，挂载 React 根组件
- **ArchiveView.ts**: 归档视图

### 4.6 React Components (`src/components/`)

#### App.tsx
- 主容器，管理看板/报告中心的路由切换
- 顶部导航栏（Confluence, Bitbucket, Jira 链接）
- 新建任务弹窗

#### Board.tsx
- 看板布局：泳道（Overdue / On Schedule / Others）× 列
- 拖拽处理：更新 Frontmatter + 调用 Jira API 转换状态

#### Card.tsx
- 任务卡片渲染
- **Bug**: 红色边框 + 浅红背景 (#FFF5F5)
- **Story**: 绿色边框 + 浅绿背景 (#F0FFF4)
- 显示：类型图标、Jira Key、优先级圆点、故事点、截止日期、负责人头像

#### TaskDetailModal.tsx
- 侧边栏详情面板
- 可编辑字段：故事点、截止日期（修改后出现 "Save to Jira" 按钮）
- 本地任务额外可编辑：摘要、描述、类型、优先级
- 显示关联 Issue（Jira 链接）
- 底部操作：Archive（已完成本地任务）、Save to Jira、Open File

#### ReportCenter.tsx
- **左侧日历面板**:
  - 农历信息显示（天干地支年、农历月日、节日标注）
  - 月份导航（年/月前进后退）
  - 日历网格：周数栏 + 7天列，每格显示公历日期 + 农历日期
  - 周数栏绿色圆点标记已有周报的周
  - 日/周/月/年视图切换按钮
- **右侧内容区**:
  - 标题栏：日期标题 + 视图标签 + 报告快捷按钮（查看周报/月报/季报/年报/刷新）
  - 预计完成任务列表（截止日在当前视图范围内的待完成任务）
  - 已完成工作列表
  - 工作日志（按日分组）
- **报告弹窗**:
  - 显示已有报告内容
  - "使用 AI 生成" 按钮

## 5. Kanban Columns
| 列名 | 映射状态 |
|------|---------|
| FUNNEL | Funnel, Backlog, Open |
| TO DO | To Do, Selected for Development |
| READY | Ready, Prepared |
| IN PROGRESS | In Progress, Active |
| IN REVIEW | In Review, Code Review |
| TESTING | Testing, QA, In QA |
| DONE | Done, Completed |
| RESOLVED | Resolved |
| CLOSED | Closed |
| EXECUTED | Executed, Deployed |
| BLOCKED | Blocked, Impediment |
| CANCELLED | Cancelled, Won't Do |

## 6. Settings
- **Jira 配置**: Host URL, Email, API Token, Project Key
- **文件夹路径**: Tasks, Reports, Daily Notes, Assets
- **日期格式**: Daily Note 命名格式 (YYYY-MM-DD)
- **AI 模型**: 多模型管理（名称、提供商、API Key、端点、启用/禁用）
- **报告模板**: 各周期的自定义 Prompt

## 7. Coding Guidelines
- **严格类型**: 禁止 `any`，所有 Jira 响应和 Frontmatter 定义接口
- **错误处理**: 使用 `new Notice("Error message")` 通知用户
- **原子更新**: 更新 Frontmatter 时不覆盖文件正文内容
- **Tailwind 前缀**: 使用 `jf-` 前缀避免与 Obsidian 主题冲突
- **Obsidian 原生**: 仅使用 Obsidian API，不引入外部文件系统或网络库
