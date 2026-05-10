// scripts/verify-reportGenerationOptimizationAndCopy.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var reportGeneratorSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
var reportCenterSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);
var expectations = [
  [reportGeneratorSource, "preloadedLogs?: DailyWorkLog[]", "ReportGenerator \u7F3A\u5C11\u590D\u7528\u5DF2\u52A0\u8F7D\u65E5\u5FD7\u7684\u5165\u53E3"],
  [reportGeneratorSource, "options?.preloadedLogs", "ReportGenerator \u4ECD\u672A\u590D\u7528\u5916\u90E8\u5DF2\u52A0\u8F7D\u65E5\u5FD7"],
  [reportGeneratorSource, "collectTaskContext(", "ReportGenerator \u4ECD\u5728\u591A\u6B21\u626B\u63CF\u4EFB\u52A1\u6587\u4EF6\uFF0C\u7F3A\u5C11\u5355\u6B21\u6536\u96C6\u4E0A\u4E0B\u6587"],
  [reportGeneratorSource, "buildLogSectionForPrompt(", "ReportGenerator \u7F3A\u5C11\u538B\u7F29\u65E5\u5FD7\u63D0\u4EA4\u5185\u5BB9\u7684\u903B\u8F91"],
  [reportCenterSource, "navigator.clipboard.writeText", "ReportCenter \u7F3A\u5C11\u590D\u5236\u5DF2\u9009\u4EFB\u52A1\u5185\u5BB9\u7684\u903B\u8F91"],
  [reportCenterSource, "\u590D\u5236", "ReportCenter \u7F3A\u5C11\u590D\u5236\u6309\u94AE"],
  [reportCenterSource, "preloadedLogs:", "ReportCenter \u751F\u6210\u62A5\u544A\u65F6\u6CA1\u6709\u4F20\u9012\u5DF2\u52A0\u8F7D\u65E5\u5FD7"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("report generation optimization and copy verification passed");
