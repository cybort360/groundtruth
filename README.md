# GroundTruth: Offline Situational Awareness Engine

GroundTruth is an offline-first AI system that resolves conflicting real-world reports into a single, explainable decision.

> During a crisis, conflicting information kills. GroundTruth weighs every report against every other and tells you what's actually happening — even when the internet is down.

**Built for the [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) on Kaggle.**

---

## Quick Start

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/cybort360/groundtruth
cd groundtruth
npm install
cp .env.example .env.local
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

Demo data seeds automatically on first load — the Lagos flooding scenario appears on the map immediately, no AI backend needed to explore the UI.

---

### AI Backend Options

**Option A — Local Ollama** (no internet after setup, runs fully offline)

```bash
# Install Ollama: https://ollama.com, then:
ollama pull gemma4:e4b
# No changes to .env.local needed — the app detects Ollama automatically.
```

**Option B — Google AI Studio** (no GPU, no Ollama, works on any machine)

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com) → **Get API key**
2. Open `.env.local` and add:
   ```
   GOOGLE_API_KEY=your_key_here
   ```
3. Restart `npm run dev` — the app switches to Google's Gemma API automatically.

**Option C — No AI key at all**

The app loads, the Lagos demo seeds automatically, the map works, all event cards show with their confidence scores, conflict views, and pre-computed Gemma 4 thinking traces. You can submit reports and browse everything. The only thing that won't work is pressing **Analyze** — that button needs a live AI backend to run fresh reasoning on new reports.

---

To reset or re-seed the Lagos demo manually:

```bash
npm run db:seed
```

---

## The Problem

When disaster strikes, social media fills with contradictory reports. One person says the road is passable. Another says cars are submerged. Residents and responders have no way to know who's right, so they freeze or guess.

Cell towers and cloud services fail under disaster load. Standard AI tools require internet in the exact situations where internet fails.

## What It Does

GroundTruth collects local reports — photos, voice notes, and text — and uses Gemma 4 to resolve contradictions and produce a single, explainable assessment. It:

1. **Collects multi-modal reports** — photos, voice notes, and text from anyone nearby
2. **Extracts structured claims** — Gemma 4 parses each report into location, severity, and evidence type
3. **Scores credibility** — each signal is weighted by evidence type, specificity, recency, and corroboration with nearby reports
4. **Routes by complexity** — simple, consistent reports are handled locally by Gemma E4B; conflicting or dispersed reports are automatically escalated to Gemma 27B via Google AI
5. **Resolves conflicts** — Gemma 4's step-by-step reasoning mode detects contradictions, weighs evidence, and produces a transparent chain-of-thought
6. **Grounds assessments in real history** — `check_history()` queries 259 real GDACS (EU/UN) disaster alerts across 3 years, so Gemma can say "this area had 4 Orange flood alerts in the past 3 years" rather than reasoning blind
7. **Correlates across clusters** — neighboring event clusters of the same type boost each other's confidence (up to +12%) when they corroborate the same picture
8. **Outputs calibrated assessments** — not "flooding detected" but "88% confidence, Critical severity, avoid the Lekki-Epe underpass"
9. **Guides emergency action** — a built-in rescue panel surfaces the correct regional emergency number, pre-composes an SMS with your GPS coordinates, and provides dispatcher guidance — all without internet

The entire system runs on a single device with no internet required.

---

## Why Gemma 4

GroundTruth uses Gemma 4's differentiating features directly, not superficially:

| Feature | How We Use It |
|---|---|
| **Multimodal** | Photos submitted as reports are analyzed directly; Gemma 4 extracts water depth, damage severity, and location context from images |
| **Extended context** | All signals for a geographic cluster are reasoned over in a single long-context pass |
| **Native thinking mode** | Gemma 4's step-by-step reasoning mode is enabled before any tool call fires. The full chain-of-thought trace is stored per event and shown to users on demand |
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
  ├── check_history()         query GDACS history + past assessments
  ├── assess_risk()           flood zone + elevation lookup
  └── update_event()          persist event with confidence + reasoning chain
        │
        ▼
Phase 3: Cross-Cluster Correlation
  └── neighboring clusters of the same type boost each other's confidence
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

