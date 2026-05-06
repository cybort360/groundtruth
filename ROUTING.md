# Complexity Router — How GroundTruth Decides Which Model to Use

## Overview

Not every cluster of signals needs the same model. GroundTruth runs a deterministic complexity assessment before sending any cluster to an LLM, then routes accordingly. Simple cases are handled locally. Hard cases escalate to the cloud. This is what we call **Agentic Escalation**.

## The Two Tiers

| Tier | Model | When used | Why |
|------|-------|-----------|-----|
| **Local** | Gemma 4 E4B via Ollama | Simple clusters | Fast, private, zero cost, fully offline |
| **Cloud** | Gemma 4 27B via Google AI Studio | Complex clusters | Deeper conflict resolution, more reasoning capacity |

## What Makes a Cluster "Complex"

The classifier (`src/lib/complexity-router.ts`) checks three conditions before any AI call. A cluster is classified as **complex** if any condition is met:

### 1. Geographic Spread with Multiple Reporters
If 3 or more signals in a cluster have GPS coordinates spanning more than **200 metres** apart (measured by pairwise Haversine distance), they are likely describing different parts of the same event — or actively disagreeing about location. This requires deeper synthesis than a local model can reliably provide.

### 2. Severity Range
If the difference between the highest and lowest severity scores across signals is **≥ 2** on the 1–5 scale — e.g. one report says "minor", another says "critical" — the cluster contains a meaningful contradiction that warrants the larger model's reasoning capacity.

### 3. High Signal Volume
Clusters with **5 or more signals** are routed to the cloud regardless of spread or severity range. High volume means more evidence to weigh, more potential for conflicting perspectives, and a stronger benefit from extended-context reasoning.

## The Escalation Decision

```
complexity.level === "complex"
  → Agentic Escalation to Gemma 4 27B (Google AI Studio)

complexity.level === "simple"
  → Local inference via Gemma 4 E4B (Ollama)
```

A cluster stays **simple** (on-device) only if none of the three conditions above are met: fewer than 3 signals with wide GPS spread, severity range < 2, and fewer than 5 signals total.

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
