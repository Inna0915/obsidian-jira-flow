// scripts/verify-dragReloadAndReportSelection.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var appSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "components", "App.tsx"), "utf8");
var reportCenterSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "components", "ReportCenter.tsx"), "utf8");
var reportGeneratorSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "ai", "reportGenerator.ts"), "utf8");
var expectations = [
  [appSource, "scheduleLoadCards(0)", "\u62D6\u62FD\u6210\u529F\u540E\u7F3A\u5C11\u663E\u5F0F\u770B\u677F\u91CD\u8F7D\uFF0C\u5361\u7247\u53EF\u80FD\u505C\u7559\u5728\u539F\u6CF3\u9053"],
  [reportCenterSource, "selectedReportTaskKeys", "\u62A5\u544A\u4E2D\u5FC3\u7F3A\u5C11\u4EFB\u52A1\u591A\u9009\u72B6\u6001"],
  [reportCenterSource, "selectedTaskSummaries:", "\u62A5\u544A\u4E2D\u5FC3\u751F\u6210\u5468\u62A5\u65F6\u6CA1\u6709\u4F20\u9012\u6240\u9009\u4EFB\u52A1\u6458\u8981"],
  [reportGeneratorSource, "selectedTaskSummaries?: string[]", "ReportGenerator \u7F3A\u5C11\u6240\u9009\u4EFB\u52A1\u6458\u8981\u5165\u53C2"],
  [reportGeneratorSource, "options?.selectedTaskSummaries", "ReportGenerator \u6CA1\u6709\u6D88\u8D39\u62A5\u544A\u754C\u9762\u7684\u6240\u9009\u4EFB\u52A1\u6458\u8981"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("drag reload and report selection verification passed");
