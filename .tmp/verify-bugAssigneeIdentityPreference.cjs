// scripts/obsidianStub.ts
async function requestUrl() {
  throw new Error("obsidian requestUrl stub should not be called in this verification script");
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

// src/api/jira.ts
var JiraApi = class {
  constructor(plugin2) {
    this.currentUserCache = void 0;
    this.plugin = plugin2;
  }
  getAuthHeader() {
    const { jiraUsername, jiraPassword } = this.plugin.settings;
    return "Basic " + btoa(`${jiraUsername}:${jiraPassword}`);
  }
  get baseUrl() {
    return this.plugin.settings.jiraHost.replace(/\/+$/, "");
  }
  get fieldsParam() {
    const s = this.plugin.settings;
    const fields = `summary,description,status,issuetype,priority,assignee,reporter,created,updated,duedate,labels,issuelinks,attachment,${s.storyPointsField},${s.dueDateField},${s.sprintField}`;
    return fields;
  }
  buildSyncJql() {
    const baseJql = (this.plugin.settings.jql || "").trim().replace(/\s+order\s+by[\s\S]*$/i, "").trim();
    const reporterJql = "reporter = currentUser() AND resolution = Unresolved";
    if (!baseJql) {
      return `${reporterJql} ORDER BY created DESC`;
    }
    if (/reporter\s*=\s*currentUser\(\)/i.test(baseJql)) {
      return baseJql;
    }
    return `(${baseJql}) OR (${reporterJql}) ORDER BY created DESC`;
  }
  async request(endpoint, method = "GET", body) {
    const url = `${this.baseUrl}/rest/api/2/${endpoint}`;
    return this.requestAbsoluteUrl(url, method, body, {
      "Content-Type": "application/json",
      Accept: "application/json"
    });
  }
  async requestAbsoluteUrl(url, method = "GET", body, extraHeaders) {
    const params = {
      url,
      method,
      headers: {
        Authorization: this.getAuthHeader(),
        "X-Atlassian-Token": "no-check",
        "User-Agent": "Obsidian-Jira-Flow",
        ...extraHeaders
      },
      throw: false
    };
    if (body !== void 0) {
      params.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const response = await requestUrl(params);
    if (response.status >= 400) {
      let detail = "";
      try {
        const errBody = response.json;
        detail = errBody?.errorMessages?.join("; ") || errBody?.message || JSON.stringify(errBody);
      } catch {
        detail = response.text?.slice(0, 500) || "";
      }
      console.error(`[Jira Flow] ${method} ${url} \u2192 ${response.status}`, detail);
      throw new Error(`Request failed, status ${response.status}: ${detail}`);
    }
    if (response.status === 204 || !response.text || response.text.trim() === "") {
      return void 0;
    }
    try {
      return response.json;
    } catch {
      return void 0;
    }
  }
  decodeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }
  extractDataAttribute(html, elementId, attributeName) {
    const pattern = new RegExp(`<[^>]*id=["']${elementId}["'][^>]*${attributeName}=["']([^"']*)["']`, "i");
    const match = html.match(pattern);
    return match ? this.decodeHtmlEntities(match[1]) : null;
  }
  extractScriptJson(html, scriptId) {
    const pattern = new RegExp(`<script[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
    const match = html.match(pattern);
    return match ? this.decodeHtmlEntities(match[1].trim()) : null;
  }
  parseSuggestions(html, elementId) {
    const raw = this.extractDataAttribute(html, elementId, "data-suggestions");
    if (!raw)
      return [];
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(`[Jira Flow] Failed to parse suggestions for ${elementId}`, error);
      return [];
    }
  }
  parseProjectLabel(label) {
    const match = label.match(/^(.*)\(([^()]+)\)\s*$/);
    if (!match) {
      return { name: label.trim(), key: label.trim() };
    }
    return {
      name: match[1].trim(),
      key: match[2].trim()
    };
  }
  parsePriorityOptions(html) {
    const options = Array.from(html.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi));
    return options.map((match) => ({
      id: this.decodeHtmlEntities(match[1]).trim(),
      name: this.decodeHtmlEntities(match[2]).replace(/\s+/g, " ").trim()
    })).filter((item) => item.id && item.name);
  }
  async fetchCreateIssueMetaFromQuickCreate(projectKey) {
    const url = `${this.baseUrl}/secure/QuickCreateIssue!default.jspa?decorator=none`;
    const response = await this.requestAbsoluteUrl(url, "GET", void 0, {
      Accept: "application/json, text/plain, */*"
    });
    const fields = response?.fields || [];
    const projectField = fields.find((field) => field.id === "project")?.editHtml || "";
    const issueTypeField = fields.find((field) => field.id === "issuetype")?.editHtml || "";
    const priorityField = fields.find((field) => field.id === "priority")?.editHtml || "";
    const projectGroups = this.parseSuggestions(projectField, "project-options");
    const projects = projectGroups.flatMap((group) => group.items).map((item) => {
      const parsed = this.parseProjectLabel(item.label);
      return {
        id: item.value,
        key: parsed.key,
        name: parsed.name,
        selected: !!item.selected
      };
    });
    const project = projects.find((item) => item.key === projectKey) || projects.find((item) => item.selected) || projects[0];
    if (!project) {
      throw new Error("QuickCreateIssue \u672A\u8FD4\u56DE\u53EF\u7528\u9879\u76EE\u3002\u8BF7\u786E\u8BA4 Jira \u6743\u9650\u548C\u9879\u76EE\u914D\u7F6E\u3002");
    }
    const issueTypeGroups = this.parseSuggestions(issueTypeField, "issuetype-options");
    const projectTypeMapRaw = this.extractScriptJson(issueTypeField, "issuetype-projects");
    const issueTypeDefaultsRaw = this.extractScriptJson(issueTypeField, "issuetype-defaults");
    let projectTypeMap = {};
    let issueTypeDefaults = {};
    try {
      projectTypeMap = projectTypeMapRaw ? JSON.parse(projectTypeMapRaw) : {};
      issueTypeDefaults = issueTypeDefaultsRaw ? JSON.parse(issueTypeDefaultsRaw) : {};
    } catch (error) {
      console.error("[Jira Flow] Failed to parse QuickCreate issue type metadata", error);
    }
    const issueTypeGroupId = projectTypeMap[project.id];
    const issueTypes = issueTypeGroups.filter((group) => !issueTypeGroupId || group.label === issueTypeGroupId).flatMap((group) => group.items).map((item) => ({ id: item.value, name: item.label }));
    const priorities = this.parsePriorityOptions(priorityField);
    if (issueTypes.length === 0) {
      throw new Error(`QuickCreateIssue \u672A\u8FD4\u56DE\u9879\u76EE ${project.key} \u7684\u95EE\u9898\u7C7B\u578B\u3002`);
    }
    const defaultIssueTypeId = issueTypeGroupId ? issueTypeDefaults[issueTypeGroupId] : void 0;
    const orderedIssueTypes = defaultIssueTypeId ? [
      ...issueTypes.filter((item) => item.id === defaultIssueTypeId),
      ...issueTypes.filter((item) => item.id !== defaultIssueTypeId)
    ] : issueTypes;
    return {
      projectKey: project.key,
      projectName: project.name,
      issueTypes: orderedIssueTypes,
      priorities
    };
  }
  async agileRequest(endpoint) {
    const url = `${this.baseUrl}/rest/agile/1.0/${endpoint}`;
    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Atlassian-Token": "no-check",
        "User-Agent": "Obsidian-Jira-Flow"
      },
      throw: false
    });
    if (response.status >= 400) {
      let detail = "";
      try {
        const errBody = response.json;
        detail = errBody?.errorMessages?.join("; ") || errBody?.message || JSON.stringify(errBody);
      } catch {
        detail = response.text?.slice(0, 500) || "";
      }
      console.error(`[Jira Flow] GET ${url} \u2192 ${response.status}`, detail);
      throw new Error(`Agile request failed, status ${response.status}: ${detail}`);
    }
    return response.json;
  }
  async testConnection() {
    await this.request("myself");
  }
  async getCurrentUser() {
    if (this.currentUserCache !== void 0) {
      return this.currentUserCache;
    }
    try {
      const currentUser = await this.request("myself");
      this.currentUserCache = currentUser;
      return currentUser;
    } catch (error) {
      console.error("[Jira Flow] Failed to fetch current user", error);
      this.currentUserCache = null;
      return null;
    }
  }
  buildAssigneeField(currentUser) {
    if (currentUser.name) {
      return { name: currentUser.name };
    }
    if (currentUser.key) {
      return { key: currentUser.key };
    }
    if (currentUser.accountId) {
      return { accountId: currentUser.accountId };
    }
    return null;
  }
  getCurrentUserDisplayName(currentUser) {
    return currentUser.displayName || currentUser.name || currentUser.emailAddress || currentUser.key || "";
  }
  async assignIssueToCurrentUser(issueKey) {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      return { success: false };
    }
    const assignee = this.buildAssigneeField(currentUser);
    if (!assignee) {
      console.error("[Jira Flow] Current Jira user has no supported assignee identifier", currentUser);
      return { success: false };
    }
    const success = await this.updateIssueFields(issueKey, { assignee });
    if (!success) {
      return { success: false };
    }
    return {
      success: true,
      assigneeName: this.getCurrentUserDisplayName(currentUser)
    };
  }
  async fetchCreateIssueMeta(projectKey) {
    try {
      const data = await this.request(
        `issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes.fields`
      );
      const project = data.projects?.[0];
      if (!project) {
        throw new Error(`No Jira project metadata found for ${projectKey}.`);
      }
      const issueTypes = project.issuetypes.map((issuetype) => ({
        id: issuetype.id,
        name: issuetype.name
      }));
      const priorityMap = /* @__PURE__ */ new Map();
      for (const issuetype of project.issuetypes) {
        for (const priority of issuetype.fields?.priority?.allowedValues || []) {
          if (!priorityMap.has(priority.id)) {
            priorityMap.set(priority.id, { id: priority.id, name: priority.name });
          }
        }
      }
      let priorities = Array.from(priorityMap.values());
      if (priorities.length === 0) {
        priorities = await this.request("priority");
      }
      return {
        projectKey: project.key,
        projectName: project.name,
        issueTypes,
        priorities
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("status 404")) {
        throw error;
      }
      console.warn("[Jira Flow] createmeta unavailable, falling back to QuickCreateIssue metadata");
      return this.fetchCreateIssueMetaFromQuickCreate(projectKey);
    }
  }
  async createIssue(input) {
    const fields = {
      project: { key: input.projectKey },
      issuetype: { id: input.issueTypeId },
      summary: input.summary
    };
    if (input.description?.trim()) {
      fields.description = input.description.trim();
    }
    if (input.assignee?.trim()) {
      fields.assignee = { name: input.assignee.trim() };
    }
    if (input.priorityId) {
      fields.priority = { id: input.priorityId };
    }
    if (this.plugin.settings.storyPointsField && typeof input.storyPoints === "number") {
      fields[this.plugin.settings.storyPointsField] = input.storyPoints;
    }
    if (this.plugin.settings.plannedStartDateField && input.plannedStartDate) {
      fields[this.plugin.settings.plannedStartDateField] = input.plannedStartDate;
    }
    if (this.plugin.settings.dueDateField && input.plannedEndDate) {
      fields[this.plugin.settings.dueDateField] = input.plannedEndDate;
    }
    return await this.request("issue", "POST", { fields });
  }
  // ===== 4-Step Agile Sync =====
  /** Step 1: Detect board ID for a project */
  async detectBoardId(projectKey) {
    try {
      const data = await this.agileRequest(
        `board?projectKeyOrId=${encodeURIComponent(projectKey)}`
      );
      if (!data.values || data.values.length === 0)
        return null;
      const scrum = data.values.find((b) => b.type === "scrum");
      return scrum || data.values[0];
    } catch {
      return null;
    }
  }
  /** Step 2: Fetch active sprint for a board */
  async fetchActiveSprint(boardId) {
    for (const state of ["active", "future", "closed"]) {
      try {
        const data = await this.agileRequest(
          `board/${boardId}/sprint?state=${state}&maxResults=1`
        );
        if (data.values && data.values.length > 0) {
          return data.values[0];
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  /** Step 3: Fetch issues in a sprint (only current user's tasks) */
  async fetchSprintIssues(sprintId) {
    const allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    const jql = encodeURIComponent("assignee=currentUser()");
    while (true) {
      const data = await this.agileRequest(
        `sprint/${sprintId}/issue?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${this.fieldsParam}&expand=renderedFields`
      );
      allIssues.push(...data.issues);
      if (startAt + maxResults >= data.total)
        break;
      startAt += maxResults;
    }
    return allIssues;
  }
  /** Step 4: Fetch backlog issues */
  async fetchBacklogIssues(boardId, projectKey) {
    const allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    try {
      while (true) {
        const data = await this.agileRequest(
          `board/${boardId}/backlog?startAt=${startAt}&maxResults=${maxResults}&jql=${encodeURIComponent(`project="${projectKey}" AND assignee=currentUser()`)}&fields=${this.fieldsParam}&expand=renderedFields`
        );
        const sprintField = this.plugin.settings.sprintField;
        const backlogOnly = data.issues.filter((issue) => {
          const sprint = issue.fields[sprintField];
          if (!sprint)
            return true;
          if (Array.isArray(sprint))
            return sprint.length === 0;
          return false;
        });
        allIssues.push(...backlogOnly);
        if (startAt + maxResults >= data.total)
          break;
        startAt += maxResults;
      }
    } catch {
    }
    return allIssues;
  }
  /** Full Agile sync: returns all issues (sprint + backlog) */
  async fetchIssuesAgile(projectKey) {
    const board = await this.detectBoardId(projectKey);
    if (!board) {
      throw new Error(`No board found for project "${projectKey}". Falling back to JQL.`);
    }
    const sprint = await this.fetchActiveSprint(board.id);
    let sprintIssues = [];
    if (sprint) {
      sprintIssues = await this.fetchSprintIssues(sprint.id);
    }
    const backlogIssues = await this.fetchBacklogIssues(board.id, projectKey);
    const seen = /* @__PURE__ */ new Set();
    const allIssues = [];
    for (const issue of [...sprintIssues, ...backlogIssues]) {
      if (!seen.has(issue.key)) {
        seen.add(issue.key);
        allIssues.push(issue);
      }
    }
    return { issues: allIssues, sprint };
  }
  /** JQL fallback fetch (original method, with extra fields) */
  async fetchIssues() {
    const allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    const jql = this.buildSyncJql();
    while (true) {
      const data = await this.request(
        `search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${this.fieldsParam}&expand=renderedFields`
      );
      allIssues.push(...data.issues);
      if (startAt + data.maxResults >= data.total)
        break;
      startAt += maxResults;
    }
    return allIssues;
  }
  /** Transition issue by target column ID (uses normalizeStatus matching) */
  async transitionIssue(issueKey, targetColumnId) {
    try {
      console.log(`[Jira Flow] Transition ${issueKey}: requesting available transitions...`);
      const data = await this.request(`issue/${issueKey}/transitions`);
      console.log(
        `[Jira Flow] Transition ${issueKey}: available transitions:`,
        data.transitions.map((t) => `[${t.id}] "${t.name}" \u2192 "${t.to.name}" (maps to: ${mapStatusToColumn(t.to.name)})`)
      );
      console.log(`[Jira Flow] Transition ${issueKey}: target column = "${targetColumnId}"`);
      let target = data.transitions.find(
        (t) => mapStatusToColumn(t.to.name) === targetColumnId
      );
      if (target) {
        console.log(`[Jira Flow] Transition ${issueKey}: matched via mapStatusToColumn \u2192 [${target.id}] "${target.name}"`);
      }
      if (!target) {
        target = data.transitions.find(
          (t) => t.to.name.toUpperCase() === targetColumnId.toUpperCase()
        );
        if (target) {
          console.log(`[Jira Flow] Transition ${issueKey}: matched via direct name \u2192 [${target.id}] "${target.name}"`);
        }
      }
      if (!target) {
        const colLower = targetColumnId.toLowerCase();
        target = data.transitions.find(
          (t) => t.name.toLowerCase().includes(colLower) || t.to.name.toLowerCase().includes(colLower)
        );
        if (target) {
          console.log(`[Jira Flow] Transition ${issueKey}: matched via keyword \u2192 [${target.id}] "${target.name}"`);
        }
      }
      if (!target) {
        console.warn(
          `[Jira Flow] Transition ${issueKey}: NO matching transition found for column "${targetColumnId}". Available:`,
          data.transitions.map((t) => `[${t.id}] "${t.name}" \u2192 "${t.to.name}" (${mapStatusToColumn(t.to.name)})`)
        );
        return { success: false };
      }
      const DONE_COLUMNS = /* @__PURE__ */ new Set(["DONE", "CLOSED", "RESOLVED"]);
      const isDoneStatus = DONE_COLUMNS.has(targetColumnId);
      const transitionBody = {
        transition: { id: target.id }
      };
      if (isDoneStatus) {
        transitionBody.fields = { resolution: { name: "Done" } };
        console.log(`[Jira Flow] Transition ${issueKey}: target is Done-category, injecting resolution field`);
      }
      console.log(`[Jira Flow] Transition ${issueKey}: executing transition [${target.id}] "${target.name}"...`);
      try {
        await this.request(`issue/${issueKey}/transitions`, "POST", transitionBody);
        console.log(`[Jira Flow] Transition ${issueKey}: transition succeeded`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isDoneStatus && (msg.includes("resolution") || msg.includes("Resolution"))) {
          console.warn(`[Jira Flow] Transition ${issueKey}: retrying with resolution field...`);
          try {
            await this.request(`issue/${issueKey}/transitions`, "POST", {
              transition: { id: target.id },
              fields: { resolution: { name: "Done" } }
            });
            console.log(`[Jira Flow] Transition ${issueKey}: retry with resolution succeeded`);
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2);
            console.error(`[Jira Flow] Transition ${issueKey}: retry also failed: ${msg2}`);
            return { success: false };
          }
        } else {
          console.error(`[Jira Flow] Transition ${issueKey}: POST failed: ${msg}`);
          return { success: false };
        }
      }
      try {
        const updated = await this.request(
          `issue/${issueKey}?fields=status`
        );
        const actualStatus = updated.fields.status.name;
        const actualColumn = mapStatusToColumn(actualStatus);
        console.log(`[Jira Flow] Transition ${issueKey}: post-transition status = "${actualStatus}" \u2192 column "${actualColumn}"`);
        return { success: true, actualStatus, actualColumn };
      } catch {
        console.warn(`[Jira Flow] Transition ${issueKey}: re-fetch failed, using expected values`);
        return { success: true, actualStatus: target.to.name, actualColumn: targetColumnId };
      }
    } catch (e) {
      console.error(`[Jira Flow] Transition ${issueKey}: unexpected error:`, e);
      return { success: false };
    }
  }
  /** Update issue fields on Jira (story points, due date, etc.) */
  async updateIssueFields(issueKey, fields) {
    try {
      console.log(`[Jira Flow] Updating ${issueKey} fields:`, fields);
      await this.request(`issue/${issueKey}`, "PUT", { fields });
      console.log(`[Jira Flow] Updated ${issueKey} successfully`);
      return true;
    } catch (e) {
      console.error(`[Jira Flow] Failed to update ${issueKey}:`, e);
      return false;
    }
  }
  /** Fetch full issue details including remote links (Confluence/Wiki pages) */
  async fetchIssue(issueKey) {
    try {
      const [issue, remoteLinks] = await Promise.all([
        this.request(`issue/${issueKey}?fields=${this.fieldsParam}&expand=renderedFields`),
        // Catch errors on remotelink just in case the endpoint fails, returning empty array
        this.request(`issue/${issueKey}/remotelink`).catch(() => [])
      ]);
      if (issue) {
        issue.remotelinks = remoteLinks;
        console.log(`[Jira Flow] Fetched ${remoteLinks.length} remote links for ${issueKey}`);
      }
      return issue;
    } catch (error) {
      console.error(`[Jira Flow] Failed to fetch issue ${issueKey}`, error);
      return null;
    }
  }
  async downloadImage(url) {
    const response = await requestUrl({
      url,
      headers: {
        Authorization: this.getAuthHeader()
      }
    });
    return response.arrayBuffer;
  }
};

// scripts/verify-bugAssigneeIdentityPreference.ts
var plugin = {
  settings: {
    jiraHost: "https://jira.example.com",
    jiraUsername: "wangph",
    jiraPassword: "secret"
  }
};
var jiraApi = new JiraApi(plugin);
var preferredAssignee = jiraApi.buildAssigneeField({
  accountId: "account-123",
  name: "wangph",
  key: "wangph-key"
});
if (!preferredAssignee || preferredAssignee.name !== "wangph") {
  throw new Error("buildAssigneeField \u5E94\u4F18\u5148\u4F7F\u7528 name\uFF0C\u907F\u514D\u628A accountId \u53D1\u7ED9\u5F53\u524D Jira \u5B9E\u4F8B");
}
var fallbackAssignee = jiraApi.buildAssigneeField({
  accountId: "account-123"
});
if (!fallbackAssignee || fallbackAssignee.accountId !== "account-123") {
  throw new Error("buildAssigneeField \u5728\u6CA1\u6709 name/key \u65F6\u4ECD\u5E94\u56DE\u9000\u5230 accountId");
}
console.log("bug assignee identity preference verification passed");
