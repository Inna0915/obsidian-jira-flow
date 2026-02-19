// ===== Plugin Settings =====
export type AIProvider = "kimi" | "gemini" | "claude" | "custom";

export interface AIModelConfig {
  id: string;
  name: string;
  displayName: string;
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ReportPrompts {
  weekly: string;
  monthly: string;
  quarterly: string;
  yearly: string;
}

export type ReportPeriod = "weekly" | "monthly" | "quarterly" | "yearly";

export interface AISettings {
  models: AIModelConfig[];
  activeModelId: string;
  reportPrompt: string; // legacy, kept for compat
  reportPrompts: ReportPrompts;
}

export interface JiraFlowSettings {
  jiraHost: string;
  jiraUsername: string;
  jiraPassword: string;
  projectKey: string;
  jql: string;
  rootFolder: string;
  tasksFolder: string;
  reportsFolder: string;
  assetsFolder: string;
  dailyNotesFolder: string;
  dailyNoteFormat: string;
  kanbanColumns: string[];
  autoSyncOnStartup: boolean;
  syncIntervalMinutes: number;
  storyPointsField: string;
  dueDateField: string;
  ai: AISettings;
}

export const BUILTIN_MODELS: AIModelConfig[] = [
  {
    id: "kimi-default",
    name: "moonshot-v1-8k",
    displayName: "Kimi (Moonshot)",
    provider: "kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    apiKey: "",
    model: "moonshot-v1-8k",
    enabled: false,
  },
  {
    id: "gemini-default",
    name: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-2.0-flash",
    enabled: false,
  },
  {
    id: "claude-default",
    name: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    provider: "claude",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    model: "claude-sonnet-4-20250514",
    enabled: false,
  },
];

// ===== Kanban Column Definitions (12 columns) =====
export interface ColumnDef {
  id: string;
  label: string;
  phase: string;
  color: string;
  headerColor: string;
}

export const KANBAN_COLUMNS: ColumnDef[] = [
  { id: "FUNNEL",            label: "FUNNEL",            phase: "Backlog",  color: "#F4F5F7", headerColor: "#6B778C" },
  { id: "DEFINING",          label: "DEFINING",          phase: "Backlog",  color: "#F4F5F7", headerColor: "#6B778C" },
  { id: "READY",             label: "READY",             phase: "Backlog",  color: "#DFE1E6", headerColor: "#42526E" },
  { id: "TO DO",             label: "TO DO",             phase: "Todo",     color: "#DFE1E6", headerColor: "#42526E" },
  { id: "EXECUTION",         label: "EXECUTION",         phase: "Active",   color: "#DEEBFF", headerColor: "#0052CC" },
  { id: "EXECUTED",          label: "EXECUTED",          phase: "Active",   color: "#DEEBFF", headerColor: "#0052CC" },
  { id: "TESTING & REVIEW",  label: "TESTING & REVIEW",  phase: "Testing",  color: "#EAE6FF", headerColor: "#6554C0" },
  { id: "TEST DONE",         label: "TEST DONE",         phase: "Testing",  color: "#EAE6FF", headerColor: "#6554C0" },
  { id: "VALIDATING",        label: "VALIDATING",        phase: "Validate", color: "#FFF0B3", headerColor: "#FF8B00" },
  { id: "RESOLVED",          label: "RESOLVED",          phase: "Done",     color: "#E3FCEF", headerColor: "#006644" },
  { id: "DONE",              label: "DONE",              phase: "Done",     color: "#E3FCEF", headerColor: "#006644" },
  { id: "CLOSED",            label: "CLOSED",            phase: "Done",     color: "#E3FCEF", headerColor: "#006644" },
];

export const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);

// ===== Swimlane Definitions =====
export type SwimlaneType = "overdue" | "onSchedule" | "others";

export interface SwimlaneDef {
  id: SwimlaneType;
  label: string;
  color: string;
}

export const SWIMLANES: SwimlaneDef[] = [
  { id: "overdue",    label: "OVERDUE",     color: "#FFEBE6" },
  { id: "onSchedule", label: "ON SCHEDULE", color: "#E6FCFF" },
  { id: "others",     label: "OTHERS",      color: "#F4F5F7" },
];

