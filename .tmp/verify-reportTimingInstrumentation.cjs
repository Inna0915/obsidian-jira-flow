// scripts/verify-reportTimingInstrumentation.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var reportGeneratorSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
var aiServiceSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
var reportCenterSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);
var expectations = [
  [reportGeneratorSource, "Report timing", "ReportGenerator \u7F3A\u5C11\u5B8C\u6574\u9636\u6BB5\u65F6\u5E8F\u65E5\u5FD7"],
  [reportGeneratorSource, "usingPreloadedLogs", "ReportGenerator \u7F3A\u5C11\u662F\u5426\u590D\u7528\u65E5\u5FD7\u7684\u8BCA\u65AD\u5B57\u6BB5"],
  [reportGeneratorSource, "rawLogDays", "ReportGenerator \u7F3A\u5C11\u539F\u59CB\u65E5\u5FD7\u5929\u6570\u7EDF\u8BA1"],
  [reportGeneratorSource, "filteredLogEntries", "ReportGenerator \u7F3A\u5C11\u8FC7\u6EE4\u540E\u65E5\u5FD7\u6761\u6570\u7EDF\u8BA1"],
  [aiServiceSource, "AI request started", "AIService \u7F3A\u5C11\u8BF7\u6C42\u5F00\u59CB\u65E5\u5FD7"],
  [aiServiceSource, "AI request finished", "AIService \u7F3A\u5C11\u8BF7\u6C42\u7ED3\u675F\u65E5\u5FD7"],
  [aiServiceSource, "max_tokens", "AIService \u5BF9\u6A21\u578B\u8F93\u51FA\u7F3A\u5C11\u660E\u786E token \u4E0A\u9650"],
  [reportCenterSource, "Report generation requested", "ReportCenter \u7F3A\u5C11\u62A5\u544A\u751F\u6210\u5165\u53E3\u65E5\u5FD7"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("report timing instrumentation verification passed");
