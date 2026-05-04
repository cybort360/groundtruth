# PROJECT SPEC — GroundTruth: Offline Situational Awareness Engine

## 1. Problem Statement

During crises (floods, earthquakes, infrastructure failures), information is fragmented and contradictory. Social media is unreliable. Official channels are slow. Cell towers go down. People make life-or-death decisions based on rumors.

GroundTruth collects local reports from multiple people, reasons over conflicting inputs using on-device Gemma 4, and produces probability-based assessments of what is actually happening. It works entirely offline.

Example: Three people report on the same road. One says it's passable (text, 2 hours ago). Another says it's flooded (photo, 20 minutes ago). A third says water is receding (voice note, 5 minutes ago). GroundTruth synthesizes these into: "Main Street flooding — 65% confidence water is receding. Photo evidence from 20 min ago shows ~30cm standing water. Most recent voice report indicates improvement. Text report from 2 hours ago is stale. Recommendation: proceed with caution, conditions improving."

## 2. Architecture

### 2.1 Data Flow

```
[User submits report] → POST /api/reports
    → Store raw report in SQLite
    → Signal Normalizer (Gemma 4) extracts structured data
    → Credibility Scorer (Gemma 4) assigns reliability weight
    → Store normalized signal in SQLite

[Dashboard requests events] → GET /api/events
    → Reasoning Engine groups signals, resolves conflicts
    → Function calling tools enrich with geo/history/risk data
    → Returns assessed events with confidence scores

[Auto-refresh] → POST /api/reasoning
    → Trigger re-assessment when new signals arrive
    → Update event confidence scores and reasoning chains
```

### 2.2 Model Configuration

**Primary model:** Gemma 4 E4B via Ollama
- Multimodal: processes images and audio natively
- Function calling: native support
- Thinking mode: enabled for reasoning engine (transparent chain of thought)
- Context: 128K tokens

**Ollama configuration:**
```bash
ollama pull gemma4:e4b
# Runs on Apple Silicon with ~8GB memory
# API endpoint: http://localhost:11434
```

**For Hugging Face Spaces deployment (live demo):**
Use gemma-4-12b or gemma-4-26b-a4b with Gradio wrapping the same API interface.

## 3. Database Schema (SQLite)

```sql
CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('photo', 'voice', 'text', 'sensor')),
    raw_content TEXT,          -- text content or file path
    image_base64 TEXT,         -- base64 encoded image if photo
    audio_base64 TEXT,         -- base64 encoded audio if voice
    latitude REAL,
    longitude REAL,
    submitted_at TEXT NOT NULL, -- ISO 8601
    submitter_id TEXT           -- anonymous device ID
);

CREATE TABLE signals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id),
    location_name TEXT,        -- human-readable: "Main St & 5th Ave"
    latitude REAL,
    longitude REAL,
    claim TEXT NOT NULL,        -- "road submerged approximately 30cm"
    evidence_type TEXT NOT NULL, -- photo, audio, text, sensor
    timestamp TEXT NOT NULL,
    credibility_score REAL,     -- 0.0 to 1.0
    credibility_reasoning TEXT, -- why this score
    normalized_at TEXT
);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,         -- "Flooding on Main Street"
    description TEXT,
    event_type TEXT NOT NULL,    -- flooding, road_closure, power_outage, etc.
    latitude REAL,
    longitude REAL,
    radius_meters REAL,         -- affected area
    confidence REAL NOT NULL,    -- 0.0 to 1.0
    reasoning_chain TEXT,        -- full reasoning explanation
    status TEXT DEFAULT 'active', -- active, resolved, uncertain
    first_reported TEXT,
    last_updated TEXT,
    signal_count INTEGER DEFAULT 0
);

CREATE TABLE event_signals (
    event_id TEXT REFERENCES events(id),
    signal_id TEXT REFERENCES signals(id),
    PRIMARY KEY (event_id, signal_id)
);

-- Index for geo queries
CREATE INDEX idx_signals_geo ON signals(latitude, longitude);
CREATE INDEX idx_events_geo ON events(latitude, longitude);
CREATE INDEX idx_events_status ON events(status);
```

