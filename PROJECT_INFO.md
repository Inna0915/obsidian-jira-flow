---
# === 1. 项目基础信息 (Identity) ===
title: obsidian-jira-flow
description: Jira-Flow plugin for Obsidian - Kanban board with Jira sync
version: 1.1.0
repository: https://github.com/Inna0915/obsidian-jira-flow
author: Inna0915
license: MIT
tags: [vibecoding, obsidian-plugin]
project_root:              # 代码仓库本地绝对路径

# === 2. 进度与运行状态 (Operational State) ===
type: vibecoding-project
status: active
priority: p1
create_date: 2025-01-01
last_update: 2026-02-27
total_commits_note: "feat: Daily Note Work Log + bug fixes"

# === 3. AI 上下文与技术栈 (AI Context) ===
tech_stack: [typescript, react, obsidian-api, tailwindcss, lucide-react]
ai_tools: [claude]
ai_model: claude-opus-4
ai_triggers:
  - Jira 任务同步
  - 看板拖拽操作
  - AI 报告生成

# === 4. Git 统计信息 (Git Stats) ===
total_commits: 43
contributors: [wangph]
last_commit_date: 2026-02-24
branch: main
---

# obsidian-jira-flow

## 📊 项目概览 (Project Overview)

```dataviewjs
// MVP 完成度统计
const file = dv.current();
const content = await dv.io.load(file.file.path);
const mvpSection = content.match(/## 2\. MVP 目标[\s\S]*?(?=## \d+\.)/);
if (mvpSection) {
    const tasks = mvpSection[0].match(/- \[(x| )\]/g) || [];
    const completed = tasks.filter(t => t.includes('x')).length;
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    dv.paragraph(`
**MVP 进度**: ${completed}/${total} (${percentage}%)
**项目状态**: ${file.status}
**最后更新**: ${file.last_update}
**技术栈**: ${file.tech_stack.join(', ')}
    `);
}
```

---

## 1. 上下文锚点 (Context Snapshot)
> 复制本区块发给 AI，快速恢复记忆

- **当前分支:** main
- **当前已跑通:** 看板视图、Jira 双向同步、Focus View、Pomodoro 计时器、AI 报告生成、Confluence 集成、Daily Note Work Log
- **当前卡点:** 需要添加移动端适配支持
- **关键决策:** 选择 requestUrl 而非 fetch 绕过 CORS；esbuild 替代 webpack 构建
- **相关文件:** src/components/Board.tsx, src/api/jira.ts, src/views/KanbanView.ts
- **Next Prompt:** 实现响应式布局,优先适配 iPad 尺寸

---

## 2. MVP 目标 (主线任务)

### 核心功能 (已完成)
- [x] 看板视图 - 拖拽式任务管理，状态变更自动同步到 Jira
- [x] 泳道分组 - 逾期/按时/其他任务分类
- [x] 双语列标签 - 看板列显示英文+中文双语标识
- [x] 任务卡片样式 - Bug 红色边框、Story 绿色边框
- [x] 侧边栏详情面板 - 编辑故事点和截止日期并同步到 Jira
- [x] 悬停预览 - 鼠标悬停任务卡片预览详情
- [x] 搜索功能 - Ctrl+F 快速呼出，支持匹配数量显示和上下导航

### Focus View (已完成)
- [x] 独立侧边栏视图 - 类似 Git 插件的侧边栏
- [x] 活跃 Sprint 过滤 - 只显示当前活跃 Sprint 任务
- [x] 今日/逾期任务 - 显示今天到期或已逾期的任务
- [x] 本周剩余任务 - 显示本周内到期的其他任务
- [x] Pomodoro 番茄钟 - 内置可配置计时器（默认 35 分钟）
- [x] 专注时间记录 - 自动更新 focused_minutes 和追加时间戳日志

### Jira 同步 (已完成)
- [x] REST API 集成 - 基于 Obsidian requestUrl（无 CORS 问题）
- [x] Agile API 支持 - Sprint 模式和 JQL 回退查询
- [x] 双向同步 - 状态转换、故事点、截止日期推送回 Jira
- [x] Wiki 图片转换 - 自动将 !image.png! 转换为 HTML 图片
- [x] Windows 文件锁修复 - 300ms I/O 延迟解决 EBUSY 问题
- [x] Daily Note Work Log - 任务拖到完成列自动记录到日记，集成 Periodic Notes/Templater

### 任务预览 (已完成)
- [x] Issue Preview 弹窗 - 点击 Linked Issue 打开浮动预览
- [x] Linked Issues - 显示关联任务（relates to/blocks/is blocked by）
- [x] Confluence Pages - 显示关联的 Wiki 页面
- [x] 导航支持 - 预览中切换关联任务，带返回按钮

