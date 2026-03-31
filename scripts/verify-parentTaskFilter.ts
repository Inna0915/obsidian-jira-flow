import { readFileSync } from "node:fs";
import { join } from "node:path";

const typesSource = readFileSync(join(process.cwd(), "src", "types.ts"), "utf8");
const fileManagerSource = readFileSync(join(process.cwd(), "src", "sync", "fileManager.ts"), "utf8");
const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");

const expectations: Array<[string, string, string]> = [
  [typesSource, "parent_key", "缺少父任务 key 字段定义"],
  [typesSource, "parent_summary", "缺少父任务 summary 字段定义"],
  [fileManagerSource, "parent_key", "缺少父任务 frontmatter 落盘逻辑"],
  [appSource, "selectedParentKeys", "App 缺少父任务筛选状态"],
  [appSource, "父任务筛选", "缺少父任务筛选工具栏"],
  [appSource, "showParentFilterPanel", "缺少父任务筛选栏展开/收起状态"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("parent task filter verification passed");