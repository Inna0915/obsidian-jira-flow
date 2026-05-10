// scripts/verify-ebusyRetryAndMoveDedup.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// scripts/obsidianStub.ts
var TFile = class {
};
function normalizePath(path) {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

// src/types.ts
var BUILTIN_MODELS = [
  {
    id: "kimi-default",
    name: "moonshot-v1-8k",
    displayName: "Kimi (Moonshot)",
    provider: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKey: "",
    model: "moonshot-v1-8k",
    enabled: false
  },
  {
    id: "gemini-default",
    name: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-2.0-flash",
    enabled: false
  },
  {
    id: "claude-default",
    name: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    provider: "claude",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    model: "claude-sonnet-4-20250514",
    enabled: false
  }
];
var KANBAN_COLUMNS = [
  { id: "FUNNEL", label: "FUNNEL \u9700\u6C42\u6C60", phase: "Backlog", color: "#F4F5F7", headerColor: "#6B778C" },
  { id: "DEFINING", label: "DEFINING \u5B9A\u4E49\u4E2D", phase: "Backlog", color: "#F4F5F7", headerColor: "#6B778C" },
  { id: "READY", label: "READY \u5C31\u7EEA", phase: "Backlog", color: "#DFE1E6", headerColor: "#42526E" },
  { id: "TO DO", label: "TO DO \u5F85\u529E", phase: "Todo", color: "#DFE1E6", headerColor: "#42526E" },
  { id: "EXECUTION", label: "EXECUTION \u6267\u884C\u4E2D", phase: "Active", color: "#DEEBFF", headerColor: "#0052CC" },
  { id: "EXECUTED", label: "EXECUTED \u5DF2\u6784\u5EFA", phase: "Active", color: "#DEEBFF", headerColor: "#0052CC" },
  { id: "TESTING & REVIEW", label: "TESTING & REVIEW \u6D4B\u8BD5\u5BA1\u6838", phase: "Testing", color: "#EAE6FF", headerColor: "#6554C0" },
  { id: "TEST DONE", label: "TEST DONE \u6D4B\u8BD5\u5B8C\u6210", phase: "Testing", color: "#EAE6FF", headerColor: "#6554C0" },
  { id: "VALIDATING", label: "VALIDATING \u9A8C\u6536\u4E2D", phase: "Validate", color: "#FFF0B3", headerColor: "#FF8B00" },
  { id: "RESOLVED", label: "RESOLVED \u5DF2\u89E3\u51B3", phase: "Done", color: "#E3FCEF", headerColor: "#006644" },
  { id: "DONE", label: "DONE \u5DF2\u5B8C\u6210", phase: "Done", color: "#E3FCEF", headerColor: "#006644" },
  { id: "CLOSED", label: "CLOSED \u5DF2\u5173\u95ED", phase: "Done", color: "#E3FCEF", headerColor: "#006644" }
];
var COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);
var EXACT_STATUS_MAP = {
  "funnel": "FUNNEL",
  "funnel \u6F0F\u6597": "FUNNEL",
  "\u6F0F\u6597": "FUNNEL",
  "defining": "DEFINING",
  "defining \u5B9A\u4E49": "DEFINING",
  "\u5B9A\u4E49": "DEFINING",
  "defining \u7EC6\u5316": "DEFINING",
  "\u7EC6\u5316": "DEFINING",
  "ready": "READY",
  "ready \u5C31\u7EEA": "READY",
  "\u5C31\u7EEA": "READY",
  "to do": "TO DO",
  "to do \u5F85\u529E": "TO DO",
  "\u5F85\u529E": "TO DO",
  "open": "TO DO",
  "open \u6253\u5F00": "TO DO",
  "\u6253\u5F00": "TO DO",
  "building": "EXECUTION",
  "building \u6784\u5EFA\u4E2D": "EXECUTION",
  "\u6784\u5EFA\u4E2D": "EXECUTION",
  "in progress": "EXECUTION",
  "in progress \u5904\u7406\u4E2D": "EXECUTION",
  "\u5904\u7406\u4E2D": "EXECUTION",
  "build done": "EXECUTED",
  "build done \u6784\u5EFA\u5B8C\u6210": "EXECUTED",
  "\u6784\u5EFA\u5B8C\u6210": "EXECUTED",
  "in review": "VALIDATING",
  "in review \u5BA1\u6838\u4E2D": "VALIDATING",
  "\u5BA1\u6838\u4E2D": "VALIDATING",
  "testing": "TESTING & REVIEW",
  "testing \u6D4B\u8BD5\u4E2D": "TESTING & REVIEW",
  "\u6D4B\u8BD5\u4E2D": "TESTING & REVIEW",
  "integrating & testing": "TESTING & REVIEW",
  "integrating & testing \u96C6\u6210\u6D4B\u8BD5\u4E2D": "TESTING & REVIEW",
  "\u96C6\u6210\u6D4B\u8BD5\u4E2D": "TESTING & REVIEW",
  "test done": "TEST DONE",
  "test done \u6D4B\u8BD5\u5B8C\u6210": "TEST DONE",
  "\u6D4B\u8BD5\u5B8C\u6210": "TEST DONE",
  "validating": "VALIDATING",
  "validating \u9A8C\u8BC1": "VALIDATING",
  "validating \u9A8C\u8BC1\u4E2D": "VALIDATING",
  "\u9A8C\u8BC1": "VALIDATING",
  "\u9A8C\u8BC1\u4E2D": "VALIDATING",
  "resolved": "RESOLVED",
  "resolved \u5DF2\u89E3\u51B3": "RESOLVED",
  "\u5DF2\u89E3\u51B3": "RESOLVED",
  "done": "DONE",
  "done \u5B8C\u6210": "DONE",
  "\u5B8C\u6210": "DONE",
  "closed": "CLOSED",
  "closed \u5173\u95ED": "CLOSED",
  "\u5173\u95ED": "CLOSED"
};
var FUZZY_KEYWORDS = [
  ["\u6F0F\u6597", "FUNNEL"],
  ["funnel", "FUNNEL"],
  ["\u5B9A\u4E49", "DEFINING"],
  ["\u7EC6\u5316", "DEFINING"],
  ["defining", "DEFINING"],
  ["\u5C31\u7EEA", "READY"],
  ["ready", "READY"],
  ["\u5F85\u529E", "TO DO"],
  ["to do", "TO DO"],
  ["open", "TO DO"],
  ["\u6784\u5EFA\u4E2D", "EXECUTION"],
  ["\u5904\u7406\u4E2D", "EXECUTION"],
  ["\u5F00\u59CB\u4EFB\u52A1", "EXECUTION"],
  ["building", "EXECUTION"],
  ["in progress", "EXECUTION"],
  ["\u6784\u5EFA\u5B8C\u6210", "EXECUTED"],
  ["build done", "EXECUTED"],
  ["\u5BA1\u6838\u4E2D", "VALIDATING"],
  ["\u6D4B\u8BD5\u4E2D", "TESTING & REVIEW"],
  ["\u96C6\u6210\u6D4B\u8BD5", "TESTING & REVIEW"],
  ["in review", "VALIDATING"],
  ["testing", "TESTING & REVIEW"],
  ["integrating", "TESTING & REVIEW"],
  ["\u6D4B\u8BD5\u5B8C\u6210", "TEST DONE"],
  ["test done", "TEST DONE"],
  ["\u9A8C\u8BC1", "VALIDATING"],
  ["validating", "VALIDATING"],
  ["\u5DF2\u89E3\u51B3", "RESOLVED"],
  ["resolved", "RESOLVED"],
  ["\u5B8C\u6210", "DONE"],
  ["done", "DONE"],
  ["\u5173\u95ED", "CLOSED"],
  ["closed", "CLOSED"]
];
function mapStatusToColumn(jiraStatus) {
  const lower = jiraStatus.toLowerCase().trim();
  if (EXACT_STATUS_MAP[lower])
    return EXACT_STATUS_MAP[lower];
  for (const [keyword, columnId] of FUZZY_KEYWORDS) {
    if (lower.includes(keyword))
      return columnId;
  }
  return "TO DO";
}
var DEFAULT_SETTINGS = {
  jiraHost: "",
  jiraBrowseHost: "https://jira.ykeey.cn",
  jiraUsername: "",
  jiraPassword: "",
  projectKey: "PDSTDTTA",
  jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  rootFolder: "Jira-Flow",
  tasksFolder: "Jira-Flow/Tasks",
  reportsFolder: "Jira-Flow/Reports",
  assetsFolder: "Jira-Flow/Assets",
  dailyNotesFolder: "Daily Notes",
  dailyNoteFormat: "YYYY-MM-DD",
  kanbanColumns: COLUMN_IDS,
  autoSyncOnStartup: false,
  syncIntervalMinutes: 30,
  storyPointsField: "customfield_10111",
  plannedStartDateField: "",
  dueDateField: "customfield_10329",
  sprintField: "customfield_10109",
  ai: {
    models: [...BUILTIN_MODELS],
    activeModelId: "",
    reportPrompt: "Based on the following work logs and task data, generate a concise weekly summary report in Markdown format. Include: key accomplishments, tasks in progress, blockers, and priorities for next week.",
    reportPrompts: {
      weekly: `\u4F60\u662F\u4E00\u4F4D\u654F\u6377\u5F00\u53D1\u4EFB\u52A1\u6574\u7406\u4E13\u5BB6\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u539F\u59CB\u5185\u5BB9\u751F\u6210\u7ED3\u6784\u5316\u5468\u62A5\uFF0C\u4E25\u683C\u9075\u5FAA\u4EE5\u4E0B\u5904\u7406\u89C4\u5219\uFF1A

\u3010\u6570\u636E\u6E05\u6D17\u89C4\u5219\u3011
1. \u5220\u9664\u6BCF\u6761\u8BB0\u5F55\u5F00\u5934\u7684\u82F1\u6587-\u6570\u5B57\u4EFB\u52A1\u7F16\u53F7\uFF08\u5982 PRDAPD-704\u3001WMS-123\u3001Feature/PRDAPD-XXX \u7B49\uFF09
2. \u8BC6\u522B"\u4E3B\u529F\u80FD\u9879-\u6807\u8BC6"\u683C\u5F0F\uFF08\u5982"\u8F6C\u5E93\u5355-20240201"\u3001"\u51FA\u5E93\u5355-\u4E34\u65F6"\uFF09\uFF0C\u63D0\u53D6"-"\u524D\u7684\u6587\u5B57\u4F5C\u4E3A\u4E3B\u529F\u80FD\u9879\u7528\u4E8E\u5F52\u7C7B\u5408\u5E76\uFF0C\u76F8\u540C\u4E3B\u529F\u80FD\u9879\u7684\u4EFB\u52A1\u5408\u5E76\u4E3A\u4E00\u6761\u63CF\u8FF0
3. \u72B6\u6001\u5224\u5B9A\uFF1A\u5185\u5BB9\u5305\u542B"EXECUTED \u6267\u884C\u5B8C\u6210" \u2192 \u672C\u5468\u5DF2\u5B8C\u6210\uFF1B\u4E0D\u5305\u542B \u2192 \u672C\u5468\u9884\u8BA1\u5B8C\u6210

\u3010\u8F93\u51FA\u683C\u5F0F\u3011
\u672C\u5468\u5DF2\u5B8C\u6210
1. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
2. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
3. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0

\u672C\u5468\u9884\u8BA1\u5B8C\u6210
1. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
2. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
3. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0

\u3010\u7EA6\u675F\u3011
- \u53BB\u9664\u6280\u672F\u7EC6\u8282\uFF08\u5982SQL\u3001\u65B9\u6CD5\u540D\u3001\u5F02\u5E38\u5806\u6808\uFF09\uFF0C\u4FDD\u7559\u4E1A\u52A1\u542B\u4E49
- \u540C\u4E00\u4E3B\u529F\u80FD\u9879\u591A\u884C\u8BB0\u5F55\u5408\u5E76\u4E3A\u4E00\u884C\uFF0C\u7528\u987F\u53F7\u6216"\u53CA"\u8FDE\u63A5
- \u4E25\u7981\u8F93\u51FA\u89E3\u91CA\u6027\u6587\u5B57\uFF0C\u76F4\u63A5\u7ED9\u51FA\u7ED3\u679C`,
      monthly: `\u4F60\u662F\u4E00\u4F4D\u654F\u6377\u5F00\u53D1\u4EFB\u52A1\u6574\u7406\u4E13\u5BB6\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u539F\u59CB\u5185\u5BB9\u751F\u6210\u7ED3\u6784\u5316\u6708\u62A5\uFF0C\u4E25\u683C\u9075\u5FAA\u4EE5\u4E0B\u5904\u7406\u89C4\u5219\uFF1A

\u3010\u6570\u636E\u6E05\u6D17\u89C4\u5219\u3011
1. \u5220\u9664\u6BCF\u6761\u8BB0\u5F55\u5F00\u5934\u7684\u82F1\u6587-\u6570\u5B57\u4EFB\u52A1\u7F16\u53F7\uFF08\u5982 PRDAPD-704\u3001WMS-123\u3001Feature/PRDAPD-XXX \u7B49\uFF09
2. \u8BC6\u522B"\u4E3B\u529F\u80FD\u9879-\u6807\u8BC6"\u683C\u5F0F\uFF08\u5982"\u8F6C\u5E93\u5355-20240201"\u3001"\u51FA\u5E93\u5355-\u4E34\u65F6"\uFF09\uFF0C\u63D0\u53D6"-"\u524D\u7684\u6587\u5B57\u4F5C\u4E3A\u4E3B\u529F\u80FD\u9879\u7528\u4E8E\u5F52\u7C7B\u5408\u5E76\uFF0C\u76F8\u540C\u4E3B\u529F\u80FD\u9879\u7684\u4EFB\u52A1\u5408\u5E76\u4E3A\u4E00\u6761\u63CF\u8FF0
3. \u72B6\u6001\u5224\u5B9A\uFF1A\u5185\u5BB9\u5305\u542B"EXECUTED \u6267\u884C\u5B8C\u6210" \u2192 \u672C\u6708\u5DF2\u5B8C\u6210\uFF1B\u4E0D\u5305\u542B \u2192 \u672C\u6708\u9884\u8BA1\u5B8C\u6210

\u3010\u8F93\u51FA\u683C\u5F0F\u3011
\u672C\u6708\u5DF2\u5B8C\u6210
1. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
2. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
3. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0

\u672C\u6708\u9884\u8BA1\u5B8C\u6210
1. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
2. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0
3. \u4E3B\u529F\u80FD\u9879\uFF1A\u4EFB\u52A1\u7B80\u8FF0

\u3010\u7EA6\u675F\u3011
- \u53BB\u9664\u6280\u672F\u7EC6\u8282\uFF08\u5982SQL\u3001\u65B9\u6CD5\u540D\u3001\u5F02\u5E38\u5806\u6808\uFF09\uFF0C\u4FDD\u7559\u4E1A\u52A1\u542B\u4E49
- \u540C\u4E00\u4E3B\u529F\u80FD\u9879\u591A\u884C\u8BB0\u5F55\u5408\u5E76\u4E3A\u4E00\u884C\uFF0C\u7528\u987F\u53F7\u6216"\u53CA"\u8FDE\u63A5
- \u4E25\u7981\u8F93\u51FA\u89E3\u91CA\u6027\u6587\u5B57\uFF0C\u76F4\u63A5\u7ED9\u51FA\u7ED3\u679C`,
      quarterly: "Based on the following work logs and task data, generate a detailed quarterly review report in Markdown format. Include: major milestones achieved, project health overview, team velocity trends, key challenges and how they were addressed, and strategic priorities for next quarter.",
      yearly: "Based on the following work logs and task data, generate a comprehensive annual review report in Markdown format. Include: yearly highlights and achievements, project completion rates, growth metrics, lessons learned, and strategic goals for the coming year."
    }
  }
};

