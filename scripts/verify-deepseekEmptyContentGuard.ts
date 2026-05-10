import { readFileSync } from "node:fs";
import { join } from "node:path";

const aiServiceSource = readFileSync(
  join(process.cwd(), "src", "ai", "aiService.ts"),
  "utf8"
);

const expectations: Array<[string, string, string]> = [
  [aiServiceSource, "finishReason", "AIService 缺少 finishReason 诊断字段"],
  [aiServiceSource, "reasoningChars", "AIService 缺少 reasoningChars 诊断字段"],
  [aiServiceSource, "AI returned empty content", "AIService 缺少空内容保护，仍可能写入空报告"],
  [aiServiceSource, "shouldLimitOpenAICompatibleTokens(", "AIService 缺少 OpenAI-compatible provider 的 token 限制策略"],
  [aiServiceSource, "isDeepSeekCompatibleModel(", "AIService 缺少对 DeepSeek 兼容模型的识别"],
  [aiServiceSource, "if (this.shouldLimitOpenAICompatibleTokens(model))", "AIService 仍在对所有 custom provider 强制加 max_tokens"],
];

for (const [source, needle, message] of expectations) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

console.log("deepseek empty content guard verification passed");