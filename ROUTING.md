# Complexity Router — How GroundTruth Decides Which Model to Use

## Overview

Not every cluster of signals needs the same model. GroundTruth runs a deterministic complexity assessment before sending any cluster to an LLM, then routes accordingly. Simple cases are handled locally. Hard cases escalate to the cloud. This is what we call **Agentic Escalation**.

## The Two Tiers

| Tier | Model | When used | Why |
|------|-------|-----------|-----|
| **Local** | Gemma 4 E4B via Ollama | Simple clusters | Fast, private, zero cost, fully offline |
| **Cloud** | Gemma 4 27B via Google AI Studio | Complex clusters | Deeper conflict resolution, more reasoning capacity |

## What Makes a Cluster "Complex"

The classifier (`src/lib/complexity-router.ts`) scores each cluster across four dimensions before any AI call:

### 1. Signal Count
More than 4 signals in a cluster → complexity increases. High signal count means more evidence to weigh and a higher chance of conflicting perspectives.

### 2. Geographic Spread (Haversine distance)
If the GPS coordinates of signals in a cluster span more than 200 metres, the situation covers a wide area. Wide spread increases the chance that different reporters are describing different parts of the same event.

### 3. Severity Range
If the difference between the highest and lowest severity scores across signals in a cluster is ≥ 2 (on a 1–5 scale), the signals are meaningfully disagreeing about how serious the situation is.

### 4. Direct Contradictions
If any two signals in the cluster have a severity difference ≥ 3, they are flagged as directly contradicting each other. This alone can trigger escalation.

## The Escalation Decision

```
complexity.level === "complex"
  → Agentic Escalation to Gemma 4 27B (Google AI Studio)

complexity.level === "simple"
  → Local inference via Gemma 4 E4B (Ollama)
```

A cluster is classified as **complex** if it meets any of:
- Signal count > 4
- GPS spread > 200m
- Severity range ≥ 2
- Any direct contradiction (severity diff ≥ 3)

Otherwise it is **simple** and stays on-device.

## Why This Matters

In a crisis, most reports are simple: two people describing the same thing at the same location. Running those through a 27B-parameter cloud model is wasteful, slow, and requires internet. The complexity router keeps ~70% of assessments local in the Lagos demo — they never touch the cloud.

The remaining 30% — where signals genuinely contradict each other, cover a wide area, or span a wide severity range — are where the larger model earns its place. These are the cases where getting it wrong costs the most.

## Agentic Escalation in Code

```typescript
// src/lib/complexity-router.ts
const complexity  = assessClusterComplexity(cluster.signals);
const backendType = routeBackendType(complexity, settings.backend);
const backend     = await getBackendByType(backendType);
```

Each event card on the dashboard shows which tier assessed it:
- **"Running offline"** (teal badge) — Gemma 4 E4B, local
- **"Cloud-assisted"** (violet badge) — Gemma 4 27B, Google AI Studio

## Backend Override

Users can override routing from the Settings page:
- **Auto** (default) — complexity router decides
- **Local only** — always use Ollama, never escalate
- **Google AI** — always use cloud model
