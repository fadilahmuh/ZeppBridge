# ZeppBridge REST API

Zero-dependency Node.js 24 read-only HTTP service exposing enriched workout, daily health, and AI context endpoints from `zepp.db`.

## Run Locally

Requires Node.js >= 24 (uses built-in `node:sqlite`).

```sh
cd api
DB_PATH=./zepp.db PORT=8080 node src/server.js
```

Run the self-check verification suite:

```sh
cd api
npm test
```

## Run in Docker

Build the image:

```sh
cd api
docker build -t zeppbridge-api .
```

Or deploy alongside `zeppbridge` using `docker-compose.example.yml`:

```sh
docker compose -f api/docker-compose.example.yml up -d
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DB_PATH` | `/data/zepp.db` (`zepp.db` locally) | Path to SQLite database (opened `readOnly: true`) |
| `API_KEY` | *(unset)* | Optional bearer / `X-API-Key` token for `/api/v1/*` routes |
| `TZ` | `Asia/Jakarta` | Timezone for `*_local` formatted timestamps |

## Endpoints

- `GET /health` — Health & DB connectivity (`last_cloud_sync_at`)
- `GET /api/v1/metrics/available` — Available metrics and date ranges
- `GET /api/v1/workouts` — Paginated workout summaries (`limit`, `offset`, `type`, `from`, `to`)
- `GET /api/v1/workouts/latest` — Latest workout summary
- `GET /api/v1/workouts/latest/enriched` — Latest workout with sleep & readiness context
- `GET /api/v1/workouts/:id` — Workout detail
- `GET /api/v1/workouts/:id/enriched` — Enriched workout matching `example_data.json`
- `GET /api/v1/workouts/:id/samples` — Per-second workout samples (`?interval=5s`)
- `GET /api/v1/workouts/:id/route` — GPS route points
- `GET /api/v1/ai/context` — `zeppbridge.ai_task` export (`?days=7&format=markdown|json`)
- `GET /api/v1/dashboard/today` — Unified today health & recovery summary
- `GET /api/v1/daily` — Daily metrics range (`?from=YYYY-MM-DD&to=YYYY-MM-DD`)
- `GET /api/v1/sleep` — Sleep sessions with stage breakdown
- `GET /api/v1/readiness` — Readiness, biocharge, and HRV trends
- `GET /api/v1/stats/pbs` — Personal best records