## 4. API Routes

### POST /api/reports
Submit a new report.

**Request body:**
```typescript
{
  type: "photo" | "voice" | "text" | "sensor";
  content?: string;         // text content
  image?: string;           // base64 image
  audio?: string;           // base64 audio
  latitude: number;
  longitude: number;
}
```

**Response:**
```typescript
{
  reportId: string;
  signal: NormalizedSignal;  // extracted structured data
  credibility: number;       // 0-1 score
}
```

**Internal flow:**
1. Store raw report
2. Call Signal Normalizer → get structured signal
3. Call Credibility Scorer → get reliability weight
4. Store signal
5. Trigger background re-assessment for nearby events

### GET /api/events
Get all active assessed events.

**Query params:** `?lat=X&lng=Y&radius=5000` (optional geo filter)

**Response:**
```typescript
{
  events: AssessedEvent[];
  lastUpdated: string;
}
```

### POST /api/reasoning
Manually trigger re-assessment of all signals.

**Response:**
```typescript
{
  events: AssessedEvent[];
  signalsProcessed: number;
  conflictsDetected: number;
}
```

## 5. Function Calling Tool Definitions

These are the tools Gemma 4 can call during reasoning. Each follows the Gemma 4 function calling format.

### geo_cluster
```typescript
{
  name: "geo_cluster",
  description: "Group nearby signals within a radius into location-based clusters. Returns clusters of signals that likely refer to the same real-world event.",
  parameters: {
    type: "object",
    properties: {
      signal_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of signal IDs to cluster"
      },
      radius_meters: {
        type: "number",
        description: "Maximum distance between signals to be considered same cluster",
        default: 500
      }
    },
    required: ["signal_ids"]
  }
}
```

### check_history
```typescript
{
  name: "check_history",
  description: "Look up historical events at or near a location. Returns past incidents that may indicate whether current reports are plausible.",
  parameters: {
    type: "object",
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" },
      radius_meters: { type: "number", default: 1000 },
      event_type: { type: "string", description: "Filter by type: flooding, road_closure, power_outage" }
    },
    required: ["latitude", "longitude"]
  }
}
```

### assess_risk
```typescript
{
  name: "assess_risk",
  description: "Check environmental risk factors for a location: flood zone designation, elevation, proximity to water bodies, drainage infrastructure.",
  parameters: {
    type: "object",
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" }
    },
    required: ["latitude", "longitude"]
  }
}
```

### update_event
```typescript
{
  name: "update_event",
  description: "Create a new event assessment or update an existing one with revised confidence and reasoning based on new signals.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "Existing event ID to update, or null to create new" },
      title: { type: "string" },
      event_type: { type: "string" },
      latitude: { type: "number" },
      longitude: { type: "number" },
      radius_meters: { type: "number" },
      confidence: { type: "number", description: "0.0 to 1.0" },
      reasoning_chain: { type: "string", description: "Full explanation of assessment" },
      status: { type: "string", enum: ["active", "resolved", "uncertain"] }
    },
    required: ["title", "event_type", "confidence", "reasoning_chain"]
  }
}
```

## 6. TypeScript Interfaces

```typescript
// src/types/index.ts

export interface Report {
  id: string;
  type: "photo" | "voice" | "text" | "sensor";
  rawContent?: string;
  imageBase64?: string;
  audioBase64?: string;
  latitude: number;
  longitude: number;
  submittedAt: string;
  submitterId?: string;
}

export interface NormalizedSignal {
  id: string;
  reportId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  claim: string;
  evidenceType: "photo" | "audio" | "text" | "sensor";
  timestamp: string;
  credibilityScore: number;
  credibilityReasoning: string;
}

export interface AssessedEvent {
  id: string;
  title: string;
  description: string;
  eventType: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  confidence: number;
  reasoningChain: string;
  status: "active" | "resolved" | "uncertain";
  firstReported: string;
  lastUpdated: string;
  signalCount: number;
  signals: NormalizedSignal[];       // supporting signals
  conflicts: ConflictPair[];         // detected contradictions
}

export interface ConflictPair {
  signalA: NormalizedSignal;
  signalB: NormalizedSignal;
  conflictType: string;              // "contradictory_claims" | "inconsistent_severity" | "temporal_disagreement"
  resolution: string;                // which signal was favored and why
}

export interface GemmaToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface GemmaToolResult {
  name: string;
  result: unknown;
}

export interface ReasoningOutput {
  events: AssessedEvent[];
  signalsProcessed: number;
  conflictsDetected: number;
  thinkingTrace?: string;            // raw thinking mode output
}
```

