---
title: Jira Flow - Obsidian 插件完整技术报告
category: obsidian-plugin
type: technical-spec
version: 1.1.0
date: 2026-02-25
repository: https://github.com/Inna0915/obsidian-jira-flow.git
author: Inna0915
license: MIT
philosophy: Markdown as Database
triggers:
  - "梳理 Jira Flow 项目架构"
  - "分析 obsidian-jira-flow 代码"
  - "Jira Flow 技术报告"
  - "Obsidian Jira 插件实现"
skills_required:
  - typescript
  - react
  - obsidian-api
  - jira-api
description: >
  Comprehensive technical report for the obsidian-jira-flow plugin.
  Covers architecture, core implementation points, data flow, and design decisions.
  Use when analyzing the codebase, onboarding new developers, or documenting
  the "Markdown as Database" approach for Jira-Obsidian integration.
---

# Jira Flow - Obsidian 插件完整技术报告

> 版本：v1.1.0 (2026-02-24)
> 核心理念：**Markdown as Database**

---

## 一、项目概述

### 1.1 产品定位
Jira Flow 是一个将 Jira 项目管理无缝集成到 Obsidian 的插件，提供：
- **可视化看板**：拖拽式任务管理，状态变更自动同步到 Jira
- **双向同步**：本地 ↔ Jira 实时同步
- **工作日志**：任务完成自动记录到 Daily Note
- **AI 报告**：基于工作日志自动生成周报/月报/季报/年报
- **专注视图**：侧边栏快速查看今日/本周待办任务

### 1.2 技术栈
| 层级 | 技术 |
|------|------|
| 核心框架 | TypeScript, Obsidian Plugin API |
| UI 框架 | React 18, TailwindCSS (`jf-` 前缀隔离) |
| 网络请求 | Obsidian `requestUrl` (无 CORS 问题) |
| 文件系统 | Obsidian `app.vault` & `app.fileManager` |
| 图标库 | Lucide React + Emoji |
| 构建工具 | esbuild + PostCSS |
| AI 集成 | OpenAI 兼容 API (多提供商支持) |

---

## 二、架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Obsidian Vault                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Tasks/*.md  │  │ Reports/*.md│  │ Daily Notes │  │  Assets/    │    │
│  │ (任务文件)   │  │ (AI报告)    │  │ (工作日志)   │  │ (图片附件)  │    │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│         │                                                               │
│  ┌──────▼──────────────────────────────────────────────────────────┐   │
│  │                    Jira Flow Plugin Core                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │  FileManager │  │   JiraApi    │  │  ReportGenerator     │  │   │
│  │  │  (文件CRUD)   │  │  (API客户端)  │  │   (AI报告生成)        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │  WorkLogger  │  │WorkLogService│  │     AIService        │  │   │
│  │  │ (日志写入)   │  │ (日志解析)    │  │  (多AI提供商)         │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│  ┌──────▼──────────────────────────────────────────────────────────┐   │
│  │                     React UI Layer                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │   App    │  │  Board   │  │ Sidebar  │  │ ReportCenter   │  │   │
│  │  │ (主容器)  │  │ (看板)   │  │(专注视图)│  │   (报告中心)    │  │   │
│  │  └──────────┘  └────┬─────┘  └──────────┘  └────────────────┘  │   │
│  │  ┌──────────┐  ┌────┴────┐  ┌──────────┐                       │   │
│  │  │   Card   │  │Swimlane │  │ Column   │                       │   │
│  │  │ (任务卡) │  │ (泳道)  │  │ (列)     │                       │   │
│  │  └──────────┘  └─────────┘  └──────────┘                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ REST API
                    ┌──────────▼──────────┐
                    │    Jira Server      │
                    │  (Agile + Core API) │
                    └─────────────────────┘