// ===== Status → Column Mapping =====
const EXACT_STATUS_MAP: Record<string, string> = {
  "funnel": "FUNNEL",
  "funnel 漏斗": "FUNNEL",
  "漏斗": "FUNNEL",
  "defining": "DEFINING",
  "defining 定义": "DEFINING",
  "定义": "DEFINING",
  "defining 细化": "DEFINING",
  "细化": "DEFINING",
  "ready": "READY",
  "ready 就绪": "READY",
  "就绪": "READY",
  "to do": "TO DO",
  "to do 待办": "TO DO",
  "待办": "TO DO",
  "open": "TO DO",
  "open 打开": "TO DO",
  "打开": "TO DO",
  "building": "EXECUTION",
  "building 构建中": "EXECUTION",
  "构建中": "EXECUTION",
  "in progress": "EXECUTION",
  "in progress 处理中": "EXECUTION",
  "处理中": "EXECUTION",
  "build done": "EXECUTED",
  "build done 构建完成": "EXECUTED",
  "构建完成": "EXECUTED",
  "in review": "TESTING & REVIEW",
  "in review 审核中": "TESTING & REVIEW",
  "审核中": "TESTING & REVIEW",
  "testing": "TESTING & REVIEW",
  "testing 测试中": "TESTING & REVIEW",
  "测试中": "TESTING & REVIEW",
  "integrating & testing": "TESTING & REVIEW",
  "integrating & testing 集成测试中": "TESTING & REVIEW",
  "集成测试中": "TESTING & REVIEW",
  "test done": "TEST DONE",
  "test done 测试完成": "TEST DONE",
  "测试完成": "TEST DONE",
  "validating": "VALIDATING",
  "validating 验证": "VALIDATING",
  "validating 验证中": "VALIDATING",
  "验证": "VALIDATING",
  "验证中": "VALIDATING",
  "resolved": "RESOLVED",
  "resolved 已解决": "RESOLVED",
  "已解决": "RESOLVED",
  "done": "DONE",
  "done 完成": "DONE",
  "完成": "DONE",
  "closed": "CLOSED",
  "closed 关闭": "CLOSED",
  "关闭": "CLOSED",
};

const FUZZY_KEYWORDS: Array<[string, string]> = [
  ["漏斗", "FUNNEL"], ["funnel", "FUNNEL"],
  ["定义", "DEFINING"], ["细化", "DEFINING"], ["defining", "DEFINING"],
  ["就绪", "READY"], ["ready", "READY"],
  ["待办", "TO DO"], ["to do", "TO DO"], ["open", "TO DO"],
  ["构建中", "EXECUTION"], ["处理中", "EXECUTION"], ["开始任务", "EXECUTION"],
  ["building", "EXECUTION"], ["in progress", "EXECUTION"],
  ["构建完成", "EXECUTED"], ["build done", "EXECUTED"],
  ["审核中", "TESTING & REVIEW"], ["测试中", "TESTING & REVIEW"], ["集成测试", "TESTING & REVIEW"],
  ["in review", "TESTING & REVIEW"], ["testing", "TESTING & REVIEW"], ["integrating", "TESTING & REVIEW"],
  ["测试完成", "TEST DONE"], ["test done", "TEST DONE"],
  ["验证", "VALIDATING"], ["validating", "VALIDATING"],
  ["已解决", "RESOLVED"], ["resolved", "RESOLVED"],
  ["完成", "DONE"], ["done", "DONE"],
  ["关闭", "CLOSED"], ["closed", "CLOSED"],
];

export function mapStatusToColumn(jiraStatus: string): string {
  const lower = jiraStatus.toLowerCase().trim();
  if (EXACT_STATUS_MAP[lower]) return EXACT_STATUS_MAP[lower];
  for (const [keyword, columnId] of FUZZY_KEYWORDS) {
    if (lower.includes(keyword)) return columnId;
  }
  return "TO DO";
}

// ===== Workflow Validation =====
const STORY_WORKFLOW: Record<string, string[]> = {
  "FUNNEL":           ["DEFINING"],
  "DEFINING":         ["READY", "FUNNEL"],
  "READY":            ["TO DO", "DEFINING"],
  "TO DO":            ["EXECUTION", "READY"],
  "EXECUTION":        ["EXECUTED", "TO DO"],
  "EXECUTED":         ["TESTING & REVIEW"],
  "TESTING & REVIEW": ["TEST DONE"],
  "TEST DONE":        ["VALIDATING"],
  "VALIDATING":       ["RESOLVED"],
  "RESOLVED":         ["DONE"],
  "DONE":             ["CLOSED"],
  "CLOSED":           [],
};

const BUG_WORKFLOW: Record<string, string[]> = {
  "FUNNEL":           ["DEFINING"],
  "DEFINING":         ["READY", "FUNNEL"],
  "READY":            ["TO DO", "DEFINING"],
  "TO DO":            ["EXECUTION", "READY"],
  "EXECUTION":        ["VALIDATING", "TO DO"],
  "EXECUTED":         ["TESTING & REVIEW"],
  "TESTING & REVIEW": ["TEST DONE"],
  "TEST DONE":        ["DONE"],
  "VALIDATING":       ["TEST DONE", "EXECUTION"],
  "RESOLVED":         ["DONE"],
  "DONE":             ["CLOSED"],
  "CLOSED":           [],
};

export function isTransitionAllowed(issueType: string, fromColumn: string, toColumn: string, source?: "JIRA" | "LOCAL"): boolean {
  if (fromColumn === toColumn) return false;
  // LOCAL tasks can be freely dragged to any column
  if (source === "LOCAL") return true;
  const workflow = issueType.toLowerCase() === "bug" ? BUG_WORKFLOW : STORY_WORKFLOW;
  const allowed = workflow[fromColumn];
  if (!allowed) return true;
  return allowed.includes(toColumn);
}

// ===== Swimlane Classification =====
const DONE_COLUMNS = new Set(["DONE", "CLOSED", "RESOLVED"]);

