import { readFileSync } from "node:fs";
import { join } from "node:path";

const fileManagerSource = readFileSync(join(process.cwd(), "src", "sync", "fileManager.ts"), "utf8");
const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");

const expectations: Array<[string, string, string]> = [
  [fileManagerSource, "missingFrontmatterWarnedPaths", "FileManager 缺少 frontmatter 缓存缺失的去重诊断"],
  [fileManagerSource, "metadata cache has no frontmatter", "FileManager 缺少 frontmatter 缓存缺失日志"],
  [appSource, "missingFrontmatterRetryCountRef", "看板缺少 frontmatter 缺失后的自动重试计数"],
  [appSource, "Kanban load skipped", "看板缺少漏卡诊断日志"],
  [appSource, "retryDelay", "看板缺少 frontmatter 缺失后的延迟重试逻辑"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("kanban missing frontmatter recovery verification passed");
