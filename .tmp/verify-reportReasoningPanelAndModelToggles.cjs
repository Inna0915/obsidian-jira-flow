// scripts/verify-reportReasoningPanelAndModelToggles.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var reportCenterSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);
var settingsSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "settings.ts"),
  "utf8"
);
var typesSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "types.ts"),
  "utf8"
);
var aiServiceSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
var expectations = [
  [reportCenterSource, "<details", "ReportModal \u7F3A\u5C11\u53EF\u6298\u53E0\u7684\u601D\u8003\u8FC7\u7A0B\u9762\u677F"],
  [reportCenterSource, "\u5B9E\u9645\u65F6\u957F", "ReportModal \u7F3A\u5C11\u5B9E\u9645\u65F6\u957F\u5C55\u793A"],
  [reportCenterSource, "reportElapsedMs", "ReportCenter \u7F3A\u5C11\u62A5\u544A\u8017\u65F6\u72B6\u6001"],
  [settingsSource, "\u601D\u8003\u6A21\u5F0F", "AI \u8BBE\u7F6E\u9875\u7F3A\u5C11\u601D\u8003\u6A21\u5F0F\u5F00\u5173"],
  [settingsSource, "\u6D41\u5F0F\u8F93\u51FA", "AI \u8BBE\u7F6E\u9875\u7F3A\u5C11\u6D41\u5F0F\u8F93\u51FA\u5F00\u5173"],
  [typesSource, "enableThinking", "AIModelConfig \u7F3A\u5C11\u601D\u8003\u6A21\u5F0F\u914D\u7F6E"],
  [typesSource, "enableStreaming", "AIModelConfig \u7F3A\u5C11\u6D41\u5F0F\u8F93\u51FA\u914D\u7F6E"],
  [aiServiceSource, "model.enableThinking", "AIService \u672A\u6D88\u8D39\u601D\u8003\u6A21\u5F0F\u914D\u7F6E"],
  [aiServiceSource, "model.enableStreaming", "AIService \u672A\u6D88\u8D39\u6D41\u5F0F\u8F93\u51FA\u914D\u7F6E"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("report reasoning panel and model toggles verification passed");
