# Product Requirements Document (PRD): ZeppBridge REST API Service

**Document**: PRD  
**Project**: ZeppBridge Headless REST API (`api/`)  
**Status**: Approved / Ready for Implementation  
**Target Date**: 2026-11-12  
**Target Users**: Personal AI Coach (Telegram bot / n8n workflows / AnythingLLM RAG) & Personal Health Dashboard  

---

## 1. Executive Summary & Problem Statement

### 1.1 Background
ZeppBridge syncs Amazfit/Zepp health and workout telemetry into a local SQLite database (`zepp.db`, schema v51) via a headless Docker container (`zeppbridge-cli` / `zeppbridge-mcp`). While desktop ZeppBridge has a minimal localhost-only API (`127.0.0.1:43921`), headless server deployments lack a clean, containerized HTTP interface for downstream automations.

### 1.2 Problem
- Generic SQLite REST proxies (e.g., Datasette) expose raw SQL or low-level schema tables requiring complex client-side joins across 6+ tables (`workouts`, `workout_splits`, `workout_hr_zones`, `sleep_sessions`, `daily_metrics`, `metric_samples`).
- Downstream LLM coaches and Telegram/n8n bots require domain-level, context-enriched payloads:
  1. Single workouts enriched with prior-night sleep, resting HR, and biocharge (as in `api/example_data.json`).
  2. Multi-day AI training context formatted in clean Markdown + CSV tables (as in `api/ZeppBridge_1104-1110_workouts and 6 more.md`).
  3. Structured daily metrics for dashboard visualizers.

### 1.3 Solution
A lightweight, zero-dependency Node.js 24 microservice deployed alongside the `zeppbridge` container on the same Docker volume (`/data/zepp.db`), mounting the database in read-only WAL mode and exposing clean, authenticated JSON/Markdown endpoints.

---

## 2. Core User Personas & Use Cases

1. **Telegram Running Coach (via n8n / Webhook)**:
   - Athlete finishes morning run; n8n calls `GET /api/v1/workouts/latest/enriched`.
   - Payload provides total distance, pace, splits, HR zones, elevation, plus prior-night sleep quality and readiness score.
   - LLM responds with recovery and pacing feedback.

2. **Weekly Training Plan & RAG Ingestion (AnythingLLM / NotebookLM / n8n)**:
   - Ingestion worker queries `GET /api/v1/ai/context?days=7&format=markdown`.
   - Endpoint streams a standardized `zeppbridge.ai_task` document with coach notes, personal bests, data coverage table, daily metrics CSV, sleep CSV, and workouts CSV.

3. **Personal Health & Fitness Dashboard**:
   - Web frontend queries `GET /api/v1/dashboard/today` and `GET /api/v1/daily?from=...&to=...` for recovery scores, steps, calories, HRV baselines, and sleep stages.

---

## 3. System Architecture & Tech Stack

```
[Amazfit Cloud]
       │
       ▼ (hourly / cron sync via zeppbridge-cli)
[ZeppBridge Container]
       │
       ▼ (writes WAL SQLite)
  [Shared Volume: /data/zepp.db]
       │
       ▼ (readOnly: true, WAL concurrent read)
[ZeppBridge API Container (Node.js 24)]
       │
       ├──► GET /api/v1/workouts/:id/enriched  ──► Telegram / n8n Bot
       ├──► GET /api/v1/ai/context (Markdown)  ──► AnythingLLM / RAG Coach
       └──► GET /api/v1/dashboard/today        ──► Web Dashboard
```

- **Runtime**: Node.js 24 (`node:24-slim`).
- **SQLite Engine**: Native `node:sqlite` (`DatabaseSync` with `{ readOnly: true }`). No `node-gyp`, no compilation, no external npm packages required.
- **Concurrency & Safety**: SQLite WAL mode allows concurrent reads without locking `zeppbridge-cli` sync writes.
- **Container Footprint**: < 120MB image size, < 35MB RAM usage, instant startup (< 100ms).

---

## 4. API Endpoints Specification

Base path: `/api/v1`

### 4.1 System & Health
- `GET /health`: Service health check, database connectivity check, and last cloud sync timestamp (`app_meta.last_cloud_sync_at`).
- `GET /api/v1/metrics/available`: List all metrics present in database and active date ranges.

### 4.2 Workouts (`/api/v1/workouts`)
- `GET /api/v1/workouts`: Paginated list of workout summaries (`limit`, `offset`, `type`, `from`, `to`).
- `GET /api/v1/workouts/latest`: Returns latest workout summary.
- `GET /api/v1/workouts/latest/enriched`: Returns latest workout with complete enriched context (matches `example_data.json`).
- `GET /api/v1/workouts/:id`: Basic workout details.
- `GET /api/v1/workouts/:id/enriched`: Full workout detail merged with:
  - `core_execution`: Distance (m, km, miles), durations, formatted pace (`M:SS /km`), HR stats, cadence, stride, calories, splits array, and HR zone breakdown.
  - `environmental_terrain`: Normalized elevation gain/loss, min/max altitude (clearing `-40000` raw sentinels), terrain type.
  - `readiness_stress`: Prior-night sleep session (score, duration, deep/light/rem/awake minutes, wake count, resting HR), day readiness score, HRV rmssd, and physical/mental biocharge.