- **Simple clusters** (tight GPS spread, consistent severity, fewer than 5 signals) → Gemma E4B runs locally via Ollama. Fast, private, zero cost.
- **Complex clusters** (3+ signals with GPS spread >200m, severity range ≥ 2, or 5+ signals) → automatically escalated to Gemma 27B via Google AI for deeper conflict resolution.

Each event card shows which model tier assessed it: a teal **"Running offline"** badge or a violet **"Cloud-assisted"** badge.

→ See [ROUTING.md](./ROUTING.md) for the full decision logic and escalation thresholds.

### Historical Baseline from Real Disaster Data

`check_history()` queries three sources in parallel:

- **Static historical records** — a curated JSON of regional past events
- **GDACS alerts** — 259 real disaster alerts from the EU/UN Global Disaster Alert and Coordination System, covering 3 years of Red and Orange events across flood, earthquake, storm, volcano, and wildfire types. Fetched via the public GDACS API and bundled at build time so Vercel cold starts always have the full dataset.
- **Past GroundTruth assessments** — previously analyzed events at the same location feed back into the baseline

This means Gemma is reasoning with real historical context, not a blank slate.

### Cross-Cluster Correlation

After all clusters are individually assessed, a third reasoning phase checks whether neighboring clusters of the same event type corroborate each other. A flooding cluster on Street A that finds two other flooding clusters within 1,000m receives a confidence boost proportional to the strength of its neighbors — up to 12 percentage points. The boost and its source are appended to the event's reasoning chain, so users can see exactly why the confidence number changed.

### Native Thinking Mode

Gemma 4's step-by-step reasoning mode is enabled before any tool call fires. This produces a full internal trace: signal inventory, contradiction analysis, confidence calibration, historical plausibility, and a final decision — all stored per event.

Users can expand the "AI Reasoning Trace" panel on any event card to read the raw trace exactly as the model produced it.

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

### Emergency Rescue Panel — 10 Languages

The report page opens with an emergency panel designed for disaster scenarios:

- **GPS auto-acquisition** on page load, with a pre-composed Google Maps link
- **One-tap calling** — a large "Call 112" button (or the correct regional number) via `tel:` URI
- **SMS your location** — taps open the phone's SMS composer pre-filled with coordinates and a rescue message, no internet needed
- **Regional number detection** — GPS bounding boxes map your coordinates to the correct local agencies: LASEMA/767 in Nigeria, 911 in the US/Canada, 999 in the UK, 112 across the EU, and equivalents for India, Australia, and South Africa
- **Dispatcher guidance** — an expandable "What to tell them" card lists the five things every dispatcher asks: location, emergency type, number of people, your condition, and to stay on the line
- **Native share** — `navigator.share()` sends your Maps link to any app installed on the device

Every string in this panel — titles, button labels, dispatcher guidance, and the pre-composed SMS body — is fully translated into **10 languages**: English, French, Spanish, Portuguese, Arabic (RTL), Yoruba, Hausa, Hindi, Swahili, and Indonesian. Language is auto-detected from `navigator.language` and can be changed in Settings, where the preference is saved to `localStorage`.

Everything works on cell network alone. No internet required.

### Encrypted QR / NFC Sharing

After submitting a report, tap "Share via QR" to display a scannable code. The code carries the full report payload — location, type, content — that another device imports directly into its local database.

Reports can optionally be **PIN-locked** before sharing. Enabling the lock encrypts the payload with **AES-256-GCM** using a **PBKDF2**-derived key (100,000 iterations, SHA-256, random 16-byte salt). The encrypted payload is self-describing (v2 format) so older clients detect it and prompt for a PIN rather than silently failing. The PIN is never stored in the QR code — it's shared out of band. Everything runs on the browser's built-in Web Crypto API; no external libraries.

NFC tap sharing on Android Chrome writes the same payload (plain or encrypted) directly to a tag.

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

### Sync GDACS historical data

The app seeds 259 GDACS events automatically on first startup from `data/gdacs-seed.json`. To pull fresh data from the live GDACS API:

```
POST /api/gdacs/sync
```

Or use the "Sync Historical Data" button in Settings. This fetches 3 years of Red and Orange alerts and stores them locally. The sync takes 20–30 seconds.

---

## LAN Mesh Networking

**Local server deployment (field teams):** Devices running `npm run dev` on the same Wi-Fi discover each other automatically via UDP broadcast and exchange reports directly — no server, no cloud. The MeshStatus component shows live peer count and sync log.

