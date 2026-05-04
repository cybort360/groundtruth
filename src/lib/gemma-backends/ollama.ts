/**
 * Ollama backend — runs Gemma 4 locally.
 * Offline-capable once the model is pulled.
 */

import type { GemmaMessage, ToolDefinition } from "@/types";
import type { GemmaBackend, BackendChatOptions, BackendChatResponse } from "./types";

export class OllamaBackend implements GemmaBackend {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: GemmaMessage[], options?: BackendChatOptions): Promise<BackendChatResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }
    if (options?.thinking) {
      body.think = true;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      message: {
        role: string;
        content: string;
        thinking?: string;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string | Record<string, unknown> };
        }>;
      };
    };

    const toolCalls = data.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: typeof tc.function.arguments === "string"
        ? JSON.parse(tc.function.arguments) as Record<string, unknown>
        : tc.function.arguments,
    }));

    return {
      content: data.message.content,
      thinking: data.message.thinking,
      toolCalls,
    };
  }
}
