# GroundTruth — Offline Situational Awareness Engine

## What This Project Is

An offline-first AI system for the **Gemma 4 Good Hackathon** on Kaggle ($200K prize pool, deadline May 18, 2026).

The system helps people understand what is happening around them when information is fragmented, unreliable, or unavailable. It collects local signals (photos, voice notes, text reports), reasons over conflicting inputs using on-device Gemma 4, and produces probability-based event assessments with transparent confidence scores.

**Primary demo scenario:** Urban flooding. But the architecture is scenario-agnostic.

## Why This Wins

1. Uses Gemma 4's differentiating features deeply: multimodal (image + audio), native function calling, reasoning/thinking mode, edge deployment
2. Solves a real problem: during crises, conflicting information kills people
3. Runs 100% offline — proves why open local models matter vs cloud APIs
4. Transparent reasoning chains — the model shows its work, which fits the Safety & Trust angle too

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Next.js 14 (App Router)
- **AI:** Gemma 4 E4B via Ollama REST API (localhost:11434)
- **Database:** SQLite via better-sqlite3 (local, offline-compatible)
- **Map:** Leaflet.js with offline tile support
- **Styling:** Tailwind CSS
- **Deployment (live demo):** Vercel (frontend) + Hugging Face Spaces (inference backend)

## Architecture Overview

```
Signal Input (photo/voice/text)
    ↓
Signal Normalizer (Gemma 4 call)
    → Extracts: location, timestamp, claim, evidence_type, raw_content
    ↓
Credibility Scorer (Gemma 4 call)
    → Scores: recency, evidence_strength, specificity, corroboration
    ↓
Reasoning Engine (Gemma 4 with thinking mode)
    → Groups signals by proximity
    → Detects contradictions
    → Weighs evidence
    → Uses function calling: geo_cluster(), check_history(), assess_risk(), update_event()
    → Outputs: event assessment + confidence score + reasoning chain
    ↓
Dashboard
    → Event cards with confidence %
    → Conflict view (competing reports side-by-side)
    → Map with color-coded risk zones
    → Action advisor (routing suggestions)
```

## Project Structure

```
groundtruth/
├── CLAUDE.md                          # This file
├── PROJECT_SPEC.md                    # Full specification
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Dashboard page
│   │   ├── report/page.tsx            # Report submission page
│   │   └── api/
│   │       ├── reports/route.ts       # POST: submit report, GET: list reports
│   │       ├── events/route.ts        # GET: assessed events
│   │       └── reasoning/route.ts     # POST: trigger reasoning engine
│   ├── lib/
│   │   ├── gemma.ts                   # Ollama client wrapper
│   │   ├── db.ts                      # SQLite setup + queries
│   │   ├── signal-normalizer.ts       # Normalize any input to structured signal
│   │   ├── credibility-scorer.ts      # Score signal reliability
│   │   ├── reasoning-engine.ts        # Core: conflict resolution + event synthesis
│   │   ├── tools/
│   │   │   ├── index.ts               # Tool registry + dispatcher
│   │   │   ├── geo-cluster.ts         # Group signals by proximity
│   │   │   ├── check-history.ts       # Past events at location
│   │   │   ├── assess-risk.ts         # Flood zone + elevation lookup
│   │   │   └── update-event.ts        # Merge signal into event
│   │   └── prompts/
│   │       ├── normalizer.ts          # System prompt for signal extraction
│   │       ├── credibility.ts         # System prompt for scoring
│   │       └── reasoning.ts           # System prompt for conflict resolution
│   ├── components/
│   │   ├── ReportForm.tsx             # Multi-modal report submission
│   │   ├── EventCard.tsx              # Single event with confidence + reasoning
│   │   ├── ConflictView.tsx           # Side-by-side conflicting reports
│   │   ├── MapView.tsx                # Leaflet map with risk zones
│   │   ├── Dashboard.tsx              # Main dashboard layout
│   │   └── ActionAdvisor.tsx          # Route recommendations
│   └── types/
│       └── index.ts                   # TypeScript interfaces
├── data/
│   ├── flood-zones.json               # Pre-loaded flood zone data for demo city
│   ├── elevation.json                  # Elevation data for demo area
│   └── history.json                    # Historical flood events
└── public/
    └── tiles/                          # Offline map tiles for demo area
```

## Key Conventions

- All Gemma 4 interactions go through `src/lib/gemma.ts` — never call Ollama directly from components or routes
- System prompts live in `src/lib/prompts/` as exported template literal functions
- Function calling tools follow the schema in PROJECT_SPEC.md — each tool exports a `definition` (for Gemma) and an `execute` function
- All database operations go through `src/lib/db.ts`
- Use TypeScript strict mode everywhere
- Components are client components only when they need interactivity (use "use client" directive)

## Running Locally

```bash
# Prerequisites: Ollama installed with Gemma 4 E4B
ollama pull gemma4:e4b

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run dev server
npm run dev
```

## Hackathon Requirements Checklist

- [ ] Kaggle Writeup (1500 words max)
- [ ] YouTube video (3 min max) — demo the flood scenario
- [ ] Public GitHub repo with documented code
- [ ] Live demo URL (Vercel + HF Spaces)
- [ ] Cover image for media gallery

## Critical Path

The reasoning engine (`src/lib/reasoning-engine.ts`) is the core differentiator. It must:
1. Group signals by geographic proximity using geo_cluster()
2. Identify contradicting claims about the same location/event
3. Weigh evidence using credibility scores
4. Produce a natural-language reasoning chain explaining its assessment
5. Output a confidence percentage that feels calibrated (not always 50% or 95%)

Spend the most time here. Everything else is plumbing.
