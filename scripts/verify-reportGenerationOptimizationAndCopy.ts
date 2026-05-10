import { readFileSync } from "node:fs";
import { join } from "node:path";

const reportGeneratorSource = readFileSync(
  join(process.cwd(), "src", "ai", "reportGenerator.ts"),
  "utf8"
);
const reportCenterSource = readFileSync(
  join(process.cwd(), "src", "components", "ReportCenter.tsx"),
  "utf8"
);

const expectations: Array<[string, string, string]> = [
  [reportGeneratorSource, "preloadedLogs?: DailyWorkLog[]", "ReportGenerator 缺少复用已加载日志的入口"],
  [reportGeneratorSource, "options?.preloadedLogs", "ReportGenerator 仍未复用外部已加载日志"],
  [reportGeneratorSource, "collectTaskContext(", "ReportGenerator 仍在多次扫描任务文件，缺少单次收集上下文"],
  [reportGeneratorSource, "buildLogSectionForPrompt(", "ReportGenerator 缺少压缩日志提交内容的逻辑"],
  [reportCenterSource, "navigator.clipboard.writeText", "ReportCenter 缺少复制已选任务内容的逻辑"],
  [reportCenterSource, "复制", "ReportCenter 缺少复制按钮"],
  [reportCenterSource, "preloadedLogs:", "ReportCenter 生成报告时没有传递已加载日志"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("report generation optimization and copy verification passed");