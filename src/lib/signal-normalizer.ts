/**
 * Signal Normalizer
 *
 * Takes a raw report (any type) and extracts structured signal data
 * using Gemma 4's multimodal capabilities.
 */

import { v4 as uuid } from "uuid";
import { complete, chatWithImage } from "./gemma";
import { NORMALIZER_SYSTEM_PROMPT, buildNormalizerPrompt } from "./prompts/normalizer";
import type { Report, NormalizedSignal, NormalizerResult } from "@/types";

export async function normalizeReport(report: Report): Promise<NormalizedSignal> {
  const userPrompt = buildNormalizerPrompt({
    type: report.type,
    content: report.rawContent,
    latitude: report.latitude,
    longitude: report.longitude,
    submittedAt: report.submittedAt,
    locale: report.locale,
  });

  let responseText: string;

  if (report.type === "photo" && report.imageBase64) {
    // Use multimodal endpoint for photos
    const response = await chatWithImage(
      NORMALIZER_SYSTEM_PROMPT,
      userPrompt,
      report.imageBase64,
      { temperature: 0.2 }
    );
    responseText = response.message.content;
  } else {
    // Text-only for voice transcriptions and text reports
    responseText = await complete(NORMALIZER_SYSTEM_PROMPT, userPrompt, { temperature: 0.2 });
  }

  // Parse JSON response
  const parsed = parseJsonResponse<NormalizerResult>(responseText);

  return {
    id: uuid(),
    reportId: report.id,
    locationName: parsed.locationName || `Near ${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`,
    latitude: report.latitude,
    longitude: report.longitude,
    claim: parsed.claim,
    evidenceType: parsed.evidenceType || report.type as NormalizedSignal["evidenceType"],
    timestamp: report.submittedAt,
    severity: parsed.severity || 1,
    details: parsed.details || "",
    isFirsthand: parsed.isFirsthand ?? true,
    credibilityScore: 0, // Set by credibility scorer
    credibilityReasoning: "",
  };
}

/**
 * Parse a JSON response from Gemma, handling common formatting issues.
 * The model sometimes wraps JSON in markdown code blocks.
 */
function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const raw = JSON.parse(cleaned);
    // Convert snake_case keys to camelCase
    return convertKeys(raw) as T;
  } catch (e) {
    throw new Error(`Failed to parse Gemma response as JSON: ${text.slice(0, 200)}`);
  }
}

function convertKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}
