# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.0.3] - 2026-05-30

### Fixed
- 看板列头条与父任务筛选浮窗在暗色下仍发白：带透明度后缀的颜色类（`bg-white/90`、`bg-[#FAFBFC]/95`、`gray-50/50` 等）未被主题接管，现已补齐映射到原生表面色（modal 遮罩 `black/40·80` 保留深色半透明）。
- 看板列头色条改为主题化三档语义色：待办（中性）/ 进行中（珊瑚强调）/ 完成（绿），全部走 CSS 变量，亮暗自适应，不再用旧 Jira 蓝/紫/橙。

## [2.0.2] - 2026-05-30

### Fixed
- 专注视图 / 番茄钟在暗色模式下显示为白色、强调色未跟随主题；亮/暗整体有割裂感。配色改为**表面色绑定 Obsidian 原生主题变量**（背景/卡片/边框/文字自动适配亮/暗/任意主题），仅 **Claude 珊瑚色作为强调色**；蓝→珊瑚、红→error、绿→success、橙/琥珀→warning 统一语义化，专注视图与看板一致。

## [2.0.1] - 2026-05-30

### Fixed
- 从 1.1.0 升级后，磁盘上带 `archived: true` 的历史任务文件因 2.0.0 移除了归档过滤而全部涌现到看板。恢复对旧 `archived` 标志的**只读兼容过滤**（不再写入归档），并让仍在 Jira 查询内的归档任务在下次同步时自动清除该标志重新显示。

## [2.0.0] - 2026-05-30

### Removed
- **AI 报告生成** 与 AI 模型设置（不再存储 API Key）
- **报告中心二级界面**（含农历日历）与 `reportData` 数据层 —— 统计改用原生 Bases / Dataview / AI 查询
- **归档模块**（归档视图、归档命令、`archived` frontmatter）
- **个人/本地任务模块**：彻底清除 `source` / LOCAL 概念、本地任务创建与编辑、本地看板视图

### Added
- **完成标记**：任务拖到完成列时写入 `completed_at` / `completed_week`，并加 `done/YYYY-Www` 标签（移回未完成列自动清除）
- **Claude 经典配色**：暖纸背景 + 珊瑚橙强调，亮/暗模式跟随 Obsidian 主题
- 工程化：Vitest 单元测试、ESLint（eslint-plugin-obsidianmd）合规、设置向后兼容迁移（保留 Jira 配置、丢弃废弃 AI 配置）

### Changed
- `minAppVersion` 提升至 1.7.2
- 报告入口移除，统计交由 Bases / Dataview / AI 查询 frontmatter 与 `done/` 标签

## [1.1.0] - 2026-02-24

### Added
- **FolderSuggest**: 设置面板文件夹选择支持智能自动补全（类似 Daily Notes 插件）
- **Pomodoro 计时器**: Focus View 新增可配置的番茄钟（默认 35 分钟），专注时间自动记录到任务文件
- **活跃 Sprint 过滤**: 侧边栏和报告中心只显示当前活跃 Sprint 的任务
- **双语看板列**: 看板列显示英文+中文双语标签（如 "IN PROGRESS 进行中"）
- **报告任务交互**: 报告中心的任务列表支持点击打开和悬停预览
- **Focus View**: 新增侧边栏聚焦视图，快速查看今日/本周任务
- **Issue Preview**: 点击关联任务可预览详情，支持导航和返回
- **Linked Issues**: 任务预览弹窗显示关联的任务关系（relates to/blocks/is blocked by）
- **Confluence 集成**: 自动解析 Confluence 链接，优先打开本地文件
- **悬停预览**: 任务卡片和链接支持 Obsidian 原生悬停预览
- **Wiki 图片转换**: 自动将 Jira Wiki 图片语法 `!image.png!` 转换为 HTML 图片

### Fixed
- **Windows EBUSY**: 修复 Windows 文件锁问题，添加 300ms I/O 延迟
- **Hover Link**: 修复报告中心任务悬停预览的事件参数格式

## [1.0.0] - 2025-01

### Added
- 初始版本发布
- 看板视图：拖拽式任务管理，状态变更自动同步到 Jira
- 泳道分组：逾期 / 按时 / 其他
- Jira 同步：基于 Obsidian `requestUrl` 的 REST API 集成
- 每日工作日志：任务完成时自动追加到 Daily Note
- 报告中心：农历日历 + 日/周/月/年视图
- AI 报告生成：支持 OpenAI、DeepSeek、Moonshot、Qwen 等多提供商
- 侧边栏详情面板：编辑故事点和截止日期并同步到 Jira
