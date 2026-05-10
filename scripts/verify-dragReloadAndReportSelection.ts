import { readFileSync } from "node:fs";
import { join } from "node:path";

const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");
const reportCenterSource = readFileSync(join(process.cwd(), "src", "components", "ReportCenter.tsx"), "utf8");
const reportGeneratorSource = readFileSync(join(process.cwd(), "src", "ai", "reportGenerator.ts"), "utf8");

const expectations: Array<[string, string, string]> = [
  [appSource, "scheduleLoadCards(0)", "拖拽成功后缺少显式看板重载，卡片可能停留在原泳道"],
  [reportCenterSource, "selectedReportTaskKeys", "报告中心缺少任务多选状态"],
  [reportCenterSource, "selectedTaskSummaries:", "报告中心生成周报时没有传递所选任务摘要"],
  [reportGeneratorSource, "selectedTaskSummaries?: string[]", "ReportGenerator 缺少所选任务摘要入参"],
  [reportGeneratorSource, "options?.selectedTaskSummaries", "ReportGenerator 没有消费报告界面的所选任务摘要"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("drag reload and report selection verification passed");