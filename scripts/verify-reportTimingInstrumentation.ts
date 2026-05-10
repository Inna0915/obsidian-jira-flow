import { readFileSync } from "node:fs";
import { join } from "node:path";

const reportGeneratorSource = readFileSync(
  join(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
const aiServiceSource = readFileSync(
  join(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
const reportCenterSource = readFileSync(
  join(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);

const expectations: Array<[string, string, string]> = [
  [reportGeneratorSource, "Report timing", "ReportGenerator 缺少完整阶段时序日志"],
  [reportGeneratorSource, "usingPreloadedLogs", "ReportGenerator 缺少是否复用日志的诊断字段"],
  [reportGeneratorSource, "rawLogDays", "ReportGenerator 缺少原始日志天数统计"],
  [reportGeneratorSource, "filteredLogEntries", "ReportGenerator 缺少过滤后日志条数统计"],
  [aiServiceSource, "AI request started", "AIService 缺少请求开始日志"],
  [aiServiceSource, "AI request finished", "AIService 缺少请求结束日志"],
  [aiServiceSource, "max_tokens", "AIService 对模型输出缺少明确 token 上限"],
  [reportCenterSource, "Report generation requested", "ReportCenter 缺少报告生成入口日志"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("report timing instrumentation verification passed");