/**
 * Google Gemma API backend — hosted inference via Google AI Studio.
 *
 * Works for any user with a free API key from https://aistudio.google.com
 * No local installation needed. Requires internet.
 *
 * Uses the Gemini API format (contents/parts) and translates to/from the
 * Ollama-style interface used by the rest of the app.
 *
 * Tool calling and thinking mode are both supported by the Gemini API.
 */

import type { GemmaMessage, ToolDefinition } from "@/types";
import type { GemmaBackend, BackendChatOptions, BackendChatResponse } from "./types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ── Gemini API types ────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thought?: boolean;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  tools?: Array<{ functionDeclarations: GeminiFunctionDeclaration[] }>;
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    thinkingConfig?: { thinkingBudget: number };
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      role: string;
      parts: GeminiPart[];
    };
  }>;
}

// ── Translators ─────────────────────────────────────────────────────────────

/**
 * Convert Ollama-style messages to Gemini contents.
 * System messages are extracted separately as systemInstruction.
 */
function toGeminiContents(messages: GemmaMessage[]): {
  systemInstruction?: GeminiRequest["systemInstruction"];
  contents: GeminiContent[];
} {
  let systemText = "";
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemText += (systemText ? "\n\n" : "") + msg.content;
      continue;
    }

    if (msg.role === "user") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      // Images would go here as inlineData parts
      contents.push({ role: "user", parts });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments) as Record<string, unknown>
            : tc.function.arguments as Record<string, unknown>;
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
      }
      contents.push({ role: "model", parts });
      continue;
    }

    if (msg.role === "tool") {
      // Tool results: find the matching function call name from the last model message
      const lastModel = [...contents].reverse().find((c) => c.role === "model");
      const matchingCall = lastModel?.parts.find((p) => p.functionCall);
      const fnName = matchingCall?.functionCall?.name ?? "unknown_tool";

      let responseData: Record<string, unknown>;
      try {
        responseData = JSON.parse(msg.content) as Record<string, unknown>;
      } catch {
        responseData = { result: msg.content };
      }

      // Gemini expects tool results as a user turn
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: fnName, response: responseData } }],
      });
    }
  }

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
  };
}

/**
 * Convert Ollama tool definitions to Gemini functionDeclarations.
 */
function toGeminiFunctionDeclarations(tools: ToolDefinition[]): GeminiFunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

// ── Backend class ────────────────────────────────────────────────────────────

export class GoogleGemmaBackend implements GemmaBackend {
  readonly name = "google";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      // Lightweight check: list models
      const res = await fetch(
        `${GEMINI_BASE}/models?key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: GemmaMessage[], options?: BackendChatOptions): Promise<BackendChatResponse> {
    if (!this.apiKey) throw new Error("Google API key not configured. Add it in Settings.");

    const { systemInstruction, contents } = toGeminiContents(messages);

    const body: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.3,
        maxOutputTokens: options?.maxTokens ?? 4096,
        ...(options?.thinking ? { thinkingConfig: { thinkingBudget: 2048 } } : {}),
      },
    };

    if (systemInstruction) body.systemInstruction = systemInstruction;

    if (options?.tools && options.tools.length > 0) {
      body.tools = [{ functionDeclarations: toGeminiFunctionDeclarations(options.tools) }];
    }

    const url = `${GEMINI_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Gemma API error (${res.status}): ${err}`);
    }

    const data = await res.json() as GeminiResponse;
    const candidate = data.candidates[0];
    if (!candidate) throw new Error("Google Gemma API returned no candidates");

    const parts = candidate.content.parts;

    // Extract text content (skip thought parts)
    const textContent = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text!)
      .join("");

    // Extract thinking (thought=true parts)
    const thinkingContent = parts
      .filter((p) => p.text && p.thought)
      .map((p) => p.text!)
      .join("\n");

    // Extract function calls
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({
        id: `call_${i}`,
        name: p.functionCall!.name,
        args: p.functionCall!.args,
      }));

    return {
      content: textContent,
      thinking: thinkingContent || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