### Confluence 集成 (已完成)
- [x] 自动识别链接 - 解析 Jira 描述中的 Confluence 链接
- [x] 本地文件解析 - 匹配 confluence_url 或 confluence_page_id
- [x] 智能打开 - 优先打开本地文件，否则打开网页
- [x] 双操作设计 - 本地文件可一键切换到网页版本
- [x] 悬停预览 - 显示本地文件的 Obsidian 预览

### 报告中心 (已完成)
- [x] 农历日历 - 显示农历日期、节日、天干地支年份
- [x] 周数栏标记 - 绿色圆点标记已有周报的周
- [x] 多视图切换 - 日/周/月/年四种视图
- [x] 活跃 Sprint 任务 - 报告中心只显示活跃 Sprint 的任务
- [x] 交互式任务列表 - 点击打开文件，悬停预览内容

### AI 报告生成 (已完成)
- [x] 多提供商支持 - OpenAI、DeepSeek、Moonshot、Qwen、自定义
- [x] 自动收集上下文 - 工作日志和任务数据
- [x] 自定义 Prompt - 各周期的模板可配置
- [x] 报告保存 - 自动保存到 Vault 的 Reports 文件夹

### 设置面板 (已完成)
- [x] FolderSuggest - 文件夹路径输入支持自动补全
- [x] 智能文件夹选择 - 实时显示匹配的文件夹列表
- [x] 多模型管理 - AI 模型的增删改查

### 待实现功能
- [ ] 移动端适配 - 响应式布局优化
- [ ] 离线模式 - 本地缓存和离线编辑支持
- [ ] 批量操作 - 多任务批量状态更新
- [ ] 自定义字段 - 支持 Jira 自定义字段映射
- [ ] 通知系统 - 任务到期提醒和状态变更通知

---

## 3. 灵感与优化池 (Backlog)
- [ ] 看板视图支持多项目切换
- [ ] 添加任务时间线视图（甘特图）
- [ ] 集成 GitHub Issues 同步
- [ ] 支持子任务的层级展示
- [ ] 添加任务模板功能
- [ ] 看板列自定义排序规则
- [ ] 导出功能（PDF/Excel）
- [ ] 团队协作模式（多用户）

---

## 4. AI 协作日志 (AI Collaboration Log)
> Vibe Coding 核心资产：记录关键 prompt 及 AI 产出

### 2026-02-27
| Prompt 摘要 | 模型 | 产出质量 | 采纳 | 备注 |
|-------------|------|----------|------|------|
| Daily Note Work Log 集成 | claude-opus-4 | ⭐⭐⭐⭐⭐ | ✅ | 拖拽完成自动记录日记 |
| 修复 logWork 触发条件+KanbanView Scope | claude-opus-4 | ⭐⭐⭐⭐⭐ | ✅ | Story→EXECUTED Bug→TESTING |

### 2026-02-26
| Prompt 摘要 | 模型 | 产出质量 | 采纳 | 备注 |
|-------------|------|----------|------|------|
| project-info skill 自动更新 | claude-opus-4 | ⭐⭐⭐⭐⭐ | ✅ | 模板对齐 |
| 修复报告悬浮窗文件查找bug | claude-opus-4 | ⭐⭐⭐⭐⭐ | ✅ | 文件名格式变更兼容 |

- **关键 Prompt:**
- **AI 建议（已采纳）:** requestUrl 替代 fetch 解决 CORS
- **AI 建议（已拒绝 & 原因）:**

---

## 5. 技术债务 (Technical Debt)

```dataviewjs
// 自动统计代码中的 TODO/FIXME
const file = dv.current();
dv.paragraph("*由 /project-info skill 自动扫描更新 (2026-02-25 14:30)*");
```

### 高优先级
- [ ] 暂无

### 中优先级
- [ ] src/types.ts:289 - 删除每条记录开头的英文-数字任务编号（如 PRDAPD-704、WMS-123）
- [ ] src/types.ts:311 - 删除每条记录开头的英文-数字任务编号（如 PRDAPD-704、WMS-123）

### 低优先级
- [ ] 暂无

---

## 6. 依赖管理 (Dependencies)

### 核心依赖
| 依赖 | 版本 | 用途 | 更新计划 |
|------|------|------|----------|
| react | ^18.2.0 | UI 框架 | 稳定版本 |
| react-dom | ^18.2.0 | React DOM 渲染 | 稳定版本 |
| lucide-react | ^0.312.0 | 图标库 | 定期更新 |
| html-react-parser | ^5.2.17 | HTML 解析 | 稳定版本 |
| obsidian | latest | 插件 API | 跟随官方 |

### 开发依赖
| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.3.3 | 类型检查 |
| esbuild | ^0.19.12 | 构建工具 |
| tailwindcss | ^3.4.1 | CSS 框架 |
| @types/react | ^18.2.48 | React 类型定义 |
| @types/node | ^20.11.0 | Node 类型定义 |

### 安全漏洞
- 无已知漏洞

---