**Vercel deployment (any device):** Reports can be shared offline via QR code. After submitting a report, tap "Share via QR" to display a scannable code. Another device running the app scans it and imports the report directly into its local database — no internet, no pairing. NFC tap sharing is available on Android Chrome.

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
│   ├── settings/page.tsx           # Backend config, language selector, GDACS sync
│   └── api/
│       ├── reports/route.ts        # POST: submit, GET: list
│       ├── events/route.ts         # GET: assessed events
│       ├── reasoning/route.ts      # POST: trigger reasoning engine
│       ├── mesh/route.ts           # LAN peer sync endpoint
│       ├── gdacs/sync/route.ts     # GET: sync status, POST: fetch from GDACS API
│       └── settings/route.ts       # Backend settings read/write
├── lib/
│   ├── gemma.ts                    # Dual-backend client (Ollama + Google AI)
│   ├── gemma-backends/             # Backend registry + per-type factory
│   │   ├── index.ts
│   │   ├── ollama.ts
│   │   ├── google.ts
│   │   └── settings.ts
│   ├── complexity-router.ts        # Haversine spread + severity range → simple/complex
│   ├── db.ts                       # SQLite schema, queries, GDACS tables + auto-seed
│   ├── gdacs.ts                    # GDACS API client — 3-year fetch, type mapping
│   ├── crypto.ts                   # AES-256-GCM + PBKDF2 payload encryption
│   ├── signal-normalizer.ts        # Raw input → structured NormalizedSignal
│   ├── credibility-scorer.ts       # Signal reliability scoring
│   ├── reasoning-engine.ts         # Core: cluster → route → assess → correlate → persist
│   ├── demo-seed.ts                # Lagos scenario with pre-cooked thinking traces
│   ├── i18n/
│   │   ├── index.ts                # useTranslations hook, locale detection + override
│   │   └── translations.ts         # 10-language string table (UI, SMS, dispatcher guidance)
│   └── tools/
│       ├── index.ts                # Tool registry + dispatcher
│       ├── geo-cluster.ts          # Group signals by proximity
│       ├── check-history.ts        # GDACS + static + past assessments at location
│       ├── assess-risk.ts          # Flood zone + elevation lookup
│       └── update-event.ts         # Merge signal cluster into event record
└── components/
    ├── EventCard.tsx               # Confidence ring, severity badge, thinking trace
    ├── EmergencyPanel.tsx          # Rescue numbers, GPS SMS, dispatcher guidance (i18n)
    ├── ActionAdvisor.tsx           # Per-event-type safety guidance
    ├── ConflictView.tsx            # Side-by-side conflicting reports
    ├── MapView.tsx                 # Leaflet risk zone map (offline-capable)
    ├── ReportForm.tsx              # Multi-modal report submission
    ├── QRShare.tsx                 # QR + NFC sharing with optional PIN encryption
    ├── QRScanner.tsx               # Camera scan + encrypted payload unlock
    ├── ImportReport.tsx            # URL-based report import (plain + encrypted)
    ├── MeshStatus.tsx              # LAN peer discovery + sync status
    └── icons.tsx                   # Event type + evidence type icon set

data/
└── gdacs-seed.json                 # 259 bundled GDACS events (auto-seeded on cold start)
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
| Historical data | GDACS (EU/UN) public disaster alert API — 259 real events |
| Encryption | AES-256-GCM + PBKDF2 via Web Crypto API |
| Map | Leaflet.js with offline tile support |
| Styling | Tailwind CSS |
| Localization | Custom i18n — 10 languages, auto-detected |
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
- [x] Real historical baseline — 259 GDACS (EU/UN) events across 3 years, queried per location
- [x] Cross-cluster correlation — neighboring events boost each other's confidence
- [x] Emergency rescue panel — regional numbers, GPS SMS, dispatcher guidance
- [x] Localization — 10 languages, auto-detected, including Arabic RTL
- [x] End-to-end encryption — AES-256-GCM + PBKDF2 PIN lock for QR/NFC payloads
- [x] Low-bandwidth mode — auto-detected, hides map, preserves core function on 2G
- [x] LAN mesh networking — peer-to-peer report sync for local server deployments
- [x] QR / NFC report sharing — offline report transfer between any devices
- [x] PWA — installs on any device, UI works fully offline

---

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE)

You are free to share and adapt this work for any purpose, including commercially, as long as you give appropriate credit.
