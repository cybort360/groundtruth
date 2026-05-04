/**
 * Gemma 4 Client — backend-agnostic
 *
 * Public API is identical to the original Ollama-only version.
 * Internally delegates to whichever backend is active (Ollama or Google).
 * Backend selection is controlled via Settings → data/settings.json.
 *
 * Auto mode: tries Ollama first (offline-capable), falls back to Google API.
 */

import type { GemmaMessage, ToolDefinition } from "@/types";
import { getBackend } from "./gemma-backends";

interface ChatResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
    thinking?: string;
  };
  done: boolean;
}

// ── Normalize backend response → ChatResponse (Ollama shape) ──────────────

async function callBackend(
  messages: GemmaMessage[],
  options?: {
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    thinking?: boolean;
  }
): Promise<ChatResponse> {
  const backend = await getBackend();
  const res = await backend.chat(messages, options);

  return {
    message: {
      role: "assistant",
      content: res.content,
      thinking: res.thinking,
      tool_calls: res.toolCalls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      })),
    },
    done: true,
  };
}

// ── Public API (unchanged from original gemma.ts) ─────────────────────────

export async function chat(
  messages: GemmaMessage[],
  options?: {
    tools?: ToolDefinition[];
    temperature?: number;
    maxTokens?: number;
    thinking?: boolean;
  }
): Promise<ChatResponse> {
  return callBackend(messages, options);
}

export async function chatWithImage(
  systemPrompt: string,
  userText: string,
  imageBase64: string,
  options?: { tools?: ToolDefinition[]; temperature?: number }
): Promise<ChatResponse> {
  const messages: GemmaMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText, images: [imageBase64] },
  ];
  return callBackend(messages, options);
}

export async function agenticLoop(
  messages: GemmaMessage[],
  tools: ToolDefinition[],
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  options?: { maxIterations?: number; thinking?: boolean }
): Promise<{
  finalResponse: string;
  toolCallHistory: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  thinkingTrace?: string;
}> {
  const maxIterations = options?.maxIterations ?? 10;
  const toolCallHistory: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];
  let thinkingTrace = "";
  const conversationMessages = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    const response = await callBackend(conversationMessages, {
      tools,
      thinking: options?.thinking,
      temperature: 0.3,
    });

    if (response.message.thinking) {
      thinkingTrace += response.message.thinking + "\n";
    }

    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
      return {
        finalResponse: response.message.content,
        toolCallHistory,
        thinkingTrace: thinkingTrace || undefined,
      };
    }

    conversationMessages.push({
      role: "assistant",
      content: response.message.content || "",
      tool_calls: response.message.tool_calls,
    });

    for (const toolCall of response.message.tool_calls) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments) as Record<string, unknown>
        : toolCall.function.arguments as Record<string, unknown>;
      const result = await toolExecutor(toolCall.function.name, args);

      toolCallHistory.push({ name: toolCall.function.name, args, result });

      conversationMessages.push({
        role: "tool",
        content: JSON.stringify(result),
        tool_call_id: toolCall.id,
      });
    }
  }

  return {
    finalResponse: conversationMessages[conversationMessages.length - 1].content,
    toolCallHistory,
    thinkingTrace: thinkingTrace || undefined,
  };
}

export async function complete(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<string> {
  const response = await callBackend(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: options?.temperature ?? 0.2 }
  );
  return response.message.content;
}
