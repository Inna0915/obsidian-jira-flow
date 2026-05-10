import { readFileSync } from "node:fs";
import { join } from "node:path";

const aiServiceSource = readFileSync(
  join(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
const reportGeneratorSource = readFileSync(
  join(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
const reportCenterSource = readFileSync(
  join(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);

const expectations: Array<[string, string, string]> = [
  [aiServiceSource, "async chatStream(", "AIService 缺少流式聊天入口"],
  [aiServiceSource, "stream: true", "AIService 缺少流式请求参数"],
  [aiServiceSource, 'thinking: { type: "enabled" }', "AIService 缺少 DeepSeek thinking 参数"],
  [aiServiceSource, 'reasoning_effort: "high"', "AIService 缺少 DeepSeek reasoning_effort 参数"],
  [aiServiceSource, "getReader()", "AIService 缺少流式 reader 解析"],
  [reportGeneratorSource, "onProgress?:", "ReportGenerator 缺少流式进度回调"],
  [reportGeneratorSource, "this.aiService.chatStream", "ReportGenerator 未接入流式 AI 输出"],
  [reportCenterSource, "thinkingContent", "ReportCenter 缺少思考内容状态"],
  [reportCenterSource, "onProgress:", "ReportCenter 生成报告时没有传入流式回调"],
  [reportCenterSource, "思考过程", "ReportModal 缺少思考过程展示区"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("report streaming thinking ui verification passed");