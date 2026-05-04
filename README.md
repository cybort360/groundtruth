# GroundTruth: Offline Situational Awareness Engine

> During a crisis, conflicting information kills.
> GroundTruth weighs every report against every other and tells you what's actually happening, even when the internet is down.

**Built for the [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) on Kaggle.**

---

## The Problem

When flooding hits, social media fills with contradictory reports. One person says the road is passable. Another says cars are submerged. Emergency responders and residents have no way to know who's right, so they either freeze or take dangerous guesses.

Standard AI tools need cloud connectivity to work. Crises are precisely when cell towers go down, internet fails, and you're on your own.

## What It Does

GroundTruth is a fully offline situational awareness engine that runs Gemma 4 on-device. It:

1. **Collects multi-modal reports:** photos, voice notes, and text from anyone nearby
2. **Normalizes every signal:** Gemma 4 extracts structured claims from raw input
3. **Scores credibility:** each signal gets a reliability score based on evidence type, specificity, and corroboration
4. **Resolves conflicts:** Gemma 4's reasoning mode detects contradictions, weighs evidence, and explains its conclusions
5. **Outputs calibrated confidence:** not "flooding detected" but "88% confidence, avoid the Lekki-Epe underpass"

All of this runs on a single device with no internet required.

---

## Why Gemma 4

GroundTruth uses Gemma 4's differentiating features directly, not superficially:

| Feature | How We Use It |
|---|---|
| **Multimodal** | Photos submitted as reports are analyzed directly; Gemma 4 extracts water depth, damage severity, and location context from images |
| **Extended context** | All signals for a geographic cluster are reasoned over in a single long-context pass |
| **Thinking mode** | The reasoning engine uses thinking mode to produce transparent, step-by-step conflict resolution that users can audit |
| **Function calling** | The reasoning engine calls `geo_cluster()`, `check_history()`, `assess_risk()`, and `update_event()` as native tools, not string parsing |
| **Edge deployment** | Runs via Ollama on any laptop or Raspberry Pi with no cloud dependency |

---

## Architecture

```
Signal Input (photo / voice / text)
        │
        ▼
Signal Normalizer          ← Gemma 4: extract location, claim, evidence type
        │
        ▼
Credibility Scorer         ← Gemma 4: score recency, specificity, corroboration
        │
        ▼
Reasoning Engine           ← Gemma 4 (thinking mode + function calling)
  ├── geo_cluster()           group nearby signals
  ├── check_history()         compare against past events
  ├── assess_risk()           flood zone + elevation lookup
  └── update_event()          merge into event record
        │
        ▼
Dashboard
  ├── Event cards with confidence rings
  ├── Conflict view (competing reports side-by-side)
  ├── Map with color-coded risk zones
  └── Safety advisor (area-specific guidance)
```

---

## Demo Scenario: Lagos Flooding

The pre-loaded demo shows a realistic flooding scenario on Lekki-Epe Expressway, Lagos:

- 7 signals from 7 different reporters, spanning 2 hours
- A deliberate contradiction: one driver (text-only) says the road is passable; three others (photo + voice + sensor) say it's impassable
- Gemma 4 resolves it: the contradicting report gets downweighted because it lacks visual evidence, and a 45cm water-level sensor independently confirms the flooding
- Result: 93% confidence, avoid the underpass

This is the exact kind of life-or-death decision the system is built for.

---

## Running Locally

### Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) with Gemma 4 pulled:

```bash
ollama pull gemma4:e4b
```

Or set a Google AI Studio API key in Settings to use the Google Gemma API (no local GPU needed).

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

This populates the database with the Lagos flooding scenario. If Ollama is running, it uses the full AI pipeline. If not, it inserts pre-cooked signals and events so you can explore the UI immediately.

---

## LAN Mesh Networking

When the internet is down, GroundTruth instances on the same Wi-Fi network discover each other automatically via UDP broadcast (port 7042) and share reports peer-to-peer via HTTP.

No configuration required. Open the app on two devices on the same Wi-Fi and watch the Local Mesh panel connect within seconds.

---

## Progressive Web App

GroundTruth installs as a PWA on any device:

- **iOS:** Safari > Share > Add to Home Screen
- **Android:** Chrome > menu > Add to Home Screen
- **Desktop:** click the install icon in the address bar

Once installed, the UI works fully offline. AI inference still requires Ollama locally or a Google API key.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Dashboard
│   ├── report/page.tsx         # Report submission
│   ├── settings/page.tsx       # Backend configuration
│   └── api/
│       ├── reports/route.ts    # POST: submit, GET: list
│       ├── events/route.ts     # GET: assessed events
│       ├── reasoning/route.ts  # POST: trigger reasoning engine
│       ├── mesh/route.ts       # Mesh sync endpoint
│       └── settings/route.ts   # Backend settings
├── lib/
│   ├── gemma.ts                # Ollama/Google dual-backend client
│   ├── db.ts                   # SQLite schema + queries
│   ├── signal-normalizer.ts    # Raw input to structured signal
│   ├── credibility-scorer.ts   # Signal reliability scoring
│   ├── reasoning-engine.ts     # Core: conflict resolution + synthesis
│   ├── seed-demo.ts            # Lagos demo data seeder
│   └── tools/                  # Gemma 4 function-calling tools
│       ├── geo-cluster.ts
│       ├── check-history.ts
│       ├── assess-risk.ts
│       └── update-event.ts
└── components/
    ├── EventCard.tsx           # Confidence ring + expandable reasoning
    ├── ActionAdvisor.tsx       # Per-type safety guidance
    ├── ConflictView.tsx        # Side-by-side conflicting reports
    ├── MapView.tsx             # Leaflet risk zone map
    └── MeshStatus.tsx          # LAN peer discovery panel
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| AI | Gemma 4 via Ollama (local) or Google AI Studio API |
| Database | SQLite via better-sqlite3 |
| Map | Leaflet.js with offline tile support |
| Styling | Tailwind CSS |
| Mesh | UDP broadcast + HTTP peer sync |
| PWA | Web App Manifest + Service Worker |

---

## Hackathon Checklist

- [x] Uses Gemma 4 multimodal (image analysis in signal normalization)
- [x] Uses Gemma 4 extended context (full signal cluster in one reasoning pass)
- [x] Uses Gemma 4 thinking mode (transparent reasoning chains)
- [x] Uses Gemma 4 function calling (4 registered tools)
- [x] Runs 100% offline (Ollama edge deployment)
- [x] Solves a real problem (crisis situational awareness)
- [x] Transparent AI reasoning (every confidence score is explained)
- [x] PWA + LAN mesh for true offline-first use

---

## License

MIT
