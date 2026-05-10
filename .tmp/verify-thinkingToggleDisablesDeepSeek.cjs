// scripts/obsidianStub.ts
async function requestUrl() {
  throw new Error("obsidian requestUrl stub should not be called in this verification script");
}

// src/ai/aiService.ts
var DEFAULT_REPORT_MAX_TOKENS = 1800;
var AIService = class {
  async chat(model, messages) {
    switch (model.provider) {
      case "claude":
        return this.callClaude(model, messages);
      case "gemini":
        return this.callGemini(model, messages);
      case "kimi":
      case "custom":
      default:
        return this.callOpenAICompatible(model, messages);
    }
  }
  async chatStream(model, messages, handlers = {}) {
    if (!model.enableStreaming) {
      const result = await this.chat(model, messages);
      if (result.reasoningContent) {
        handlers.onReasoningUpdate?.(result.reasoningContent);
      }
      handlers.onContentUpdate?.(result.content);
      return result;
    }
    switch (model.provider) {
      case "kimi":
      case "custom":
      default:
        return this.callOpenAICompatibleStream(model, messages, handlers);
      case "claude":
      case "gemini": {
        const result = await this.chat(model, messages);
        handlers.onContentUpdate?.(result.content);
        return result;
      }
    }
  }
  async testModel(model) {
    await this.chat(model, [{ role: "user", content: "Hi" }]);
  }
  /** OpenAI-compatible API (Kimi, custom, etc.) */
  async callOpenAICompatible(model, messages) {
    const body = this.buildOpenAICompatibleRequestBody(model, messages, false);
    const startedAt = Date.now();
    console.info("[Jira Flow] AI request started", {
      provider: model.provider,
      model: model.model,
      endpoint: `${model.baseUrl}/chat/completions`,
      messageCount: messages.length,
      requestChars: JSON.stringify(body).length
    });
    const resp = await requestUrl({
      url: `${model.baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`
      },
      body: JSON.stringify(body)
    });
    const data = resp.json;
    const message = data?.choices?.[0]?.message;
    const content = this.extractOpenAICompatibleText(message?.content);
    const reasoningContent = typeof message?.reasoning_content === "string" ? message.reasoning_content : "";
    const finishReason = data?.choices?.[0]?.finish_reason ?? "unknown";
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: resp.status,
      durationMs: Date.now() - startedAt,
      finishReason,
      responseChars: content.length,
      reasoningChars: reasoningContent.length
    });
    if (!content.trim()) {
      throw new Error(`AI returned empty content (finish_reason: ${finishReason}, reasoning_chars: ${reasoningContent.length})`);
    }
    return { content, reasoningContent };
  }
  async callOpenAICompatibleStream(model, messages, handlers) {
    if (typeof fetch !== "function") {
      const result = await this.callOpenAICompatible(model, messages);
      if (result.reasoningContent) {
        handlers.onReasoningUpdate?.(result.reasoningContent);
      }
      handlers.onContentUpdate?.(result.content);
      return result;
    }
    const body = this.buildOpenAICompatibleRequestBody(model, messages, true);
    const startedAt = Date.now();
    console.info("[Jira Flow] AI request started", {
      provider: model.provider,
      model: model.model,
      endpoint: `${model.baseUrl}/chat/completions`,
      messageCount: messages.length,
      requestChars: JSON.stringify(body).length,
      stream: true
    });
    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Streaming request failed (${response.status}): ${errorText.slice(0, 500)}`);
    }
    if (!response.body) {
      const result = await this.callOpenAICompatible(model, messages);
      if (result.reasoningContent) {
        handlers.onReasoningUpdate?.(result.reasoningContent);
      }
      handlers.onContentUpdate?.(result.content);
      return result;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reasoningContent = "";
    let content = "";
    let finishReason = "unknown";
    const processEventBlock = (eventBlock) => {
      for (const rawLine of eventBlock.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) {
          continue;
        }
        const payloadText = line.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") {
          continue;
        }
        try {
          const payload = JSON.parse(payloadText);
          const choice = payload?.choices?.[0];
          if (!choice) {
            continue;
          }
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
          const delta = choice.delta ?? {};
          const reasoningDelta = this.extractOpenAICompatibleText(delta.reasoning_content);
          if (reasoningDelta) {
            reasoningContent += reasoningDelta;
            handlers.onReasoningUpdate?.(reasoningContent);
          }
          const contentDelta = this.extractOpenAICompatibleText(delta.content);
          if (contentDelta) {
            content += contentDelta;
            handlers.onContentUpdate?.(content);
          }
        } catch (error) {
          console.warn("[Jira Flow] Failed to parse AI stream event", error, payloadText);
        }
      }
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const eventBlock = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        processEventBlock(eventBlock);
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) {
      processEventBlock(buffer);
    }
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: response.status,
      durationMs: Date.now() - startedAt,
      finishReason,
      responseChars: content.length,
      reasoningChars: reasoningContent.length,
      stream: true
    });
    if (!content.trim()) {
      throw new Error(`AI returned empty content (finish_reason: ${finishReason}, reasoning_chars: ${reasoningContent.length})`);
    }
    return { content, reasoningContent };
  }
  /** Anthropic Claude API */
  async callClaude(model, messages) {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    const body = {
      model: model.model,
      max_tokens: DEFAULT_REPORT_MAX_TOKENS,
      messages: nonSystem.map((m) => ({ role: m.role, content: m.content }))
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }
    const startedAt = Date.now();
    console.info("[Jira Flow] AI request started", {
      provider: model.provider,
      model: model.model,
      endpoint: `${model.baseUrl}/messages`,
      messageCount: nonSystem.length + (systemMsg ? 1 : 0),
      requestChars: JSON.stringify(body).length
    });
    const resp = await requestUrl({
      url: `${model.baseUrl}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": model.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
    const data = resp.json;
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: resp.status,
      durationMs: Date.now() - startedAt,
      responseChars: data?.content?.[0]?.text?.length ?? 0
    });
    return { content: data.content[0].text, reasoningContent: "" };
  }
  /** Google Gemini API */
  async callGemini(model, messages) {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    const contents = nonSystem.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));
    const body = {
      contents,
      generationConfig: { maxOutputTokens: DEFAULT_REPORT_MAX_TOKENS }
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    const startedAt = Date.now();
    console.info("[Jira Flow] AI request started", {
      provider: model.provider,
      model: model.model,
      endpoint: `${model.baseUrl}/models/${model.model}:generateContent`,
      messageCount: nonSystem.length + (systemMsg ? 1 : 0),
      requestChars: JSON.stringify(body).length
    });
    const resp = await requestUrl({
      url: `${model.baseUrl}/models/${model.model}:generateContent?key=${model.apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = resp.json;
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: resp.status,
      durationMs: Date.now() - startedAt,
      responseChars: data?.candidates?.[0]?.content?.parts?.[0]?.text?.length ?? 0
    });
    return { content: data.candidates[0].content.parts[0].text, reasoningContent: "" };
  }
  shouldLimitOpenAICompatibleTokens(model) {
    return !this.isDeepSeekCompatibleModel(model);
  }
  buildOpenAICompatibleRequestBody(model, messages, stream) {
    const isDeepSeekModel = this.isDeepSeekCompatibleModel(model);
    const body = {
      model: model.model,
      messages,
      stream: true,
      ...isDeepSeekModel ? {
        thinking: { type: model.enableThinking ? "enabled" : "disabled" },
        ...model.enableThinking ? { reasoning_effort: "high" } : {}
      } : {}
    };
    if (!stream) {
      body.stream = false;
    }
    if (this.shouldLimitOpenAICompatibleTokens(model)) {
      body.max_tokens = DEFAULT_REPORT_MAX_TOKENS;
    }
    return body;
  }
  isDeepSeekCompatibleModel(model) {
    const fingerprint = `${model.provider} ${model.name} ${model.model} ${model.baseUrl}`.toLowerCase();
    return fingerprint.includes("deepseek");
  }
  extractOpenAICompatibleText(content) {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      }).join("").trim();
    }
    return "";
  }
};

// scripts/verify-thinkingToggleDisablesDeepSeek.ts
var encoder = new TextEncoder();
var capturedBody = "";
globalThis.fetch = async (_url, init) => {
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
              return { value: void 0, done: true };
            }
            done = true;
            return {
              value: encoder.encode('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n'),
              done: false
            };
          }
        };
      }
    }
  };
};
async function main() {
  const service = new AIService();
  const model = {
    id: "deepseek-custom",
    name: "deepseek",
    displayName: "deepseek",
    provider: "custom",
    baseUrl: "https://api.deepseek.com",
    apiKey: "test-key",
    model: "deepseek-v4-flash",
    enabled: true,
    enableThinking: false,
    enableStreaming: true
  };
  await service.chatStream(model, [{ role: "user", content: "hello" }]);
  const payload = JSON.parse(capturedBody);
  if (!payload.thinking || payload.thinking.type !== "disabled") {
    throw new Error("\u5173\u95ED\u601D\u8003\u6A21\u5F0F\u65F6\uFF0CDeepSeek \u8BF7\u6C42\u4F53\u5E94\u663E\u5F0F\u53D1\u9001 thinking.type = disabled");
  }
  if (payload.reasoning_effort !== void 0) {
    throw new Error("\u5173\u95ED\u601D\u8003\u6A21\u5F0F\u65F6\uFF0C\u4E0D\u5E94\u7EE7\u7EED\u53D1\u9001 reasoning_effort");
  }
  console.log("thinking toggle disables deepseek verification passed");
}
void main();
