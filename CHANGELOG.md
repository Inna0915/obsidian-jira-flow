# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.4.0] - 2026-06-06

### Added
- **Backlog 视图**（替换原「列表」）：左侧 Feature 树 + 右侧按 Sprint 分组的任务清单，参照 Jira / Agile Hive 原生 Backlog。
  - **左侧 Feature**：卡片式，从 Feature 项目（如 PRDAPD）动态拉取，搜索 + 「仅活跃」过滤（关键词匹配双语状态）+ 「未关联」筛选；展开显示**原生统计**（问题/已完成/预估/未预估 + 进度条，懒加载子任务聚合）。
  - **右侧任务**：按 Sprint 分组（活跃置顶、Backlog 置底）、可折叠;「显示已完成」开关实时拉取我的已完成任务（删除线只读行）。
  - **关联 / 解除 Feature**：拖任务到 Feature 卡片关联，chip 上 × 解除。关联走 Agile Hive 看板端点 `PUT /rest/epp/latest/issuelinks/addLink`（绕开 PRDAPD 的 issue 级 LINK_ISSUES 限制），解除走 `DeleteLink.jspa`；自动识别迭代看板 ID。
- 关联/解除后**只刷新单条本地文件**（`syncOneIssue`：已同步则更新该文档、未同步则创建），不跑全量归档对账。
- 设置新增「Feature 项目 Key」「Feature 看板 ID」（均可留空自动推断）。

## [2.3.0] - 2026-06-06

### Added
- **新建任务支持指定迭代（Sprint）**：「新建 Jira 任务」弹窗新增「迭代 Sprint」下拉，动态拉取项目可选 sprint，默认选中活跃 sprint，可选「不指定（进入待办 Backlog）」。
  - sprint 列表**聚合项目下所有 scrum 看板的 active+future sprint 去重**（项目可能有「目标看板/迭代看板」多个 scrum board，规划用的 sprint 在迭代看板上，单一 `detectBoardId` 会漏）。
  - 创建时写入 sprint 字段（`settings.sprintField`，greenhopper gh-sprint 接受 sprint id）。

### Changed
- **经办人默认当前用户**：新建任务弹窗的「经办人」默认预填为自己（仍可清空走自动分配或改派他人）。
- **流转屏幕经办人默认当前用户**：拖拽触发的流转弹窗中，「经办人」字段默认填为自己。

## [2.2.0] - 2026-06-02

### Added
- **流转屏幕（Transition Screen）复刻**：拖拽卡片触发的 Jira 流转若带屏幕字段，会弹出动态表单收集输入后再提交，1:1 还原 Jira 的「解决」面板。
  - 按字段元数据动态渲染：解决结果（必填下拉）、修复版本 / 模块（多选下拉）、经办人（搜索选择）、登记工时（耗时 + 开始时间）、日期/数字/文本通用渲染，**备注**始终可填（作为评论提交）。
  - 不支持的字段类型优雅降级并提示；提交失败/取消自动回滚本地状态。
  - 无屏幕的流转保持静默直通，行为不变。
- API 层新增 `getTransitions`（带 `expand=transitions.fields`）、`pickTransition`、`searchAssignableUsers`、`submitTransition`（含 resolution/comment 不在屏幕时的自愈重试）。

### Fixed
- **同步归档对账**：重构（移除归档模块）后丢失的特性回归——同步时把「本次查询未返回（已流转给他人/已解决）」的本地任务标记 `archived` 隐藏，卡片不再带着旧状态滞留泳道；任务重回查询结果时自动取消归档并刷新。
- **重开的 Bug 不显示**：重开的问题可能残留旧 `resolution`（如状态已是「处理中」但 resolution 仍为「完成」），被 `resolution = Unresolved` 同步查询过滤后又被归档而永久隐藏。同步 JQL 增补 `assignee = currentUser() AND statusCategory != Done` 子句，按状态分类（不依赖 resolution）召回活动中的重开任务；下次同步自动清除其归档与完成标记。
- 流转屏幕表单控件统一为点击展开的下拉样式（修复版本/模块/经办人），并修正暗色主题下原生控件文字截断/失效问题。

## [2.1.2] - 2026-05-30

### Fixed
- Ctrl/Cmd+F 仍影响其他界面：2.1.1 用「handler 返回 true 放行」无效，因为 Obsidian keymap scope 一旦在栈上就会「认领」该组合键、不再下传给编辑器。改为**仅在看板成为激活叶子时才 pushScope、离开时 popScope**（监听 `active-leaf-change`）；不激活时栈上根本没有这个 scope，其他界面 Ctrl+F 完全不受影响。

## [2.1.1] - 2026-05-30

### Fixed
- Ctrl/Cmd+F 之前在全局拦截（document 捕获监听 + 全局 keymap scope），导致其他面板/编辑器的 Ctrl+F 失效。改为**仅当看板视图处于激活状态**时才聚焦看板搜索框，否则放行 —— 其它界面 Ctrl+F 恢复正常。

## [2.1.0] - 2026-05-30

### Added
- **可配置工作流**：设置新增「工作流」标签，用**芯片拖拽**编辑 Story/Bug 看板拖拽流转限制（两档：Bug / 默认）。从列调色板拖入「全局可达列」或「逐列转移规则」即新增，点 × 移除，禁止 self、自动去重；每档「恢复默认」。配置保存即时生效（无需重启），看板拖拽校验与卡片可达提示均跟随。
- **默认配置 = 原有流转逻辑**（STORY/BUG 转移表 + 全局可达列原样内置），升级零行为变化。
- 设置向后兼容：旧 data.json 缺 `workflows` 时按档案补默认，保留既有 Jira 配置。

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
