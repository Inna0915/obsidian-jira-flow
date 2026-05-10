// scripts/verify-bugAutoAssignOnDrag.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var appSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "components", "App.tsx"), "utf8");
var jiraSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "api", "jira.ts"), "utf8");
var expectations = [
  [appSource, "assignIssueToCurrentUser", "App \u7F3A\u5C11\u62D6\u62FD\u524D\u81EA\u52A8\u6307\u6D3E\u81EA\u5DF1\u7684\u903B\u8F91"],
  [appSource, '["FUNNEL", "DEFINING"].includes(originalColumn)', "App \u7F3A\u5C11\u5BF9\u9700\u6C42\u6C60/\u5B9A\u4E49\u4E2D bug \u7684\u9650\u5B9A\u6761\u4EF6"],
  [appSource, 'fm.issuetype.toLowerCase() === "bug"', "App \u7F3A\u5C11 bug \u7C7B\u578B\u5224\u65AD"],
  [appSource, "!fm.assignee?.trim()", "App \u7F3A\u5C11\u4EC5\u5BF9\u672A\u5206\u914D\u95EE\u9898\u81EA\u52A8\u6307\u6D3E\u7684\u4FDD\u62A4"],
  [jiraSource, "async assignIssueToCurrentUser", "JiraApi \u7F3A\u5C11\u81EA\u52A8\u6307\u6D3E\u5F53\u524D\u7528\u6237\u63A5\u53E3"],
  [jiraSource, "accountId", "JiraApi \u7F3A\u5C11\u5BF9 accountId \u7684\u7ECF\u529E\u4EBA\u8D4B\u503C\u652F\u6301"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("bug auto assign on drag verification passed");
