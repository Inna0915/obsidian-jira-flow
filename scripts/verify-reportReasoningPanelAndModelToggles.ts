import { readFileSync } from "node:fs";
import { join } from "node:path";

const reportCenterSource = readFileSync(
  join(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);
const settingsSource = readFileSync(
  join(process.cwd(), "src", "settings.ts"),
  "utf8"
);
const typesSource = readFileSync(
  join(process.cwd(), "src", "types.ts"),
  "utf8"
);
const aiServiceSource = readFileSync(
  join(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);

const expectations: Array<[string, string, string]> = [
  [reportCenterSource, "<details", "ReportModal 缺少可折叠的思考过程面板"],
  [reportCenterSource, "实际时长", "ReportModal 缺少实际时长展示"],
  [reportCenterSource, "reportElapsedMs", "ReportCenter 缺少报告耗时状态"],
  [settingsSource, "思考模式", "AI 设置页缺少思考模式开关"],
  [settingsSource, "流式输出", "AI 设置页缺少流式输出开关"],
  [typesSource, "enableThinking", "AIModelConfig 缺少思考模式配置"],
  [typesSource, "enableStreaming", "AIModelConfig 缺少流式输出配置"],
  [aiServiceSource, "model.enableThinking", "AIService 未消费思考模式配置"],
  [aiServiceSource, "model.enableStreaming", "AIService 未消费流式输出配置"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("report reasoning panel and model toggles verification passed");
