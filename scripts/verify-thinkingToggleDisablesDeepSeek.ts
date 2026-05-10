import { AIService } from "../src/ai/aiService";
import type { AIModelConfig } from "../src/types";

const encoder = new TextEncoder();
let capturedBody = "";

(globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
  capturedBody = String(init?.body ?? "");
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) {
              return { value: undefined, done: true };
            }
            done = true;
            return {
              value: encoder.encode('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n'),
              done: false,
            };
          },
        };
      },
    },
  } as any;
};

async function main() {
  const service = new AIService();
  const model: AIModelConfig = {
    id: "deepseek-custom",
    name: "deepseek",
    displayName: "deepseek",
    provider: "custom",
    baseUrl: "https://api.deepseek.com",
    apiKey: "test-key",
    model: "deepseek-v4-flash",
    enabled: true,
    enableThinking: false,
    enableStreaming: true,
  };

  await service.chatStream(model, [{ role: "user", content: "hello" }]);

  const payload = JSON.parse(capturedBody);
  if (!payload.thinking || payload.thinking.type !== "disabled") {
    throw new Error("关闭思考模式时，DeepSeek 请求体应显式发送 thinking.type = disabled");
  }
  if (payload.reasoning_effort !== undefined) {
    throw new Error("关闭思考模式时，不应继续发送 reasoning_effort");
  }

  console.log("thinking toggle disables deepseek verification passed");
}

void main();