// src/utils/jiraParser.ts
var extractStringToken = (value, key) => {
  const match = value.match(new RegExp(`${key}=(.*?)(?:,|$|\\])`));
  if (!match || !match[1]) {
    return null;
  }
  const normalized = match[1].trim();
  return normalized === "<null>" ? null : normalized;
};
var extractNumberToken = (value, key) => {
  const token = extractStringToken(value, key);
  if (!token) {
    return null;
  }
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
};
var normalizeSprintState = (state) => {
  if (typeof state !== "string") {
    return null;
  }
  const normalized = state.trim();
  if (!normalized || normalized === "<null>") {
    return null;
  }
  return normalized.toUpperCase();
};
var toSprintCandidate = (entry, index) => {
  if (typeof entry === "object" && entry !== null) {
    const sprint = entry;
    const id = sprint.id !== void 0 ? Number(sprint.id) : null;
    const sequence = sprint.sequence !== void 0 ? Number(sprint.sequence) : null;
    return {
      id: Number.isFinite(id) ? id : null,
      index,
      name: typeof sprint.name === "string" && sprint.name.trim() ? sprint.name.trim() : null,
      raw: entry,
      sequence: Number.isFinite(sequence) ? sequence : null,
      state: normalizeSprintState(sprint.state)
    };
  }
  const sprintString = String(entry);
  return {
    id: extractNumberToken(sprintString, "id"),
    index,
    name: extractStringToken(sprintString, "name"),
    raw: entry,
    sequence: extractNumberToken(sprintString, "sequence"),
    state: normalizeSprintState(extractStringToken(sprintString, "state"))
  };
};
var getSprintPriority = (state) => {
  if (state === "ACTIVE") {
    return 3;
  }
  if (state === "FUTURE") {
    return 2;
  }
  if (state === "CLOSED") {
    return 1;
  }
  return 0;
};
var selectPreferredSprint = (sprintData) => {
  const sprintArray = Array.isArray(sprintData) ? sprintData : [sprintData];
  if (sprintArray.length === 0) {
    return null;
  }
  return sprintArray.map((entry, index) => toSprintCandidate(entry, index)).reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }
    const priorityDiff = getSprintPriority(candidate.state) - getSprintPriority(best.state);
    if (priorityDiff !== 0) {
      return priorityDiff > 0 ? candidate : best;
    }
    const sequenceDiff = (candidate.sequence ?? Number.MIN_SAFE_INTEGER) - (best.sequence ?? Number.MIN_SAFE_INTEGER);
    if (sequenceDiff !== 0) {
      return sequenceDiff > 0 ? candidate : best;
    }
    const idDiff = (candidate.id ?? Number.MIN_SAFE_INTEGER) - (best.id ?? Number.MIN_SAFE_INTEGER);
    if (idDiff !== 0) {
      return idDiff > 0 ? candidate : best;
    }
    return candidate.index > best.index ? candidate : best;
  }, null);
};
var parseJiraSprintName = (sprintData) => {
  if (!sprintData)
    return null;
  try {
    const preferredSprint = selectPreferredSprint(sprintData);
    if (!preferredSprint) {
      return null;
    }
    if (preferredSprint.name) {
      return preferredSprint.name;
    }
    return typeof preferredSprint.raw === "string" ? preferredSprint.raw : String(preferredSprint.raw);
  } catch (error) {
    console.error("[Jira Flow] Error parsing sprint name:", error, sprintData);
    return null;
  }
};
var parseJiraSprintState = (sprintData) => {
  if (!sprintData)
    return null;
  try {
    return selectPreferredSprint(sprintData)?.state ?? null;
  } catch (error) {
    console.error("[Jira Flow] Error parsing sprint state:", error);
    return null;
  }
};

