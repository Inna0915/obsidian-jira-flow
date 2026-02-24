# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
