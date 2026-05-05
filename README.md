# GroundTruth: Offline Situational Awareness Engine

> During a crisis, conflicting information kills.
> GroundTruth weighs every report against every other and tells you what's actually happening — even when the internet is down.

**Built for the [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) on Kaggle.**

---

## The Problem

When flooding hits, social media fills with contradictory reports. One person says the road is passable. Another says cars are submerged. Emergency responders and residents have no way to know who's right, so they either freeze or take dangerous guesses.

Standard AI tools need cloud connectivity to work. Crises are precisely when cell towers go down, internet fails, and you're on your own.

## What It Does

GroundTruth is a fully offline situational awareness engine that runs Gemma 4 on-device. It:

1. **Collects multi-modal reports** — photos, voice notes, and text from anyone nearby
2. **Normalizes every signal** — Gemma 4 extracts structured claims from raw input
3. **Scores credibility** — each signal gets a reliability score based on evidence type, specificity, and corroboration
4. **Routes by complexity** — simple clusters are handled locally by Gemma E4B; high-conflict clusters automatically escalate to Gemma 27B via Google AI
5. **Resolves conflicts** — Gemma 4's native thinking mode (`<|think|>`) detects contradictions, weighs evidence, and produces a transparent chain-of-thought
6. **Outputs calibrated assessments** — not "flooding detected" but "88% confidence, Critical severity, avoid the Lekki-Epe underpass"
7. **Guides emergency action** — a built-in rescue panel surfaces local emergency numbers, pre-composes an SMS with your GPS location, and provides dispatcher guidance — all without internet

All of this runs on a single device with no internet required.

---

## Why Gemma 4

GroundTruth uses Gemma 4's differentiating features directly, not superficially:

| Feature | How We Use It |
|---|---|
| **Multimodal** | Photos submitted as reports are analyzed directly; Gemma 4 extracts water depth, damage severity, and location context from images |
| **Extended context** | All signals for a geographic cluster are reasoned over in a single long-context pass |
| **Native thinking mode** | The reasoning engine seeds each cluster assessment with `<|think|>`, forcing Gemma into chain-of-thought before any tool calls. The full trace is stored per event and shown to users on demand |
| **Function calling** | The reasoning engine calls `geo_cluster()`, `check_history()`, `assess_risk()`, and `update_event()` as native tools, not string parsing |
| **Edge deployment** | Runs via Ollama on any laptop or Raspberry Pi with no cloud dependency |

---

## Architecture

```
Signal Input (photo / voice / text)
        │
        ▼
Signal Normalizer          ← Gemma 4: extract location, claim, evidence type, severity
        │
        ▼
Credibility Scorer         ← Gemma 4: score recency, specificity, corroboration
        │
        ▼
Complexity Router          ← deterministic: GPS spread, severity range, signal count
  ├── simple cluster  ──▶  Gemma E4B (Ollama, on-device)
  └── complex cluster ──▶  Gemma 27B (Google AI API, escalated)
        │
        ▼
Reasoning Engine           ← Gemma 4 (thinking mode + function calling)
  ├── <|think|> seed          chain-of-thought before any tool call
  ├── geo_cluster()           group nearby signals
  ├── check_history()         compare against past events
  ├── assess_risk()           flood zone + elevation lookup
  └── update_event()          persist event with confidence + reasoning chain
        │
        ▼
Dashboard
  ├── Event cards — severity badge, confidence ring, thinking trace
  ├── Conflict view — competing reports side-by-side
  ├── Map — color-coded risk zones (hidden in low-bandwidth mode)
  ├── Filter — sort, confidence threshold, 7-day timeframe
  └── Emergency panel — local rescue numbers, GPS-linked SMS, dispatcher guidance
```

---

## Key Features

### Intelligent Routing (Complexity-Based)

Not every cluster needs the same model. GroundTruth assesses each signal cluster before sending it to an LLM:

- **Simple clusters** (low signal count, tight GPS spread, consistent severity) → Gemma E4B runs locally via Ollama. Fast, private, zero cost.
- **Complex clusters** (5+ signals, GPS spread >200m, severity range ≥ 2, direct contradictions) → automatically escalated to Gemma 27B via Google AI for deeper conflict resolution.

Each event card shows which model tier assessed it: a teal "Local AI · E4B" badge or a violet "Cloud AI · Gemma 27B" badge.

