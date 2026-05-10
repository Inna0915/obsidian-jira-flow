// scripts/verify-reportStreamingThinkingUi.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var aiServiceSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
var reportGeneratorSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
var reportCenterSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);
var expectations = [
  [aiServiceSource, "async chatStream(", "AIService \u7F3A\u5C11\u6D41\u5F0F\u804A\u5929\u5165\u53E3"],
  [aiServiceSource, "stream: true", "AIService \u7F3A\u5C11\u6D41\u5F0F\u8BF7\u6C42\u53C2\u6570"],
  [aiServiceSource, 'thinking: { type: "enabled" }', "AIService \u7F3A\u5C11 DeepSeek thinking \u53C2\u6570"],
  [aiServiceSource, 'reasoning_effort: "high"', "AIService \u7F3A\u5C11 DeepSeek reasoning_effort \u53C2\u6570"],
  [aiServiceSource, "getReader()", "AIService \u7F3A\u5C11\u6D41\u5F0F reader \u89E3\u6790"],
  [reportGeneratorSource, "onProgress?:", "ReportGenerator \u7F3A\u5C11\u6D41\u5F0F\u8FDB\u5EA6\u56DE\u8C03"],
  [reportGeneratorSource, "this.aiService.chatStream", "ReportGenerator \u672A\u63A5\u5165\u6D41\u5F0F AI \u8F93\u51FA"],
  [reportCenterSource, "thinkingContent", "ReportCenter \u7F3A\u5C11\u601D\u8003\u5185\u5BB9\u72B6\u6001"],
  [reportCenterSource, "onProgress:", "ReportCenter \u751F\u6210\u62A5\u544A\u65F6\u6CA1\u6709\u4F20\u5165\u6D41\u5F0F\u56DE\u8C03"],
  [reportCenterSource, "\u601D\u8003\u8FC7\u7A0B", "ReportModal \u7F3A\u5C11\u601D\u8003\u8FC7\u7A0B\u5C55\u793A\u533A"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("report streaming thinking ui verification passed");
