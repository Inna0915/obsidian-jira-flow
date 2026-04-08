import { readFileSync } from "node:fs";
import { join } from "node:path";

const cardSource = readFileSync(join(process.cwd(), "src", "components", "Card.tsx"), "utf8");
const listSource = readFileSync(join(process.cwd(), "src", "components", "IssueListView.tsx"), "utf8");
const appSource = readFileSync(join(process.cwd(), "src", "components", "App.tsx"), "utf8");

const expectations: Array<[string, string, string]> = [
  [cardSource, 'case "enabler"', "Card 缺少 Enabler 类型样式映射"],
  [cardSource, 'Enabler: "EN"', "Card 缺少 Enabler 类型图标"],
  [listSource, 'Enabler: { bg:', "列表视图缺少 Enabler 类型样式"],
  [appSource, 'handleBatchDueDateUpdate', "App 缺少批量日期更新逻辑"],
  [appSource, '当天', "缺少批量设置当天按钮"],
  [appSource, '+1', "缺少批量顺延 1 天按钮"],
  [appSource, '本周六', "缺少批量设置本周六按钮"],
  [appSource, '已批量更新', "缺少批量更新结果提示"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("enabler batch due date verification passed");