### Native Thinking Mode

The reasoning engine pre-fills every cluster assessment with the `<|think|>` token, placing Gemma into chain-of-thought mode before it touches any tools. This produces step-by-step internal reasoning: signal inventory, contradiction analysis, confidence calibration, historical plausibility, and a final decision — all stored per event.

Users can expand the "Gemma 4 Thinking Process" panel on any event card to read the raw trace exactly as the model produced it.

### Severity Assessment

Severity is derived from each event's contributing signals using a credibility-weighted mean — higher-credibility signals (sensor, photo) pull the score more than low-credibility text reports. The result maps to a 5-level scale:

| Level | Label | Meaning |
|---|---|---|
| 5 | Critical | Life-threatening conditions reported |
| 4 | High | Serious hazard — avoid the area |
| 3 | Moderate | Proceed with caution |
| 2 | Low | Minor impact, manageable with care |
| 1 | Minimal | Negligible risk |

Severity appears as a colored pill in the compact event row and as a full indicator block when the card is expanded.

### Emergency Rescue Panel

The report page opens with an emergency panel designed for disaster scenarios:

- **GPS auto-acquisition** on page load, with a pre-composed Google Maps link
- **One-tap calling** — a large "Call 112" button (or the correct regional number) via `tel:` URI
- **SMS your location** — taps open the phone's SMS composer pre-filled with coordinates and a rescue message, no internet needed
- **Regional number detection** — GPS bounding boxes map your coordinates to the correct local agencies: LASEMA/767 in Nigeria, 911 in the US/Canada, 999 in the UK, 112 across the EU, and equivalents for India, Australia, and South Africa
- **Dispatcher guidance** — an expandable "What to tell them" card lists the five things every dispatcher asks: location, emergency type, number of people, your condition, and to stay on the line
- **Native share** — `navigator.share()` sends your Maps link to any app installed on the device

Everything works on cell network alone. No internet required.

### Low-Bandwidth Mode

GroundTruth detects slow connections automatically via `navigator.connection.effectiveType`. On 2G or slow-3G, it activates Data Saver: the map (the heaviest component) is hidden, and a banner explains why. Users can also toggle it manually from the ⋮ overflow menu.

### 7-Day Timeframe Filter

Events older than 7 days are automatically excluded from the dashboard. The filter dropdown lets users narrow further — 24 hours, 3 days, or 7 days — so stale incidents never pollute the live picture.

### Mobile-First UI

- The header collapses all secondary actions (refresh, data saver, settings) into a single ⋮ overflow menu, leaving only the essential controls visible on small screens
- Leaflet's internal z-index stack is trapped inside an `isolation: isolate` container, preventing map panes from rendering over sticky dropdowns
- A single "Filter" button replaces separate sort, confidence, and timeframe controls — a badge on the button shows how many non-default filters are active

---

## Demo Scenario: Lagos Flooding

The pre-loaded demo shows a realistic flooding scenario on Lekki-Epe Expressway, Lagos:

- 7 signals from 7 different reporters spanning 2 hours
- A deliberate contradiction: one driver (text-only, credibility 0.30) says the road is passable; a photo (credibility 0.88) shows waist-deep flooding with stranded vehicles, a voice report confirms vehicles are turning back, and a water-level sensor reads 45cm
- Gemma 4 resolves it: the contradicting report is downweighted because it predates the peak flooding and has no visual evidence; the sensor reading anchors the assessment
- Result: 88% confidence, Critical severity, avoid the underpass entirely

A second event on Admiralty Way shows a moderate flooding case with an improving trend, demonstrating that the system can distinguish "worsening" from "stabilising" within the same incident window.

---

## Running Locally

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) with Gemma 4 pulled:

```bash
ollama pull gemma4:e4b
```

Or set a Google AI Studio API key in the Settings page to use the Google Gemma API (no local GPU needed).

### Setup

