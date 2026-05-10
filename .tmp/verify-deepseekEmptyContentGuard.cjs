// scripts/verify-deepseekEmptyContentGuard.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var aiServiceSource = (0, import_node_fs.readFileSync)(
  (0, import_node_path.join)(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);
var expectations = [
  [aiServiceSource, "finishReason", "AIService \u7F3A\u5C11 finishReason \u8BCA\u65AD\u5B57\u6BB5"],
  [aiServiceSource, "reasoningChars", "AIService \u7F3A\u5C11 reasoningChars \u8BCA\u65AD\u5B57\u6BB5"],
  [aiServiceSource, "AI returned empty content", "AIService \u7F3A\u5C11\u7A7A\u5185\u5BB9\u4FDD\u62A4\uFF0C\u4ECD\u53EF\u80FD\u5199\u5165\u7A7A\u62A5\u544A"],
  [aiServiceSource, "shouldLimitOpenAICompatibleTokens(", "AIService \u7F3A\u5C11 OpenAI-compatible provider \u7684 token \u9650\u5236\u7B56\u7565"],
  [aiServiceSource, "isDeepSeekCompatibleModel(", "AIService \u7F3A\u5C11\u5BF9 DeepSeek \u517C\u5BB9\u6A21\u578B\u7684\u8BC6\u522B"],
  [aiServiceSource, "if (this.shouldLimitOpenAICompatibleTokens(model))", "AIService \u4ECD\u5728\u5BF9\u6240\u6709 custom provider \u5F3A\u5236\u52A0 max_tokens"]
];
for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}
console.log("deepseek empty content guard verification passed");
