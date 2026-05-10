import { requestUrl } from "obsidian";
import type { AIModelConfig } from "../types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
  reasoningContent?: string;
}

interface ChatStreamHandlers {
  onReasoningUpdate?: (reasoningContent: string) => void;
  onContentUpdate?: (content: string) => void;
}

const DEFAULT_REPORT_MAX_TOKENS = 1800;

export class AIService {
  async chat(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
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

  async chatStream(
    model: AIModelConfig,
    messages: ChatMessage[],
    handlers: ChatStreamHandlers = {}
  ): Promise<ChatResponse> {
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

  async testModel(model: AIModelConfig): Promise<void> {
    await this.chat(model, [{ role: "user", content: "Hi" }]);
  }

  /** OpenAI-compatible API (Kimi, custom, etc.) */
  private async callOpenAICompatible(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const body = this.buildOpenAICompatibleRequestBody(model, messages, false);
    const startedAt = Date.now();
    console.info("[Jira Flow] AI request started", {
      provider: model.provider,
      model: model.model,
      endpoint: `${model.baseUrl}/chat/completions`,
      messageCount: messages.length,
      requestChars: JSON.stringify(body).length,
    });

    const resp = await requestUrl({
      url: `${model.baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
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
      reasoningChars: reasoningContent.length,
    });

    if (!content.trim()) {
      throw new Error(`AI returned empty content (finish_reason: ${finishReason}, reasoning_chars: ${reasoningContent.length})`);
    }

    return { content, reasoningContent };
  }

  private async callOpenAICompatibleStream(
    model: AIModelConfig,
    messages: ChatMessage[],
    handlers: ChatStreamHandlers
  ): Promise<ChatResponse> {
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
      stream: true,
    });

    const response = await fetch(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
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

    const processEventBlock = (eventBlock: string) => {
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
      stream: true,
    });

    if (!content.trim()) {
      throw new Error(`AI returned empty content (finish_reason: ${finishReason}, reasoning_chars: ${reasoningContent.length})`);
    }

    return { content, reasoningContent };
  }

  /** Anthropic Claude API */
  private async callClaude(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: model.model,
      max_tokens: DEFAULT_REPORT_MAX_TOKENS,
      messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
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
      requestChars: JSON.stringify(body).length,
    });

    const resp = await requestUrl({
      url: `${model.baseUrl}/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": model.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = resp.json;
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: resp.status,
      durationMs: Date.now() - startedAt,
      responseChars: data?.content?.[0]?.text?.length ?? 0,
    });
    const claudeText = data?.content?.[0]?.text;
    if (!claudeText?.trim()) {
      const errDetail = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
      throw new Error(`Claude API returned empty/error response: ${errDetail}`);
    }
    return { content: claudeText, reasoningContent: "" };
  }

  /** Google Gemini API */
  private async callGemini(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const contents = nonSystem.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens: DEFAULT_REPORT_MAX_TOKENS },
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
      requestChars: JSON.stringify(body).length,
    });

    const resp = await requestUrl({
      url: `${model.baseUrl}/models/${model.model}:generateContent?key=${model.apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = resp.json;
    console.info("[Jira Flow] AI request finished", {
      provider: model.provider,
      model: model.model,
      status: resp.status,
      durationMs: Date.now() - startedAt,
      responseChars: data?.candidates?.[0]?.content?.parts?.[0]?.text?.length ?? 0,
    });
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini request blocked: ${blockReason}`);
    }
    const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!geminiText?.trim()) {
      const errDetail = data?.error?.message ?? JSON.stringify(data).slice(0, 300);
      throw new Error(`Gemini API returned empty/error response: ${errDetail}`);
    }
    return { content: geminiText, reasoningContent: "" };
  }

  private shouldLimitOpenAICompatibleTokens(model: AIModelConfig): boolean {
    return !this.isDeepSeekCompatibleModel(model);
  }

  private buildOpenAICompatibleRequestBody(
    model: AIModelConfig,
    messages: ChatMessage[],
    stream: boolean
  ): Record<string, unknown> {
    const isDeepSeekModel = this.isDeepSeekCompatibleModel(model);
    const body: Record<string, unknown> = {
      model: model.model,
      messages,
      stream: true,
      ...(isDeepSeekModel
        ? {
            thinking: { type: model.enableThinking ? "enabled" : "disabled" },
            ...(model.enableThinking ? { reasoning_effort: "high" } : {}),
          }
        : {}),
    };

    if (!stream) {
      body.stream = false;
    }

    if (this.shouldLimitOpenAICompatibleTokens(model)) {
      body.max_tokens = DEFAULT_REPORT_MAX_TOKENS;
    }
    return body;
  }

  private isDeepSeekCompatibleModel(model: AIModelConfig): boolean {
    const fingerprint = `${model.provider} ${model.name} ${model.model} ${model.baseUrl}`.toLowerCase();
    return fingerprint.includes("deepseek");
  }

  private extractOpenAICompatibleText(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
            return item.text;
          }
          return "";
        })
        .join("")
        .trim();
    }

    return "";
  }
}
