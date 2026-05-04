/**
 * Credibility Scorer
 *
 * Evaluates each normalized signal for reliability.
 * Uses Gemma 4 for nuanced assessment, especially for photo evidence
 * where image-text consistency matters.
 */

import { complete, chatWithImage } from "./gemma";
import { CREDIBILITY_SYSTEM_PROMPT, buildCredibilityPrompt } from "./prompts/credibility";
import { getReport } from "./db";
import type { NormalizedSignal, CredibilityResult } from "@/types";

export async function scoreCredibility(signal: NormalizedSignal): Promise<CredibilityResult> {
  const prompt = buildCredibilityPrompt({
    claim: signal.claim,
    evidenceType: signal.evidenceType,
    timestamp: signal.timestamp,
    severity: signal.severity,
    details: signal.details,
    isFirsthand: signal.isFirsthand,
    currentTime: new Date().toISOString(),
  });

  let responseText: string;

  // For photo signals, include the image in the credibility check
  // so the model can verify image-text consistency
  if (signal.evidenceType === "photo") {
    const report = getReport(signal.reportId);
    if (report?.imageBase64) {
      const response = await chatWithImage(
        CREDIBILITY_SYSTEM_PROMPT,
        prompt,
        report.imageBase64,
        { temperature: 0.2 }
      );
      responseText = response.message.content;
    } else {
      responseText = await complete(CREDIBILITY_SYSTEM_PROMPT, prompt, { temperature: 0.2 });
    }
  } else {
    responseText = await complete(CREDIBILITY_SYSTEM_PROMPT, prompt, { temperature: 0.2 });
  }

  return parseCredibilityResponse(responseText);
}

function parseCredibilityResponse(text: string): CredibilityResult {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    const raw = JSON.parse(cleaned);
    return {
      overallScore: raw.overall_score ?? raw.overallScore ?? 0.5,
      recencyScore: raw.recency_score ?? raw.recencyScore ?? 0.5,
      evidenceScore: raw.evidence_score ?? raw.evidenceScore ?? 0.5,
      specificityScore: raw.specificity_score ?? raw.specificityScore ?? 0.5,
      consistencyScore: raw.consistency_score ?? raw.consistencyScore ?? 0.5,
      reasoning: raw.reasoning ?? "No reasoning provided.",
    };
  } catch {
    // Fallback: if JSON parsing fails, assign a moderate score
    console.error("Failed to parse credibility response:", text.slice(0, 200));
    return {
      overallScore: 0.5,
      recencyScore: 0.5,
      evidenceScore: 0.5,
      specificityScore: 0.5,
      consistencyScore: 0.5,
      reasoning: "Credibility assessment could not be parsed. Default moderate score assigned.",
    };
  }
}
