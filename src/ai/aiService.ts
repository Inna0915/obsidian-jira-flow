import { requestUrl } from "obsidian";
import type { AIModelConfig } from "../types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
}

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

  async testModel(model: AIModelConfig): Promise<void> {
    await this.chat(model, [{ role: "user", content: "Hi" }]);
  }

  /** OpenAI-compatible API (Kimi, custom, etc.) */
  private async callOpenAICompatible(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const resp = await requestUrl({
      url: `${model.baseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.model,
        messages,
      }),
    });
    const data = resp.json;
    return { content: data.choices[0].message.content };
  }

  /** Anthropic Claude API */
  private async callClaude(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: model.model,
      max_tokens: 4096,
      messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

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
    return { content: data.content[0].text };
  }

  /** Google Gemini API */
  private async callGemini(model: AIModelConfig, messages: ChatMessage[]): Promise<ChatResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const contents = nonSystem.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = { contents };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const resp = await requestUrl({
      url: `${model.baseUrl}/models/${model.model}:generateContent?key=${model.apiKey}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = resp.json;
    return { content: data.candidates[0].content.parts[0].text };
  }
}
