// scripts/verify-kanbanMissingFrontmatterRecovery.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var fileManagerSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "sync", "fileManager.ts"), "utf8");
var appSource = (0, import_node_fs.readFileSync)((0, import_node_path.join)(process.cwd(), "src", "components", "App.tsx"), "utf8");
var expectations = [
  [fileManagerSource, "missingFrontmatterWarnedPaths", "FileManager \u7F3A\u5C11 frontmatter \u7F13\u5B58\u7F3A\u5931\u7684\u53BB\u91CD\u8BCA\u65AD"],
  [fileManagerSource, "metadata cache has no frontmatter", "FileManager \u7F3A\u5C11 frontmatter \u7F13\u5B58\u7F3A\u5931\u65E5\u5FD7"],
  [appSource, "missingFrontmatterRetryCountRef", "\u770B\u677F\u7F3A\u5C11 frontmatter \u7F3A\u5931\u540E\u7684\u81EA\u52A8\u91CD\u8BD5\u8BA1\u6570"],
  [appSource, "Kanban load skipped", "\u770B\u677F\u7F3A\u5C11\u6F0F\u5361\u8BCA\u65AD\u65E5\u5FD7"],
  [appSource, "retryDelay", "\u770B\u677F\u7F3A\u5C11 frontmatter \u7F3A\u5931\u540E\u7684\u5EF6\u8FDF\u91CD\u8BD5\u903B\u8F91"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("kanban missing frontmatter recovery verification passed");