## 7. 性能指标 (Performance Metrics)

| 指标 | 当前值 | 目标值 | 备注 |
|------|--------|--------|------|
| 构建时间 | ~10s | < 15s | esbuild 构建 |
| 包体积 | 319KB | < 500KB | ✅ 符合预期 |
| 测试覆盖率 | - | > 80% | 待添加测试 |
| 启动时间 | < 1s | < 1s | ✅ 插件加载快速 |
| 看板渲染 | < 500ms | < 500ms | React 虚拟化优化 |

---

## 8. 踩坑日志 & 核心资产 (Dev Log)

### 2026-02-27
- **避坑记录:** 1) `KanbanView.ts` 未导入 `Scope` 类导致看板无法打开。 2) `logWork` 触发条件仅判断 DONE/CLOSED，实际 Story 完成节点是 EXECUTED、Bug 是 TESTING & REVIEW。 3) `executeCommandById` 创建日记会打开/导航到文件，改为直接读取 Periodic Notes 配置的模板 + `vault.create()` 后台创建。 4) `handleCardMove` 中 `logWork` 传入的 frontmatter 可能因 metadataCache 时序竞争而为 null，改为直接传递已有的 fm 数据。
- **核心代码备份:**
  - `src/views/KanbanView.ts` - 修复 Scope import
  - `src/components/App.tsx` - 按任务类型判定 Work Log 触发列
  - `src/sync/logger.ts` - 后台创建日记，不打开文件

### 2026-02-26
- **避坑记录:** 文件名从 `key.md` 改为 `key-summary.md` 后，报告中心的悬浮预览和点击跳转失效。原因是 `getFirstLinkpathDest(taskKey)` 按文件名匹配，新格式无法命中。修复方案：新增 `FileManager.findTaskFileByKey()` 公开方法，通过文件名前缀+frontmatter 匹配，兼容新旧格式。
- **核心代码备份:**
  - `src/sync/fileManager.ts` - 新增 `findTaskFileByKey()` 公开方法
  - `src/components/ReportCenter.tsx` - 修复 `onHoverTask`/`onClickTask` 文件查找

### 2026-02-25
- **避坑记录:** 测试 project-info skill 的更新功能
- **核心代码备份:** 无

### 2026-02-24
- **避坑记录:** Windows EBUSY 文件锁问题，通过添加 300ms I/O 延迟解决
- **核心代码备份:**
  - `src/sync/fileManager.ts` - 文件管理和 Frontmatter 操作
  - `src/api/jira.ts` - Jira REST API 客户端
  - `src/components/Board.tsx` - 看板核心逻辑

### 2026-01-15
- **避坑记录:** Obsidian requestUrl 解决 CORS 问题，避免使用 fetch
- **核心代码备份:**
  - `src/views/KanbanView.ts` - 看板视图注册
  - `src/components/SidebarPanel.tsx` - Focus View 实现

---

## 9. 子模块映射 (MOC)
- [[Work Log 自动记录]] - sync/logger.ts\n- [[看板视图实现]] - Board.tsx, Column.tsx, Card.tsx
- [[Jira API 集成]] - api/jira.ts
- [[文件管理系统]] - sync/fileManager.ts
- [[AI 报告生成]] - ai/aiService.ts, ai/reportGenerator.ts
- [[Focus View]] - views/SidebarView.ts, components/SidebarPanel.tsx
- [[Confluence 集成]] - utils/linkHandler.ts

---

## 10. 变更历史 (Recent Changes)

```dataviewjs
// 显示最近 5 次 git commit (需要手动更新或通过 skill 同步)
const file = dv.current();
dv.paragraph(`**Total Commits**: ${file.total_commits}`);
dv.paragraph(`**Last Commit**: ${file.last_commit_date}`);
dv.paragraph(`**Contributors**: ${file.contributors.join(', ')}`);
```

### v1.1.0 (2026-02-27)
- Daily Note Work Log: 任务拖拽到完成列自动记录到日记（Story→EXECUTED, Bug→TESTING & REVIEW）
- Periodic Notes 集成: 后台创建日记文件，支持 Templater 模板
- 修复报告悬浮窗: 新文件名格式下文件查找失效问题
- 修复 KanbanView: Scope 未导入导致看板无法打开

### v1.0.0 (2026-02-26)
- FolderSuggest: 设置面板文件夹选择支持智能自动补全
- Pomodoro 计时器: Focus View 新增番茄钟
- 活跃 Sprint 过滤: 侧边栏和报告中心只显示当前活跃 Sprint 的任务
- 双语看板列: 看板列显示英文+中文双语标签
- 报告任务交互: 报告中心的任务列表支持点击打开和悬停预览
- 搜索功能: Ctrl+F 快速呼出搜索框，支持匹配数量显示、上下导航和自动滚动定位

*详见 [CHANGELOG.md](./CHANGELOG.md)*
