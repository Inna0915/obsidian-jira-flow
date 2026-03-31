import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "components", "TaskDetailModal.tsx"), "utf8");

const expectations = [
  ["当天", "缺少当天快捷日期按钮"],
  ["+1天", "缺少 +1 天快捷日期按钮"],
  ["本周六", "缺少本周六快捷日期按钮"],
  ["下周六", "缺少下周六快捷日期按钮"],
  ["showSaveToJira && isStoryPointsDirty && (", "故事点提交按钮应仅在修改后出现"],
  ["人员", "缺少人员信息分组展示"],
  ["报告人", "缺少报告人展示"],
  ["创建时间", "缺少创建时间展示"],
  ["最近更新", "缺少最近更新时间展示"],
  ["jf-h-8 jf-w-8", "故事点提交按钮尺寸还不够大"],
];

for (const [needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const forbiddenSnippets = [
  [
    "jf-mb-5 jf-flex jf-flex-wrap jf-items-center jf-justify-between jf-gap-3 jf-rounded-lg jf-border jf-border-gray-200 jf-bg-gray-50 jf-p-3",
    "旧的底部灰色快捷操作区还没有移除",
  ],
  [
    "jf-flex jf-flex-wrap jf-items-center jf-gap-2",
    "截止日期快捷按钮还会换行",
  ],
];

for (const [needle, message] of forbiddenSnippets) {
  if (source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("task detail quick actions verification passed");