```

### 2.2 模块职责

| 模块 | 文件路径 | 核心职责 |
|------|----------|----------|
| **入口** | `src/main.ts` | 插件生命周期、服务初始化、命令注册 |
| **类型定义** | `src/types.ts` | 全量 TS 类型、看板配置、状态映射 |
| **设置面板** | `src/settings.ts` | 双 Tab 设置界面、AI 模型管理 |
| **Jira API** | `src/api/jira.ts` | 4 步 Agile 同步、状态转换、字段更新 |
| **文件管理** | `src/sync/fileManager.ts` | Markdown CRUD、Frontmatter 管理 |
| **工作日志** | `src/sync/logger.ts` | Daily Note 日志写入 |
| **日志解析** | `src/sync/workLogService.ts` | 日志收集、统计、热力图数据 |
| **AI 服务** | `src/ai/aiService.ts` | 多提供商 AI 调用 (OpenAI/Claude/Gemini) |
| **报告生成** | `src/ai/reportGenerator.ts` | Prompt 组装、报告保存 |
| **看板视图** | `src/views/KanbanView.ts` | React 挂载容器 |
| **侧边栏** | `src/views/SidebarView.ts` | Focus View 容器 |

---

## 三、核心实现点详解

### 3.1 Jira 同步机制 (4-Step Agile Sync)

```
Step 1: detectBoardId(projectKey)
  ↓ GET /rest/agile/1.0/board?projectKeyOrId={projectKey}
  ↓ 优先选择 scrum 类型看板
  
Step 2: fetchActiveSprint(boardId)
  ↓ GET /rest/agile/1.0/board/{boardId}/sprint?state=active
  ↓ 依次尝试 active → future → closed
  
Step 3: fetchSprintIssues(sprintId)
  ↓ GET /rest/agile/1.0/sprint/{sprintId}/issue
  ↓ JQL: assignee=currentUser() (仅当前用户)
  
Step 4: fetchBacklogIssues(boardId, projectKey)
  ↓ GET /rest/agile/1.0/board/{boardId}/backlog
  ↓ 过滤掉已有 Sprint 的任务（避免重复）
  
合并 & 去重 → 保存到 Markdown → 清理过期任务
```

**关键代码** (`src/api/jira.ts:186-216`):
```typescript
async fetchIssuesAgile(projectKey: string): Promise<{ issues: JiraIssue[]; sprint: JiraSprint | null }> {
  // Step 1: 检测 Board
  const board = await this.detectBoardId(projectKey);
  // Step 2: 获取活跃 Sprint
  const sprint = await this.fetchActiveSprint(board.id);
  // Step 3: 拉取 Sprint 任务
  const sprintIssues = await this.fetchSprintIssues(sprint.id);
  // Step 4: 拉取 Backlog
  const backlogIssues = await this.fetchBacklogIssues(board.id, projectKey);
  // 合并去重
  return { issues: mergeAndDeduplicate(sprintIssues, backlogIssues), sprint };
}
```

### 3.2 状态映射策略 (Status → Column)

采用**三级映射策略** (`src/types.ts:199-206`):

```typescript
export function mapStatusToColumn(jiraStatus: string): string {
  const lower = jiraStatus.toLowerCase().trim();
  // Level 1: 精确匹配
  if (EXACT_STATUS_MAP[lower]) return EXACT_STATUS_MAP[lower];
  // Level 2: 模糊匹配（关键词包含）
  for (const [keyword, columnId] of FUZZY_KEYWORDS) {
    if (lower.includes(keyword)) return columnId;
  }
  // Level 3: 默认回退
  return "TO DO";
}
```

**12 列看板定义** (`src/types.ts:94-107`):
| 列 ID | 显示名称 | 阶段 |
|-------|---------|------|
| FUNNEL | FUNNEL 需求池 | Backlog |
| DEFINING | DEFINING 定义中 | Backlog |
| READY | READY 就绪 | Backlog |
| TO DO | TO DO 待办 | Todo |
| EXECUTION | EXECUTION 执行中 | Active |
| EXECUTED | EXECUTED 已构建 | Active |
| TESTING & REVIEW | TESTING & REVIEW 测试审核 | Testing |
| TEST DONE | TEST DONE 测试完成 | Testing |
| VALIDATING | VALIDATING 验收中 | Validate |
| RESOLVED | RESOLVED 已解决 | Done |
| DONE | DONE 已完成 | Done |
| CLOSED | CLOSED 已关闭 | Done |

### 3.3 泳道分类逻辑

基于 `dueDate` 的三泳道架构 (`src/types.ts:252-260`):

```typescript
export function classifySwimlane(dueDate: string, mappedColumn: string): SwimlaneType {
  if (!dueDate) return "others";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  // 逾期且未完成 → overdue
  if (due < today && !DONE_COLUMNS.has(mappedColumn)) return "overdue";
  // 按时或已完成 → onSchedule
  return "onSchedule";
}
```

| 泳道 | 规则 | 颜色 |
|------|------|------|
| overdue | 截止日 < 今天 且未完成 | 红色 #FFEBE6 |
| onSchedule | 截止日 ≥ 今天 或已完成 | 蓝绿 #E6FCFF |
| others | 无截止日期 | 灰色 #F4F5F7 |

### 3.4 拖拽状态转换 (拖拽 → Jira)

**转换匹配逻辑** (`src/api/jira.ts:245-351`):

```typescript
async transitionIssue(issueKey: string, targetColumnId: string) {
  // 1. 获取可用转换
  const { transitions } = await this.request(`issue/${issueKey}/transitions`);
  
  // 2. 三级匹配策略
  let target = transitions.find(t => mapStatusToColumn(t.to.name) === targetColumnId);  // 精确匹配
  if (!target) target = transitions.find(t => t.to.name.toUpperCase() === targetColumnId.toUpperCase());  // 直接匹配
  if (!target) target = transitions.find(t => t.name.toLowerCase().includes(colLower));  // 模糊匹配
  
  // 3. 执行转换（自动注入 Resolution 字段）
  const transitionBody = { transition: { id: target.id } };
  if (DONE_COLUMNS.has(targetColumnId)) {
    transitionBody.fields = { resolution: { name: "Done" } };
  }
  await this.request(`issue/${issueKey}/transitions`, "POST", transitionBody);
}
```

**工作流验证** (`src/types.ts:209-247`):
- Story 和 Bug 有不同的允许转换路径
- 本地任务 (source=LOCAL) 可自由拖拽不受限制

### 3.5 Markdown 文件结构

**任务文件 Frontmatter**:
```yaml
---
jira_key: "PROJ-123"
source: "JIRA"           # JIRA | LOCAL
status: "IN PROGRESS"
mapped_column: "EXECUTION"
issuetype: "Bug"
priority: "High"
story_points: 5
due_date: "2026-02-15"
assignee: "username"
sprint: "Sprint 1"
sprint_state: "active"
tags:
  - jira/status/in-progress
  - jira/type/bug
  - jira/source/jira