export function classifySwimlane(dueDate: string, mappedColumn: string): SwimlaneType {
  if (!dueDate) return "others";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today && !DONE_COLUMNS.has(mappedColumn)) return "overdue";
  return "onSchedule";
}

// ===== Default Settings =====
export const DEFAULT_SETTINGS: JiraFlowSettings = {
  jiraHost: "",
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
  dueDateField: "customfield_10329",
  ai: {
    models: [...BUILTIN_MODELS],
    activeModelId: "",
    reportPrompt: "Based on the following work logs and task data, generate a concise weekly summary report in Markdown format. Include: key accomplishments, tasks in progress, blockers, and priorities for next week.",
    reportPrompts: {
      weekly: `你是一位敏捷开发任务整理专家。请根据以下原始内容生成结构化周报，严格遵循以下处理规则：

【数据清洗规则】
1. 删除每条记录开头的英文-数字任务编号（如 PRDAPD-704、WMS-123、Feature/PRDAPD-XXX 等）
2. 识别"主功能项-标识"格式（如"转库单-20240201"、"出库单-临时"），提取"-"前的文字作为主功能项用于归类合并，相同主功能项的任务合并为一条描述
3. 状态判定：内容包含"EXECUTED 执行完成" → 本周已完成；不包含 → 本周预计完成

【输出格式】
本周已完成
1. 主功能项：任务简述
2. 主功能项：任务简述
3. 主功能项：任务简述

本周预计完成
1. 主功能项：任务简述
2. 主功能项：任务简述
3. 主功能项：任务简述

【约束】
- 去除技术细节（如SQL、方法名、异常堆栈），保留业务含义
- 同一主功能项多行记录合并为一行，用顿号或"及"连接
- 严禁输出解释性文字，直接给出结果`,
      monthly: `你是一位敏捷开发任务整理专家。请根据以下原始内容生成结构化月报，严格遵循以下处理规则：

【数据清洗规则】
1. 删除每条记录开头的英文-数字任务编号（如 PRDAPD-704、WMS-123、Feature/PRDAPD-XXX 等）
2. 识别"主功能项-标识"格式（如"转库单-20240201"、"出库单-临时"），提取"-"前的文字作为主功能项用于归类合并，相同主功能项的任务合并为一条描述
3. 状态判定：内容包含"EXECUTED 执行完成" → 本月已完成；不包含 → 本月预计完成

【输出格式】
本月已完成
1. 主功能项：任务简述
2. 主功能项：任务简述
3. 主功能项：任务简述

本月预计完成
1. 主功能项：任务简述
2. 主功能项：任务简述
3. 主功能项：任务简述

【约束】
- 去除技术细节（如SQL、方法名、异常堆栈），保留业务含义
- 同一主功能项多行记录合并为一行，用顿号或"及"连接
- 严禁输出解释性文字，直接给出结果`,
      quarterly: "Based on the following work logs and task data, generate a detailed quarterly review report in Markdown format. Include: major milestones achieved, project health overview, team velocity trends, key challenges and how they were addressed, and strategic priorities for next quarter.",
      yearly: "Based on the following work logs and task data, generate a comprehensive annual review report in Markdown format. Include: yearly highlights and achievements, project completion rates, growth metrics, lessons learned, and strategic goals for the coming year.",
    },
  },
};

// ===== Jira API Types =====
export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
}

export interface JiraStatus {
  name: string;
  statusCategory: {
    key: string;
    name: string;
  };
}

export interface JiraIssuetype {
  name: string;
  iconUrl: string;
}

export interface JiraPriority {
  name: string;
  iconUrl: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraIssueFields {
  summary: string;
  description: string | null;
  status: JiraStatus;
  issuetype: JiraIssuetype;
  priority: JiraPriority;
  assignee: JiraUser | null;
  created: string;
  updated: string;
  duedate: string | null;
  labels: string[];
  sprint?: JiraSprint | JiraSprint[] | null;
  [key: string]: unknown;
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
  renderedFields?: {
    description?: string;
  };
}

export interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

// ===== Task Frontmatter =====
export interface TaskFrontmatter {
  jira_key: string;
  source: "JIRA" | "LOCAL";
  status: string;
  mapped_column: string;
  issuetype: string;
  priority: string;
  story_points: number;
  due_date: string;
  assignee: string;
  sprint: string;
  sprint_state: string;
  tags: string[];
  summary: string;
  created: string;
  updated: string;
  archived?: boolean;
  archived_date?: string;
}

// ===== Kanban Types =====
export interface KanbanCard {
  filePath: string;
  jiraKey: string;
  source: "JIRA" | "LOCAL";
  status: string;
  mappedColumn: string;
  issuetype: string;
  priority: string;
  storyPoints: number;
  dueDate: string;
  assignee: string;
  summary: string;
  tags: string[];
  swimlane: SwimlaneType;
  sprint: string;
  archived?: boolean;
}

export interface KanbanColumn {
  name: string;
  cards: KanbanCard[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

// ===== Events =====
export interface SyncResult {
  created: number;
  updated: number;
  errors: string[];
}
