/**
 * Shared types for the Gemma inference backend abstraction.
 *
 * GroundTruth supports two backends:
 *   - Ollama (local, offline-capable) — default for developers and self-hosters
 *   - Google Gemma API (hosted, works for anyone with an API key)
 *
 * The active backend is selected via Settings and stored in data/settings.json.
 * Auto mode tries Ollama first, falls back to Google if Ollama isn't running.
 */

import type { GemmaMessage, ToolDefinition } from "@/types";

export interface BackendChatOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
}

export interface BackendChatResponse {
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

export interface GemmaBackend {
  readonly name: string;
  chat(messages: GemmaMessage[], options?: BackendChatOptions): Promise<BackendChatResponse>;
  isAvailable(): Promise<boolean>;
}

export type BackendType = "auto" | "ollama" | "google";

export interface AppSettings {
  backend: BackendType;
  googleApiKey: string;
  googleModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  backend: "auto",
  googleApiKey: "",
  googleModel: "gemma-4-27b-it",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "gemma4:e4b",
};
