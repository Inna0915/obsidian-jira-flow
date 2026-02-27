---
# === 1. 项目基础信息 (Identity) ===
title: {{title}}
description:
version: 0.1.0
repository:
author: Inna0915
license: MIT

# === 2. 进度与运行状态 (Operational State) ===
type: vibecoding-project # 区分普通的技术笔记和开发项目
status: active           # 用于 Kanban 看板流转: idea, active, paused, done
priority: p1
create_date: {{date}}
last_update: {{date}}

# === 3. AI 上下文与技术栈 (AI Context) ===
tech_stack: [typescript, react, obsidian-api]
ai_tools: []             # 记录当前项目主要使用的 AI 辅助工具
philosophy: Markdown as Database
triggers:
  -

# === 4. Git 统计信息 (Git Stats) ===
total_commits: 0
contributors: []
last_commit_date:
branch: main
---

# {{title}}

## 📊 项目概览 (Project Overview)

```dataviewjs
// MVP 完成度统计
const file = dv.current();
const content = await dv.io.load(file.file.path);
const mvpSection = content.match(/## 2\. MVP 目标[\s\S]*?(?=---)/);
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

- **当前已跑通:**
- **当前卡点:**
- **Next Prompt:**

---

## 2. MVP 目标 (主线任务)
- [ ]
- [ ]

---

## 3. 灵感与优化池 (Backlog)
- [ ]
- [ ]

---

## 4. 技术债务 (Technical Debt)

```dataviewjs
// 自动统计代码中的 TODO/FIXME
const file = dv.current();
dv.paragraph("*由 /project-info skill 自动扫描更新*");
```

### 高优先级
- [ ]

### 中优先级
- [ ]

### 低优先级
- [ ]

---

## 5. 依赖管理 (Dependencies)

### 核心依赖
| 依赖 | 版本 | 用途 | 更新计划 |
|------|------|------|----------|
|      |      |      |          |

### 开发依赖
| 依赖 | 版本 | 用途 |
|------|------|------|
|      |      |      |

### 安全漏洞
- 无已知漏洞

---

## 6. 性能指标 (Performance Metrics)

| 指标 | 当前值 | 目标值 | 备注 |
|------|--------|--------|------|
| 构建时间 | - | < 30s | |
| 包体积 | - | < 500KB | |
| 测试覆盖率 | - | > 80% | |
| 启动时间 | - | < 1s | |

---

## 7. 踩坑日志 & 核心资产 (Dev Log)

### {{date}}
- **避坑记录:**
- **核心代码备份:**

---

## 8. 子模块映射 (MOC)
- [[子模块链接]]

---

## 9. 变更历史 (Recent Changes)

```dataviewjs
// 显示最近 5 次 git commit (需要手动更新或通过 skill 同步)
const file = dv.current();
dv.paragraph(`**Total Commits**: ${file.total_commits}`);
dv.paragraph(`**Last Commit**: ${file.last_commit_date}`);
```

*详见 CHANGELOG.md*