// src/sync/fileManager.ts
var FileManager = class {
  constructor(plugin2) {
    this.frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
    this.plugin = plugin2;
  }
  get vault() {
    return this.plugin.app.vault;
  }
  normalizeFrontmatterText(value) {
    const text = typeof value === "string" ? value : value == null ? "" : String(value);
    return text.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  }
  escapeYamlString(value) {
    return this.normalizeFrontmatterText(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  async ensureFolders() {
    const folders = [
      this.plugin.settings.tasksFolder,
      this.plugin.settings.reportsFolder,
      this.plugin.settings.assetsFolder
    ];
    for (const folder of folders) {
      const path = normalizePath(folder);
      if (!this.vault.getAbstractFileByPath(path)) {
        await this.vault.createFolder(path);
      }
    }
  }
  async syncIssues(issues) {
    console.log(`[Jira Flow] Starting sync of ${issues.length} issues`);
    await this.ensureFolders();
    const result = { created: 0, updated: 0, archived: 0, errors: [] };
    const seenIssueKeys = /* @__PURE__ */ new Set();
    const taskIndex = this.buildTaskFileIndex();
    for (const issue of issues) {
      try {
        seenIssueKeys.add(issue.key);
        const frontmatter = this.issueToFrontmatter(issue);
        const summary = issue.fields.summary;
        const existing = taskIndex.get(issue.key) ?? this.findExistingTaskFile(issue.key, summary);
        if (existing) {
          taskIndex.set(issue.key, existing);
          const existingFrontmatter = this.getTaskFrontmatter(existing);
          if (existingFrontmatter && this.canSkipSync(existingFrontmatter, frontmatter)) {
            continue;
          }
        }
        const rawDescription = issue.renderedFields?.description || issue.fields.description || "";
        const description = await this.processDescription(rawDescription, issue.key);
        if (existing) {
          await this.updateTaskFile(existing, frontmatter, description);
          result.updated++;
        } else {
          const created = await this.createTaskFile(issue.key, summary, frontmatter, description);
          taskIndex.set(issue.key, created);
          result.created++;
        }
        if ((result.created + result.updated) % 10 === 0) {
          await this.yieldToMainThread();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`${issue.key}: ${msg}`);
        console.error(`Jira Flow: Error syncing ${issue.key}:`, e);
      }
    }
    result.archived = await this.archiveMissingJiraIssues(seenIssueKeys);
    return result;
  }
  issueToFrontmatter(issue) {
    const f = issue.fields;
    const status = this.normalizeFrontmatterText(f.status.name);
    const mappedColumn = mapStatusToColumn(status);
    const issueTypeName = this.normalizeFrontmatterText(f.issuetype.name);
    const type = issueTypeName.toLowerCase();
    const spField = this.plugin.settings.storyPointsField;
    const storyPoints = typeof f[spField] === "number" ? f[spField] : 0;
    const ddField = this.plugin.settings.dueDateField;
    const plannedEnd = f[ddField];
    const dueDate = this.normalizeFrontmatterText(plannedEnd || f.duedate || "");
    const sprintFieldName = this.plugin.settings.sprintField;
    const rawSprintData = f[sprintFieldName];
    const sprintName = this.normalizeFrontmatterText(parseJiraSprintName(rawSprintData));
    const sprintState = this.normalizeFrontmatterText(parseJiraSprintState(rawSprintData));
    const tags = [
      `jira/status/${status.toLowerCase().replace(/\s+/g, "-")}`,
      `jira/type/${type.replace(/\s+/g, "-")}`,
      `jira/source/jira`
    ];
    const reporterName = this.normalizeFrontmatterText(f.reporter?.displayName || f.reporter?.name || f.reporter?.emailAddress || "");
    const reporterIdentity = [f.reporter?.name, f.reporter?.emailAddress, reporterName].filter((item) => !!item).map((item) => item.toLowerCase());
    const assigneeName = this.normalizeFrontmatterText(f.assignee?.displayName || f.assignee?.name || f.assignee?.emailAddress || "");
    const assigneeIdentity = [f.assignee?.name, f.assignee?.emailAddress, assigneeName].filter((item) => !!item).map((item) => item.toLowerCase());
    const currentUserIdentity = this.plugin.settings.jiraUsername.toLowerCase();
    const reporterOnly = reporterIdentity.includes(currentUserIdentity) && !assigneeIdentity.includes(currentUserIdentity);
    if (reporterOnly) {
      tags.push("jira/reporter/current-user");
    }
    if (f.labels) {
      tags.push(...f.labels.map((l) => `jira/label/${l.toLowerCase()}`));
    }
    const issueLinks = f.issuelinks || [];
    const parentLink = issueLinks.find((link) => {
      const outwardLabel = link.type?.outward?.toLowerCase() || "";
      const inwardLabel = link.type?.inward?.toLowerCase() || "";
      const typeName = link.type?.name?.toLowerCase() || "";
      return outwardLabel.includes("child of") || outwardLabel.includes("sub-task of") || inwardLabel.includes("parent of") || typeName.includes("parent") || typeName.includes("epic");
    });
    const parentIssue = parentLink?.outwardIssue || (parentLink?.type?.inward?.toLowerCase().includes("parent of") ? parentLink.inwardIssue : void 0);
    const parentKey = this.normalizeFrontmatterText(parentIssue?.key || "");
    const parentSummary = this.normalizeFrontmatterText(parentIssue?.fields?.summary || "");
    return {
      jira_key: this.normalizeFrontmatterText(issue.key),
      source: "JIRA",
      status,
      mapped_column: mappedColumn,
      issuetype: issueTypeName,
      priority: this.normalizeFrontmatterText(f.priority.name),
      story_points: storyPoints,
      due_date: dueDate,
      assignee: assigneeName,
      reporter: reporterName,
      reporter_only: reporterOnly,
      parent_key: parentKey,
      parent_summary: parentSummary,
      sprint: sprintName,
      sprint_state: sprintState,
      tags,
      summary: this.normalizeFrontmatterText(f.summary),
      created: this.normalizeFrontmatterText(f.created),
      updated: this.normalizeFrontmatterText(f.updated)
    };
  }
  async createTaskFile(key, summary, frontmatter, description) {
    await this.ensureFolders();
    const filePath = this.getTaskFilePath(key, summary);
    const yaml = this.frontmatterToYaml(frontmatter);
    const content = `---
${yaml}---
${description}`;
    return await this.vault.create(filePath, content);
  }
  async updateTaskFile(file, frontmatter, description) {
    try {
      const content = await this.readFileWithRetry(file);
      const currentBody = this.extractBody(content);
      const nextDescription = description ?? currentBody;
      const nextFrontmatter = {
        ...frontmatter,
        archived: false,
        archived_date: ""
      };
      const newContent = this.composeTaskContent(nextFrontmatter, nextDescription);
      if (newContent !== content) {
        await this.modifyFileWithRetry(file, newContent);
      }
    } catch (error) {
      console.error(`[Jira Flow] EBUSY or Write Error on ${file.name}:`, error);
      throw error;
    }
  }
  async processFrontMatterWithRetry(file, updater) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.plugin.app.fileManager.processFrontMatter(file, updater);
        return;
      } catch (error) {
        if (!this.isRetryableFileError(error) || attempt === 2) {
          throw error;
        }
        lastError = error;
        await new Promise((resolve) => globalThis.setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
    throw lastError;
  }
  async updateStatus(file, newColumnId) {
    await this.processFrontMatterWithRetry(file, (fm) => {
      fm.mapped_column = newColumnId;
      fm.status = newColumnId;
      const oldStatusTag = fm.tags?.find(
        (t) => t.startsWith("jira/status/")
      );
      if (oldStatusTag && Array.isArray(fm.tags)) {
        const idx = fm.tags.indexOf(oldStatusTag);
        fm.tags[idx] = `jira/status/${newColumnId.toLowerCase().replace(/\s+/g, "-")}`;
      }
    });
  }
  getTaskFilePath(key, summary) {
    if (summary) {
      const sanitizedSummary = this.sanitizeFilename(summary);
      return normalizePath(`${this.plugin.settings.tasksFolder}/${key}-${sanitizedSummary}.md`);
    }
    return normalizePath(`${this.plugin.settings.tasksFolder}/${key}.md`);
  }
  sanitizeFilename(summary) {
    return summary.replace(/[\/\\:?*"<>|]/g, "-").replace(/\s+/g, " ").trim();
  }
  findExistingTaskFile(key, summary) {
    const newPath = this.getTaskFilePath(key, summary);
    const newFile = this.vault.getAbstractFileByPath(newPath);
    if (newFile instanceof TFile) {
      return newFile;
    }
    const oldPath = this.getTaskFilePath(key);
    const oldFile = this.vault.getAbstractFileByPath(oldPath);
    if (oldFile instanceof TFile) {
      return oldFile;
    }
    const allFiles = this.getAllTaskFiles();
    for (const file of allFiles) {
      const fm = this.getTaskFrontmatter(file);
      if (fm && fm.jira_key === key) {
        return file;
      }
    }
    return null;
  }
  /**
   * Find a task file by its jira_key. Supports both old (key.md) and new (key-summary.md) naming formats.
   * Public API for use by UI components (e.g. report hover preview).
   */
  findTaskFileByKey(key) {
    const oldPath = this.getTaskFilePath(key);
    const oldFile = this.vault.getAbstractFileByPath(oldPath);
    if (oldFile instanceof TFile) {
      return oldFile;
    }
    const allFiles = this.getAllTaskFiles();
    for (const file of allFiles) {
      if (!file.basename.startsWith(key))
        continue;
      const fm = this.getTaskFrontmatter(file);
      if (fm && fm.jira_key === key) {
        return file;
      }
    }
    return null;
  }
  frontmatterToYaml(fm) {
    const lines = [];
    lines.push(`jira_key: "${this.escapeYamlString(fm.jira_key)}"`);
    lines.push(`source: "${this.escapeYamlString(fm.source)}"`);
    lines.push(`status: "${this.escapeYamlString(fm.status)}"`);
    lines.push(`mapped_column: "${this.escapeYamlString(fm.mapped_column)}"`);
    lines.push(`issuetype: "${this.escapeYamlString(fm.issuetype)}"`);
    lines.push(`priority: "${this.escapeYamlString(fm.priority)}"`);
    lines.push(`story_points: ${fm.story_points}`);
    lines.push(`due_date: "${this.escapeYamlString(fm.due_date)}"`);
    lines.push(`assignee: "${this.escapeYamlString(fm.assignee)}"`);
    lines.push(`reporter: "${this.escapeYamlString(fm.reporter || "")}"`);
    if (fm.reporter_only) {
      lines.push(`reporter_only: true`);
    }
    lines.push(`parent_key: "${this.escapeYamlString(fm.parent_key || "")}"`);
    lines.push(`parent_summary: "${this.escapeYamlString(fm.parent_summary || "")}"`);
    lines.push(`sprint: "${this.escapeYamlString(fm.sprint)}"`);
    lines.push(`sprint_state: "${this.escapeYamlString(fm.sprint_state)}"`);
    lines.push(`summary: "${this.escapeYamlString(fm.summary)}"`);
    lines.push(`created: "${this.escapeYamlString(fm.created)}"`);
    lines.push(`updated: "${this.escapeYamlString(fm.updated)}"`);
    if (fm.archived) {
      lines.push(`archived: true`);
      lines.push(`archived_date: "${this.escapeYamlString(fm.archived_date || "")}"`);
    }
    lines.push("tags:");
    for (const tag of fm.tags) {
      lines.push(`  - ${tag}`);
    }
    return lines.join("\n") + "\n";
  }
  /**
   * Process description HTML: convert Jira Wiki images to HTML and download assets.
   * Public so it can be used by UI components to process API-fetched descriptions.
   */
  async processDescription(html, issueKey) {
    if (!html)
      return "";
    let processedHtml = html;
    const wikiImageRegex = /!([^|!\n]+)(?:\|[^!\n]*)?!/g;
    processedHtml = processedHtml.replace(wikiImageRegex, (match, imageUrl) => {
      return `<img src="${imageUrl}" alt="Jira Wiki Image" />`;
    });
    const imgRegex = /<img[^>]+(?:src|data-image-src|data-src)=["']([^"']+)["']([^>]*)>/gi;
    const imgMatches = Array.from(processedHtml.matchAll(imgRegex));
    for (const match of imgMatches) {
      const imgUrl = match[1];
      const restOfTag = match[2];
      try {
        if (imgUrl.startsWith("http") || imgUrl.startsWith("/")) {
          const localPath = await this.downloadAsset(imgUrl, issueKey);
          processedHtml = processedHtml.replace(
            match[0],
            `<img src="${localPath}"${restOfTag}>`
          );
        }
      } catch (e) {
        console.log(`[Jira Flow] Failed to download image ${imgUrl}, keeping original.`);
      }
    }
    return processedHtml;
  }
  async downloadAsset(url, issueKey) {
    const filename = url.split("/").pop() || "image.png";
    const assetPath = normalizePath(
      `${this.plugin.settings.assetsFolder}/${issueKey}-${filename}`
    );
    if (!this.vault.getAbstractFileByPath(assetPath)) {
      const data = await this.plugin.jiraApi.downloadImage(url);
      await this.vault.createBinary(assetPath, data);
    }
    return assetPath;
  }
  getAllTaskFiles() {
    const folder = this.plugin.settings.tasksFolder;
    return this.vault.getFiles().filter(
      (f) => f.path.startsWith(folder) && f.extension === "md"
    );
  }
  getTaskFrontmatter(file) {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter)
      return null;
    const fm = cache.frontmatter;
    const status = this.normalizeFrontmatterText(fm.status || "");
    return {
      jira_key: this.normalizeFrontmatterText(fm.jira_key || ""),
      source: fm.source || "LOCAL",
      status,
      mapped_column: this.normalizeFrontmatterText(fm.mapped_column || mapStatusToColumn(status)),
      issuetype: this.normalizeFrontmatterText(fm.issuetype || "Task"),
      priority: this.normalizeFrontmatterText(fm.priority || "Medium"),
      story_points: fm.story_points || 0,
      due_date: this.normalizeFrontmatterText(fm.due_date || ""),
      assignee: this.normalizeFrontmatterText(fm.assignee || ""),
      reporter: this.normalizeFrontmatterText(fm.reporter || ""),
      reporter_only: fm.reporter_only === true,
      parent_key: this.normalizeFrontmatterText(fm.parent_key || ""),
      parent_summary: this.normalizeFrontmatterText(fm.parent_summary || ""),
      sprint: this.normalizeFrontmatterText(fm.sprint || ""),
      sprint_state: this.normalizeFrontmatterText(fm.sprint_state || ""),
      tags: fm.tags || [],
      summary: this.normalizeFrontmatterText(fm.summary || file.basename),
      created: this.normalizeFrontmatterText(fm.created || ""),
      updated: this.normalizeFrontmatterText(fm.updated || ""),
      archived: fm.archived || false,
      archived_date: this.normalizeFrontmatterText(fm.archived_date || "")
    };
  }
  /**
   * Read the description from the file body (content after frontmatter).
   * For JIRA tasks, this is HTML content. For local tasks, this may be markdown.
   */
  async readDescription(file) {
    const content = await this.readFileWithRetry(file);
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
    const body = content.replace(frontmatterRegex, "").trim();
    return body;
  }
  async archiveTask(file) {
    await this.processFrontMatterWithRetry(file, (fm) => {
      fm.archived = true;
      fm.archived_date = (/* @__PURE__ */ new Date()).toISOString();
    });
  }
  buildTaskFileIndex() {
    const index = /* @__PURE__ */ new Map();
    for (const file of this.getAllTaskFiles()) {
      const frontmatter = this.getTaskFrontmatter(file);
      if (frontmatter?.jira_key) {
        index.set(frontmatter.jira_key, file);
      }
    }
    return index;
  }
  canSkipSync(existing, incoming) {
    if (existing.archived || existing.updated !== incoming.updated) {
      return false;
    }
    return existing.status === incoming.status && existing.mapped_column === incoming.mapped_column && existing.priority === incoming.priority && existing.story_points === incoming.story_points && existing.due_date === incoming.due_date && existing.assignee === incoming.assignee && existing.reporter === incoming.reporter && existing.reporter_only === incoming.reporter_only && (existing.parent_key || "") === (incoming.parent_key || "") && (existing.parent_summary || "") === (incoming.parent_summary || "") && existing.sprint === incoming.sprint && existing.sprint_state === incoming.sprint_state && existing.summary === incoming.summary && existing.created === incoming.created && existing.updated === incoming.updated && JSON.stringify(existing.tags) === JSON.stringify(incoming.tags);
  }
  composeTaskContent(frontmatter, description) {
    const normalizedFrontmatter = {
      ...frontmatter,
      archived: frontmatter.archived || false,
      archived_date: frontmatter.archived ? frontmatter.archived_date || "" : ""
    };
    const yaml = this.frontmatterToYaml(normalizedFrontmatter);
    return `---
${yaml}---
${description}`;
  }
  extractBody(content) {
    return content.replace(this.frontmatterRegex, "");
  }
  async modifyFileWithRetry(file, content) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.vault.modify(file, content);
        return;
      } catch (error) {
        if (!this.isRetryableFileError(error) || attempt === 2) {
          throw error;
        }
        lastError = error;
        await new Promise((resolve) => globalThis.setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
    throw lastError;
  }
  async readFileWithRetry(file) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.vault.read(file);
      } catch (error) {
        if (!this.isRetryableFileError(error) || attempt === 2) {
          throw error;
        }
        lastError = error;
        await new Promise((resolve) => globalThis.setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
    throw lastError;
  }
  isRetryableFileError(error) {
    if (!(error instanceof Error)) {
      return false;
    }
    return /(EBUSY|EAGAIN|EPERM|resource busy or locked|file is busy|locked)/i.test(error.message);
  }
  async archiveMissingJiraIssues(seenIssueKeys) {
    let archivedCount = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const file of this.getAllTaskFiles()) {
      const fm = this.getTaskFrontmatter(file);
      if (!fm || fm.source !== "JIRA" || fm.archived || !fm.jira_key) {
        continue;
      }
      if (seenIssueKeys.has(fm.jira_key)) {
        continue;
      }
      await this.processFrontMatterWithRetry(file, (frontmatter) => {
        frontmatter.archived = true;
        frontmatter.archived_date = now;
      });
      archivedCount++;
      if (archivedCount % 10 === 0) {
        await this.yieldToMainThread();
      }
    }
    return archivedCount;
  }
  async yieldToMainThread() {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  }
};

// scripts/verify-ebusyRetryAndMoveDedup.ts
var appSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "components", "App.tsx"), "utf8");
var fakeFile = {};
var attempts = 0;
var plugin = {
  settings: {
    tasksFolder: "Tasks",
    reportsFolder: "Reports",
    assetsFolder: "Assets"
  },
  app: {
    vault: {
      getAbstractFileByPath: () => null,
      getFiles: () => []
    },
    metadataCache: {},
    fileManager: {
      processFrontMatter: async () => {
        attempts += 1;
        if (attempts < 2) {
          const error = new Error("EBUSY: resource busy or locked");
          throw error;
        }
      }
    }
  },
  jiraApi: {}
};
async function main() {
  const fileManager = new FileManager(plugin);
  await fileManager.processFrontMatterWithRetry(fakeFile, () => void 0);
  if (attempts !== 2) {
    throw new Error(`processFrontMatterWithRetry \u5E94\u5728 EBUSY \u540E\u91CD\u8BD5\uFF0C\u5B9E\u9645\u5C1D\u8BD5 ${attempts} \u6B21`);
  }
  const expectations = [
    [appSource, "pendingCardMovesRef", "App \u7F3A\u5C11\u62D6\u62FD\u4E2D\u7684\u5361\u7247\u53BB\u91CD\u72B6\u6001"],
    [appSource, "pendingCardMovesRef.current.has(cardPath)", "handleCardMove \u7F3A\u5C11\u91CD\u590D\u62D6\u62FD\u4FDD\u62A4"],
    [appSource, "pendingCardMovesRef.current.add(cardPath)", "handleCardMove \u7F3A\u5C11\u8FDB\u5165\u4E2D\u7684\u5361\u7247\u767B\u8BB0"],
    [appSource, "pendingCardMovesRef.current.delete(cardPath)", "handleCardMove \u7F3A\u5C11\u6700\u7EC8\u6E05\u7406\u4E2D\u7684\u5361\u7247\u767B\u8BB0"]
  ];
  for (const [source, needle, message] of expectations) {
    if (!source.includes(needle)) {
      throw new Error(message);
    }
  }
  console.log("ebusy retry and move dedup verification passed");
}
void main();