```bash
git clone https://github.com/cybort360/groundtruth
cd groundtruth
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed the Lagos demo

```bash
npm run db:seed
```

This populates the database with the Lagos flooding scenario. If Ollama is running, it uses the full AI pipeline. If not, it inserts pre-cooked signals and events — including realistic Gemma 4 thinking traces — so you can explore the full UI immediately.

---

## LAN Mesh Networking

When the internet is down, GroundTruth instances on the same Wi-Fi network discover each other automatically via UDP broadcast (port 7042) and share reports peer-to-peer via HTTP.

No configuration required. Open the app on two devices on the same Wi-Fi and watch the Local Mesh panel connect within seconds. The MeshStatus component shows live peer count, bytes synced, and last sync time.

---

## Progressive Web App

GroundTruth installs as a PWA on any device:

- **iOS:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Add to Home Screen
- **Desktop:** click the install icon in the address bar

Once installed, the UI works fully offline. AI inference still requires Ollama locally or a Google API key.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard — events, map, filter, mesh status
│   ├── report/page.tsx             # Report submission + emergency rescue panel
│   ├── settings/page.tsx           # Backend configuration (Ollama / Google AI)
│   └── api/
│       ├── reports/route.ts        # POST: submit, GET: list
│       ├── events/route.ts         # GET: assessed events
│       ├── reasoning/route.ts      # POST: trigger reasoning engine
│       ├── mesh/route.ts           # LAN peer sync endpoint
│       └── settings/route.ts       # Backend settings read/write
├── lib/
│   ├── gemma.ts                    # Dual-backend client (Ollama + Google AI)
│   ├── gemma-backends/             # Backend registry + per-type factory
│   │   ├── index.ts
│   │   ├── ollama.ts
│   │   ├── google.ts
│   │   └── settings.ts
│   ├── complexity-router.ts        # Haversine spread + severity range → simple/complex
│   ├── db.ts                       # SQLite schema, queries, migrations
│   ├── signal-normalizer.ts        # Raw input → structured NormalizedSignal
│   ├── credibility-scorer.ts       # Signal reliability scoring
│   ├── reasoning-engine.ts         # Core: cluster → route → assess → persist
│   ├── demo-seed.ts                # Lagos scenario with pre-cooked thinking traces
│   └── tools/
│       ├── index.ts                # Tool registry + dispatcher
│       ├── geo-cluster.ts          # Group signals by proximity
│       ├── check-history.ts        # Past events at location
│       ├── assess-risk.ts          # Flood zone + elevation lookup
│       └── update-event.ts         # Merge signal cluster into event record
└── components/
    ├── EventCard.tsx               # Confidence ring, severity badge, thinking trace
    ├── EmergencyPanel.tsx          # Rescue numbers, GPS SMS, dispatcher guidance
    ├── ActionAdvisor.tsx           # Per-event-type safety guidance
    ├── ConflictView.tsx            # Side-by-side conflicting reports
    ├── MapView.tsx                 # Leaflet risk zone map (offline-capable)
    ├── ReportForm.tsx              # Multi-modal report submission
    ├── MeshStatus.tsx              # LAN peer discovery + sync status
    └── icons.tsx                   # Event type + evidence type icon set
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| AI — local | Gemma 4 E4B via Ollama REST API |
| AI — cloud | Gemma 27B via Google AI Studio API |
| Routing | Deterministic complexity classifier (haversine + severity heuristics) |
| Database | SQLite via better-sqlite3 |
| Map | Leaflet.js with offline tile support |
| Styling | Tailwind CSS |
| Mesh | UDP broadcast + HTTP peer sync |
| PWA | Web App Manifest + Service Worker |

---

## Hackathon Checklist

- [x] Gemma 4 multimodal — image analysis in signal normalization
- [x] Gemma 4 extended context — full signal cluster in one reasoning pass
- [x] Gemma 4 native thinking mode — `<|think|>` seeded per cluster, trace stored + displayed
- [x] Gemma 4 function calling — 4 registered tools (`geo_cluster`, `check_history`, `assess_risk`, `update_event`)
- [x] Intelligent routing — local E4B for simple clusters, cloud 27B for high-complexity conflicts
- [x] Runs 100% offline — Ollama edge deployment, no cloud dependency
- [x] Solves a real problem — crisis situational awareness with conflicting information
- [x] Transparent AI reasoning — every confidence score explained, thinking traces auditable
- [x] Severity assessment — credibility-weighted signal scoring on a 5-level scale
- [x] Emergency rescue panel — regional numbers, GPS SMS, dispatcher guidance
- [x] Low-bandwidth mode — auto-detected, hides map, preserves core function on 2G
- [x] LAN mesh networking — peer-to-peer report sync when internet is down
- [x] PWA — installs on any device, UI works fully offline

---

## License

MIT