## 7. Component Specifications

### ReportForm
- Toggle between photo (camera/upload), voice (record), and text input
- Auto-capture GPS coordinates from browser geolocation API
- Preview uploaded image or audio waveform
- Submit button posts to /api/reports
- Show normalized signal result after submission

### Dashboard
- Layout: map on top (60% height), event cards below (scrollable)
- Auto-refresh every 30 seconds via polling /api/events
- Filter by event type and minimum confidence threshold
- Sort events by confidence (descending) or recency

### EventCard
- Title, event type badge, confidence percentage with color coding
  - Green: 80-100% (high confidence)
  - Yellow: 50-79% (moderate)
  - Red: below 50% (uncertain/conflicting)
- Expandable reasoning chain (click to show full explanation)
- Signal count and time range
- "View conflicts" button if contradictions exist

### ConflictView
- Side-by-side display of contradicting signals
- Each side shows: evidence type icon, claim text, credibility score, timestamp
- Center column shows resolution: which signal was favored and why
- Visual weight indicator (bar chart or scale graphic)

### MapView
- Leaflet.js map centered on demo area
- Circle markers for events, sized by radius, colored by confidence
- Click marker to see event card popup
- Offline tile support: pre-download tiles for demo area using leaflet-offline or static tile pack

### ActionAdvisor
- Based on assessed events, suggest safe routes or actions
- "Avoid Main Street between 3rd and 7th — flooding confirmed (82%)"
- "Route B via Oak Avenue appears clear — no reports of obstruction"
- Updates when events change

## 8. Demo Scenario: Lagos Flooding

**Why Lagos:** Flooding is a recurring real problem there. It affects millions. It has emotional resonance. If the developer is from Nigeria (based on email), this adds a personal connection to the story.

**Demo data set (pre-loaded for video):**

| Time | Reporter | Type | Claim | Location |
|------|----------|------|-------|----------|
| 14:00 | User A | text | "Heavy rain started, roads getting wet" | Lekki Phase 1 |
| 14:15 | User B | photo | Photo of ankle-deep water on street | Admiralty Way |
| 14:30 | User C | voice | "The road under the bridge is completely flooded, cars turning back" | Lekki-Epe Expressway |
| 14:35 | User D | text | "I just drove through, it's fine, barely any water" | Lekki-Epe Expressway |
| 14:45 | User E | photo | Photo showing waist-deep water with stranded vehicles | Lekki-Epe Expressway |
| 15:00 | User F | voice | "Water is going down slowly, some cars starting to move" | Admiralty Way |
| 15:10 | User G | sensor | Water level sensor reads 45cm | Lekki-Epe underpass |

**Expected reasoning output:**

Event 1: "Severe flooding — Lekki-Epe Expressway underpass"
- Confidence: 88%
- Reasoning: "3 of 4 reports indicate significant flooding. User D's contradicting report ('barely any water') was submitted as text-only with no photo evidence and may refer to a different section of the expressway. Photo from User E (waist-deep water with stranded vehicles, 14:45) is the strongest evidence. Sensor data confirms 45cm water level. User C's voice report corroborates. Assessment: road is impassable at the underpass section."

Event 2: "Moderate flooding — Admiralty Way"
- Confidence: 62%
- Reasoning: "Initial photo showed ankle-deep water (14:15). Most recent voice report (15:00) says water is receding. Conditions likely improving but still present. Recommend caution."

## 9. 15-Day Build Plan