- `GET /api/v1/workouts/:id/samples`: Per-second sample curve (HR, cadence, pace, altitude) with optional downsampling (`?interval=5s`).
- `GET /api/v1/workouts/:id/route`: GeoJSON / array of GPS route coordinates (`route_points`).

### 4.3 AI Coach & Context Export (`/api/v1/ai`)
- `GET /api/v1/ai/context`:
  - Query params: `days` (default: 7), `from`, `to`, `format` (`markdown` | `json`, default `markdown`).
  - Generates the official `schema: zeppbridge.ai_task` export matching `ZeppBridge_1104-1110_workouts and 6 more.md`:
    - Coach notes & athlete goals.
    - Personal bests (5k, 10k, HM, FM).
    - Data coverage table across categories.
    - Daily metrics CSV table (resting HR, readiness, physical/mental charge, HRV, VO2max, PAI, steps, calories).
    - Sleep CSV table (start/end, score, duration, stages, wake count).
    - Workouts in range CSV table.
    - AI Coach guidelines & workout plan schema (`zeppbridge-plan/3`).

### 4.4 Daily Health & Recovery (`/api/v1/daily`, `/api/v1/sleep`, `/api/v1/readiness`)
- `GET /api/v1/dashboard/today`: Today's unified dashboard card: current steps, active calories, sleep score last night, readiness score, HRV, resting HR, last workout summary.
- `GET /api/v1/daily`: Date-range pivot table of daily metrics (`?from=YYYY-MM-DD&to=YYYY-MM-DD`).
- `GET /api/v1/sleep`: Sleep sessions list with stage breakdown (`deep`, `light`, `rem`, `awake`).
- `GET /api/v1/readiness`: Daily recovery, biocharge (physical/mental), and HRV trends.
- `GET /api/v1/stats/pbs`: Personal best records (auto-calculated from recorded samples).

---

## 5. Non-Functional Requirements & Security

1. **Authentication**:
   - Optional `API_KEY` environment variable.
   - If set, validates `Authorization: Bearer <token>` or `X-API-Key: <token>`.
   - If unset, runs unauthenticated for secure internal Docker networks (`172.x.x.x`).

2. **Read-Only Guarantee**:
   - Opened with `new DatabaseSync(path, { readOnly: true })`.
   - SQL queries restricted to `SELECT`.
   - No risk of corrupting database while `zeppbridge-cli sync` writes.

3. **Timezone Handling**:
   - Configurable `TZ` (default: `Asia/Jakarta`, UTC+7).
   - All timestamps formatted in ISO 8601 UTC (`start_time`) and local human-readable string (`start_time_local`).

4. **Altitude Sentinel Normalization**:
   - Raw Zepp altitude markers (`-39999.1`, `40732.3`) filtered and normalized using ZeppBridge stored values or altitude clamps.

---

## 6. Deployment Specification (Docker & Portainer)

### 6.1 Directory Structure in Repo
```
api/
├── Dockerfile
├── docker-compose.example.yml
├── package.json
├── src/
│   ├── server.js          # Native HTTP router & request handler
│   ├── db.js              # node:sqlite connection & prepared queries
│   ├── transforms/
│   │   ├── enriched.js    # Transforms raw DB rows to example_data.json format
│   │   ├── ai_export.js   # Generates zeppbridge.ai_task Markdown & CSV
│   │   └── dashboard.js   # Generates daily dashboard summaries
│   └── utils/
│       ├── pace.js        # Pace & duration formatters
│       └── auth.js        # API key verification
└── PRD.md
```

### 6.2 Portainer Stack Example (`docker-compose.yml`)
```yaml
services:
  zeppbridge:
    image: zeppbridge:latest
    container_name: zeppbridge
    restart: unless-stopped
    volumes:
      - zeppbridge_data:/data
    environment:
      - ZEPPBRIDGE_APP_TOKEN=WQ...
      - ZEPPBRIDGE_DATA_DIR=/data
      - TZ=Asia/Jakarta

  zeppbridge-api:
    build: ./api
    container_name: zeppbridge-api
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - zeppbridge_data:/data:ro
    environment:
      - PORT=8080
      - DB_PATH=/data/zepp.db
      - API_KEY=
      - TZ=Asia/Jakarta
    depends_on:
      - zeppbridge

volumes:
  zeppbridge_data:
    external: true
```

---

## 7. Implementation Milestones

- **Phase 1: Core Foundation**: Set up `api/package.json`, `src/db.js` with `node:sqlite`, native HTTP server in `src/server.js`, auth middleware, and `GET /health`.
- **Phase 2: Enriched Workout Engine**: Implement queries and `transforms/enriched.js` producing exact `example_data.json` structure for `/api/v1/workouts/:id/enriched` and `/latest/enriched`.
- **Phase 3: AI Context & Markdown Generator**: Implement `transforms/ai_export.js` generating `zeppbridge.ai_task` Markdown/CSV bundles for `/api/v1/ai/context`.
- **Phase 4: Dashboard & Daily Health APIs**: Implement `/api/v1/dashboard/today`, `/api/v1/daily`, `/api/v1/sleep`, and `/api/v1/stats/pbs`.
- **Phase 5: Packaging & Verification**: Write `api/Dockerfile`, `api/docker-compose.example.yml`, and self-check verification test script using `api/zepp.db`.