summary: "任务摘要"
created: "2026-01-01T00:00:00.000Z"
updated: "2026-02-20T00:00:00.000Z"
---
<!-- 任务描述（HTML 格式，从 Jira 同步）-->
```

**文件命名格式** (`src/sync/fileManager.ts:225-243`):
```typescript
private getTaskFilePath(key: string, summary?: string): string {
  if (summary) {
    // 新格式: jira_key-summary.md
    const sanitizedSummary = this.sanitizeFilename(summary);
    return normalizePath(`${this.plugin.settings.tasksFolder}/${key}-${sanitizedSummary}.md`);
  }
  // 旧格式: jira_key.md (fallback)
  return normalizePath(`${this.plugin.settings.tasksFolder}/${key}.md`);
}
```

### 3.6 工作日志系统

**日志写入** (`src/sync/logger.ts:15-55`):
```typescript
async logWork(taskFile: TFile): Promise<void> {
  const dailyNote = await this.getOrCreateDailyNote();
  const logEntry = `- [x] [[${taskFile.basename}]] - ${fm.summary} (${fm.jira_key})`;
  
  // 查找或创建 ### Work Log 区块
  if (content.includes(workLogHeader)) {
    // 追加到现有区块
  } else {
    // 创建新区块
  }
}
```

**日志格式**:
```markdown
### Work Log
- [x] [[PROJ-123-任务摘要]] - 任务摘要 (PROJ-123)
- [ ] [[LOCAL-1234567890-本地任务]] - 本地任务 (LOCAL-1234567890)
```

### 3.7 AI 报告生成

**数据收集流程** (`src/ai/reportGenerator.ts:22-61`):
```typescript
async generateReport(period: ReportPeriod, options?) {
  // 1. 获取日期范围
  const { start, end } = this.getPeriodRange(period);
  
  // 2. 收集工作日志
  const logs = await this.workLogService.collectLogs(start, end);
  
  // 3. 收集当前任务
  const taskSummaries = this.collectTaskSummaries();
  
  // 4. 获取统计数据
  const stats = await this.workLogService.getStats(start, end);
  
  // 5. 构建 Prompt
  const userContent = this.buildPromptContent(period, logs, taskSummaries, stats);
  const systemPrompt = this.getSystemPrompt(period);
  
  // 6. 调用 AI
  const response = await this.aiService.chat(activeModel, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]);
  
  // 7. 保存报告
  return await this.saveReport(period, response.content, end);
}
```

**AI 提供商支持** (`src/ai/aiService.ts`):
| 提供商 | Base URL | 认证方式 |
|--------|----------|----------|
| Kimi (Moonshot) | https://api.moonshot.cn/v1 | Bearer Token |
| Gemini (Google) | https://generativelanguage.googleapis.com/v1beta | API Key |
| Claude (Anthropic) | https://api.anthropic.com/v1 | x-api-key |
| Custom | 自定义 | Bearer Token |

### 3.8 专注视图 (Focus View) 与番茄钟

**任务过滤逻辑** (`src/components/SidebarPanel.tsx:192-212`):
```typescript
// 今日/逾期任务（活跃 Sprint 中）
const todayTasks = tasks.filter(t => {
  if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate);
  return due.getTime() <= now.getTime() && !isDone(t.status);
});