### Days 1-3: Foundation (You — AI/Backend)
- [ ] Get Gemma 4 E4B running via Ollama
- [ ] Test multimodal input: send image + text, confirm model describes the image
- [ ] Test function calling: define a simple tool, confirm model calls it
- [ ] Test thinking mode: enable reasoning, confirm thinking trace is returned
- [ ] Set up Next.js project with TypeScript
- [ ] Set up SQLite with better-sqlite3, create all tables
- [ ] Build `src/lib/gemma.ts` — Ollama client with multimodal + function calling + thinking support

### Days 3-4: Signal Pipeline (You)
- [ ] Build Signal Normalizer: any input → structured signal
- [ ] Build Credibility Scorer: signal → reliability weight
- [ ] Test with 10+ sample inputs of each type (photo, voice, text)
- [ ] Build POST /api/reports route

### Days 4-6: Core Reasoning (You — most important work)
- [ ] Build the reasoning engine prompt (see Section 10)
- [ ] Implement function calling tools: geo_cluster, check_history, assess_risk, update_event
- [ ] Build the agentic loop: model calls tools, gets results, reasons further
- [ ] Test with the Lagos demo scenario data
- [ ] Tune confidence calibration — scores should feel realistic
- [ ] Build GET /api/events and POST /api/reasoning routes

### Days 5-9: Frontend (Frontend Dev)
- [ ] ReportForm component (photo upload, voice recording, text input, GPS)
- [ ] Dashboard layout with event cards
- [ ] EventCard with expandable reasoning chain
- [ ] ConflictView for side-by-side contradictions
- [ ] MapView with Leaflet (start with online tiles, offline later)
- [ ] ActionAdvisor component
- [ ] Auto-refresh polling

### Days 10-11: Integration + Polish
- [ ] Wire frontend to backend end-to-end
- [ ] Test full flow: submit reports → see events update on dashboard
- [ ] Add offline map tiles for Lagos demo area
- [ ] Handle edge cases: no signals, single signal, all signals agree
- [ ] Loading states, error handling, empty states

### Day 12: Deploy
- [ ] Frontend on Vercel
- [ ] Inference backend on Hugging Face Spaces (Gradio wrapper)
- [ ] Test live demo end to end
- [ ] Pre-load demo scenario data so judges see a working example

### Day 13: Video
- [ ] Script the 3-minute story:
  - 0:00-0:30 — The problem (show a real flood, show misinformation)
  - 0:30-1:30 — The solution (live demo: submit reports, show reasoning)
  - 1:30-2:30 — Technical depth (architecture, Gemma 4 features used, offline capability)
  - 2:30-3:00 — Impact and future
- [ ] Record with screen capture + voiceover
- [ ] Upload to YouTube

### Day 14: Writeup
- [ ] Write 1500-word Kaggle writeup
- [ ] Cover: problem, architecture, Gemma 4 usage, challenges, impact
- [ ] Create cover image for media gallery

### Day 15: Buffer + Submit
- [ ] Final testing
- [ ] Fix any remaining issues
- [ ] Submit on Kaggle

## 10. System Prompts

See `src/lib/prompts/` for implementation. Full prompt text is in the starter codebase.

### Signal Normalizer
Extracts structured data from any input type. Handles photos (describes what it sees and extracts claims), voice notes (transcribes and extracts claims), and text (extracts claims). Always outputs a consistent JSON structure.

### Credibility Scorer
Evaluates each signal on four dimensions:
1. **Recency** — How fresh is this? (exponential decay)
2. **Evidence strength** — Photo/video > audio > text > hearsay
3. **Specificity** — "30cm of water at the intersection" > "road is bad"
4. **Internal consistency** — Does the claim match the evidence? (photo shows dry road but text says flooding = low score)

Outputs a 0-1 score with a one-paragraph explanation.

### Reasoning Engine
The core prompt. Instructs Gemma 4 to:
1. Review all signals for a geographic area
2. Group them by location proximity
3. Identify contradictions
4. Evaluate which signals to trust and why
5. Produce an event assessment with confidence score
6. Write a reasoning chain that a non-technical person can understand
7. Use function calling tools to enrich the assessment

Uses thinking mode so the model's reasoning process is captured and displayed.
