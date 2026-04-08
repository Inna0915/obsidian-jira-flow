import { readFileSync } from "node:fs";
import { join } from "node:path";

const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");
const jiraSource = readFileSync(join(process.cwd(), "src", "api", "jira.ts"), "utf8");

const expectations: Array<[string, string, string]> = [
  [appSource, "assignIssueToCurrentUser", "App 缺少拖拽前自动指派自己的逻辑"],
  [appSource, '["FUNNEL", "DEFINING"].includes(originalColumn)', "App 缺少对需求池/定义中 bug 的限定条件"],
  [appSource, 'fm.issuetype.toLowerCase() === "bug"', "App 缺少 bug 类型判断"],
  [appSource, '!fm.assignee?.trim()', "App 缺少仅对未分配问题自动指派的保护"],
  [jiraSource, "async assignIssueToCurrentUser", "JiraApi 缺少自动指派当前用户接口"],
  [jiraSource, "accountId", "JiraApi 缺少对 accountId 的经办人赋值支持"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("bug auto assign on drag verification passed");