// 本周剩余任务
const weekTasks = tasks.filter(t => {
  if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate);
  return due.getTime() > now.getTime() && due <= endOfWeek && !isDone(t.status);
});
```

**番茄钟实现** (`src/components/SidebarPanel.tsx:22-181`):
- 默认时长：35 分钟（可配置）
- 快速调整：±5 分钟
- 专注记录：自动写入任务文件的 `focused_minutes` frontmatter + 正文日志

### 3.9 报告中心与农历日历

**日历组件** (`src/components/ReportCenter.tsx:10-151`):
- 内置农历算法（无需外部库）
- 支持天干地支、生肖、节气、节日
- 四级视图切换：日/周/月/年
- 周数栏绿色圆点标记已有周报

**任务交互**:
- 点击任务 → 打开文件
- 悬停任务 → Obsidian 原生预览

### 3.10 Confluence 链接集成

**本地文件匹配** (`src/components/IssuePreviewModal.tsx:70-104`):
```typescript
// 通过 frontmatter 匹配本地 Confluence 文件
const findLocalWikiFile = (href: string): TFile | null => {
  const targetPageId = new URL(href).searchParams.get('pageId');
  
  for (const file of plugin.app.vault.getMarkdownFiles()) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter) {
      const fmUrl = cache.frontmatter['confluence_url'];
      const fmPageId = cache.frontmatter['confluence_page_id'];
      
      if ((fmUrl && fmUrl === href) || 
          (targetPageId && fmPageId && String(fmPageId) === String(targetPageId))) {
        return file;
      }
    }
  }
  return null;
};
```

**双操作设计**:
1. 本地存在 → 优先打开本地文件 + 支持悬停预览
2. 一键切换 → 在浏览器中打开网页版本

---

## 四、数据流全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         数据流向全景图                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                                                       │
│  │  Jira Server │                                                       │
│  └──────┬───────┘                                                       │
│         │ 1. Agile API 同步                                              │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Sync Process                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ detectBoard │→ │fetchSprint  │→ │ fetchSprintIssues       │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │         │                                   │                    │   │
│  │         ▼                                   ▼                    │   │
│  │  ┌─────────────┐  ┌─────────────────────────────────────────┐   │   │
│  │  │fetchBacklog │→ │ merge & deduplicate → save to Markdown │   │   │
│  │  └─────────────┘  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ▼ 2. Markdown 文件                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Markdown Files                              │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  Frontmatter: jira_key, status, sprint, story_points...   │  │   │
│  │  │  Body: HTML Description                                   │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ▼ 3. 看板渲染                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      React Kanban UI                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │   classify  │→ │  map to     │→ │ render Swimlane × 3     │  │   │
│  │  │   swimlane  │   │  12 columns │   │  (overdue/onSchedule)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ▼ 4. 拖拽交互                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Drag & Drop                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │   onDrop    │→ │  transition │→ │ update local file       │  │   │
│  │  │             │   │  Jira API   │   │ (status + mapped_column)│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ▼ 5. 工作日志                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Work Logging                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ task moved  │→ │   to DONE   │→ │ logWork() → Daily Note  │  │   │
│  │  │  to DONE    │   │             │   │ ### Work Log section    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                                │
│         ▼ 6. AI 报告                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      AI Report Generation                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ collectLogs │→ │ buildPrompt │→ │ AIService.chat()        │  │   │
│  │  │ getTasks    │   │ + templates │   │ → save to Reports/*.md  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 五、关键设计决策

### 5.1 为什么使用 Markdown 作为数据库？
1. **Obsidian 原生**：完全利用 Obsidian 的文件系统和缓存
2. **可移植性**：任务文件可在任何 Markdown 编辑器打开
3. **版本控制**：与 Git 天然兼容
4. **双向同步**：Frontmatter 作为结构化数据，正文作为富文本内容

### 5.2 为什么使用 requestUrl 而不是 fetch？
- **无 CORS**：Obsidian 的 `requestUrl` 不受浏览器 CORS 限制
- **认证简化**：可直接附加 Basic Auth 头
- **环境一致**：在桌面和移动端表现一致

### 5.3 为什么使用 Tailwind 前缀 `jf-`？
- **样式隔离**：避免与 Obsidian 主题或其他插件冲突
- **构建优化**：PostCSS 只处理带前缀的类名
- **可维护性**：清晰的插件样式边界

### 5.4 Windows EBUSY 修复
**问题**：Windows 文件锁导致连续读写失败
**解决** (`src/sync/fileManager.ts:184-185`):
```typescript
// CRITICAL FIX: Wait 300ms for Windows and Obsidian to release the file lock
await new Promise(resolve => setTimeout(resolve, 300));
```

---

## 六、扩展点与二次开发

### 6.1 添加新的 AI 提供商
在 `src/ai/aiService.ts` 中添加新的调用方法：
```typescript
private async callNewProvider(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
  // 实现调用逻辑
}
```

### 6.2 自定义状态映射
在 `src/types.ts` 的 `EXACT_STATUS_MAP` 或 `FUZZY_KEYWORDS` 中添加映射规则。

### 6.3 添加新的报告周期
1. 在 `ReportPeriod` 类型中添加新周期
2. 在 `reportGenerator.ts` 中添加日期范围计算
3. 在设置面板中添加对应 Prompt 模板

---

## 七、项目文件结构

```
obsidian-jira-flow/
├── src/
│   ├── main.ts                    # 插件入口
│   ├── types.ts                   # 类型定义 + 配置常量
│   ├── settings.ts                # 设置面板
│   ├── api/
│   │   └── jira.ts                # Jira REST API 客户端
│   ├── sync/
│   │   ├── fileManager.ts         # 文件 CRUD
│   │   ├── logger.ts              # 工作日志写入
│   │   └── workLogService.ts      # 日志解析统计
│   ├── ai/
│   │   ├── aiService.ts           # AI 多提供商抽象
│   │   └── reportGenerator.ts     # 报告生成编排
│   ├── views/
│   │   ├── KanbanView.ts          # 看板视图容器
│   │   ├── ArchiveView.ts         # 归档视图
│   │   └── SidebarView.ts         # 专注视图容器
│   ├── components/
│   │   ├── App.tsx                # React 主容器
│   │   ├── Board.tsx              # 看板布局
│   │   ├── Swimlane.tsx           # 泳道组件
│   │   ├── Column.tsx             # 列组件
│   │   ├── Card.tsx               # 任务卡片
│   │   ├── TaskDetailModal.tsx    # 详情面板
│   │   ├── IssuePreviewModal.tsx  # 任务预览弹窗
│   │   ├── SidebarPanel.tsx       # 专注视图面板
│   │   ├── ReportCenter.tsx       # 报告中心
│   │   ├── JiraHtmlRenderer.tsx   # HTML 渲染器
│   │   └── JiraAuthImage.tsx      # 认证图片组件
│   ├── utils/
│   │   ├── FolderSuggest.ts       # 文件夹自动补全
│   │   ├── jiraParser.ts          # Sprint 解析器
│   │   └── linkHandler.ts         # 链接处理
│   ├── hooks/
│   │   └── useEscapeKey.ts        # ESC 快捷键 Hook
│   ├── ui/
│   │   └── StatusToast.ts         # 状态提示
│   └── styles/
│       └── tailwind.css           # Tailwind 源文件
├── package.json
├── manifest.json                  # Obsidian 插件清单
├── esbuild.config.mjs             # 构建配置
├── tailwind.config.js             # Tailwind 配置
└── styles.css                     # 编译后的样式
```

---

## 八、总结

Jira Flow 是一个功能完整的 Obsidian 插件，通过"Markdown as Database"的核心理念，实现了：

1. **完整的敏捷工作流**：12 列看板 + 3 泳道 + 状态转换验证
2. **无缝的 Jira 集成**：4 步 Agile 同步 + 双向状态更新
3. **智能的报告系统**：AI 驱动 + 农历日历 + 日/周/月/年视图
4. **贴心的效率工具**：番茄钟 + 专注视图 + 自动工作日志
5. **完善的生态连接**：Confluence 集成 + 关联任务导航

代码架构清晰，模块职责单一，类型定义完整，是 Obsidian 插件开发的优秀范例。
