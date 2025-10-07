# Energy Insight Platform

Energy Insight is a full-stack analytics suite that turns raw energy usage CSVs into interactive dashboards, bilingual AI recommendations, and question/answer insights. The project is split into a FastAPI backend and a Next.js frontend connected to Supabase for storage and authentication.

## Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
  - [Data Upload & Storage](#data-upload--storage)
  - [Analytics Dashboard](#analytics-dashboard)
  - [Report Export](#report-export)
  - [AI Recommendations](#ai-recommendations)
  - [Chat With Your Data](#chat-with-your-data)
  - [Dataset History & Management](#dataset-history--management)
  - [Internationalisation](#internationalisation)
  - [Authentication](#authentication)
- [Environment Configuration](#environment-configuration)
  - [Supabase Setup](#supabase-setup)
  - [Backend Environment](#backend-environment)
  - [Frontend Environment](#frontend-environment)
- [Local Development](#local-development)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Running Everything Together](#running-everything-together)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Troubleshooting & Tips](#troubleshooting--tips)
- [Roadmap Ideas](#roadmap-ideas)

## Architecture Overview

```
CSV Upload  ─┐
             │          ┌────────────┐         ┌────────────┐
Browser UI ──┼─ Next.js │  Frontend  │  HTTPS  │  FastAPI   │
             │          │  (pnpm)    │────────▶│  Backend   │─┐
Supabase Auth┘          └────────────┘         └────────────┘ │
                                                              ▼
                                                       Supabase DB
```

- **Frontend** (Next.js 15 + Tailwind + TypeScript): interactive dashboard, multilingual UI, Supabase email/password auth, CSV upload, analytics visualisation, CSV report export, chat interface.
- **Backend** (FastAPI + Pydantic + Supabase client): CSV parsing, metric aggregation, storage, per-user isolation, chat SQL sandbox, OpenAI-powered recommendation engine.
- **Supabase**: Postgres database, authentication provider, secure storage for datasets/readings with user scoping.
- **OpenAI** (optional): Generates bilingual recommendation content for recent datasets.

## Key Features

### Data Upload & Storage
- Accepts UTF-8 CSV files with either `datetime,kwh[,cost]` or `date,time,kwh[,cost]` columns.
- Backend validates structure, parses readings, and calculates derived metrics (totals, PLF, peak windows, etc.).
- Results and raw readings are stored in Supabase with a per-user `user_id` so data stays private.
- Duplicate detection uses a content fingerprint to prevent re-uploading identical datasets for the same user.

### Analytics Dashboard
- Displays stat cards (total consumption, cost, CO₂, peak day) with change indicators.
- Visualises usage over time and cost breakdown segments.
- Shows latest AI recommendations and narrative insights (peak window, top expensive days, quarter deltas, etc.).
- Automatically refreshes after upload.

### Report Export
- “Export Report” button creates a locale-aware CSV containing:
  - Stat cards and change trends.
  - Badges, cost breakdown segments, usage series.
  - AI recommendations (both languages where available).
  - Insight metrics (peak day, top expensive days, weekend vs weekday comparison, quarter delta, peak window, average cost per kWh, shift opportunity, CO₂ factor, etc.).
- Download runs entirely client-side and includes success/error toasts with spinner feedback.

### AI Recommendations
- On every successful upload the backend asks OpenAI for structured cost-saving, CO₂, and efficiency advice in English & French.
- If OpenAI is unavailable the system degrades gracefully with empty recommendations.
- Frontend renders both languages and the toggle switches between them instantly.

### Chat With Your Data
- Conversational assistant converts natural language questions to safe SQL (read-only, user-filtered).
- Uses an in-memory SQLite sandbox populated only with the signed-in user’s rows.
- Presents markdown responses with supporting bullet lists where appropriate.

### Dataset History & Management
- History page lists a user’s previously uploaded datasets with key metrics and timestamps.
- Per-row delete button removes both metadata and readings in Supabase.
- Dataset detail page shows summary stats, charts, AI recommendations, and the full readings table.

### Internationalisation
- Entire UI is bilingual (French default, English toggle). All stat labels, button text, and messages switch instantly.
- Numeric, currency, and date formatting respects the selected locale.

### Authentication
- Supabase email/password sign-up and sign-in forms with validation and confirmation messaging.
- Auth guard protects upload, analytics, history, dataset detail, and chat routes.
- Backend endpoints verify Supabase JWTs with `SUPABASE_JWT_SECRET`, guaranteeing per-user isolation.

## Environment Configuration

### Supabase Setup
1. **Create tables** (replace names if you customise them):
   ```sql
   create table if not exists energy_datasets (
     id bigint generated always as identity primary key,
     user_id uuid not null,
     original_filename text not null,
     uploaded_at timestamptz not null default now(),
     total_kwh double precision not null,
     total_cost double precision not null,
     total_co2 double precision not null,
     row_count integer not null,
     summary_json jsonb not null,
     fingerprint text not null,
     unique (user_id, fingerprint)
   );

   create table if not exists energy_readings (
     id bigint generated always as identity primary key,
     user_id uuid not null,
     dataset_id bigint not null references energy_datasets(id) on delete cascade,
     reading_date date not null,
     reading_time time,
     reading_at timestamptz,
     kwh double precision not null,
     cost double precision not null
   );
   ```
2. **Indexing** (for snappy history/detail pages):
   ```sql
   create index if not exists energy_datasets_user_idx on energy_datasets(user_id, uploaded_at desc);
   create index if not exists energy_readings_dataset_user_idx on energy_readings(dataset_id, user_id);
   ```
3. **Backfill existing rows** (only if migrating from an earlier version):
   ```sql
   update energy_datasets set user_id = '<existing-user-uuid>' where user_id is null;
   update energy_readings r
     set user_id = d.user_id
     from energy_datasets d
     where r.dataset_id = d.id and r.user_id is null;
   ```
4. **(Optional) Enable Row Level Security** and add policies if you intend to access Supabase directly with the anon key.

### Backend Environment
Create `backend/.env` (or export variables) containing:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-settings>
SUPABASE_DATASET_TABLE=energy_datasets
SUPABASE_READINGS_TABLE=energy_readings
SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require
OPENAI_API_KEY=<optional-openai-key>
OPENAI_RECOMMENDATION_MODEL=gpt-4o-mini
ENERGY_INSIGHT_DEFAULT_RATE=0.32
ENERGY_INSIGHT_CO2_FACTOR=0.45
```

The service role key is required because the backend performs server-side inserts/deletes. The JWT secret is used to validate Supabase access tokens supplied by the frontend.

### Frontend Environment
Create `frontend/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

If you proxy the backend differently in production, update `NEXT_PUBLIC_API_BASE_URL` accordingly.

## Local Development

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```
- Swagger UI: http://127.0.0.1:8000/docs
- Re-run `pip install -r requirements.txt` whenever dependencies change (e.g., PyJWT).

### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```
- Default Next.js dev server: http://localhost:3000
- The Supabase auth hooks persist sessions; sign in once and refresh to confirm guards.

### Running Everything Together
1. Start the backend (`uvicorn ...`).
2. Start the frontend (`pnpm dev`).
3. Visit http://localhost:3000, create an account via “Créer un compte / Create account”, then upload a CSV.

## API Reference

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET  | `/health` | none | Service readiness check |
| POST | `/api/upload` | Bearer (Supabase JWT) | Ingest CSV, compute summary, store dataset, return analytics |
| GET  | `/api/analytics/summary` | Bearer | Latest summary for current user |
| GET  | `/api/analytics/history?limit=` | Bearer | Paginated history for current user |
| GET  | `/api/analytics/datasets/{id}` | Bearer | Detailed dataset (summary + readings) owned by user |
| DELETE | `/api/analytics/datasets/{id}` | Bearer | Delete dataset + readings owned by user |
| POST | `/api/chat` | Bearer | Ask a natural-language question; backend runs scoped SQL sandbox |

## Project Structure

```
backend/
  api/               # FastAPI routers & dependencies
  core/              # Config loading
  schemas.py         # Pydantic models shared across services
  services/
    analytics.py     # CSV parsing, metric computation
    chat_agent.py    # SQL sandbox + OpenAI chat orchestration
    recommendations.py
    supabase_storage.py
frontend/
  app/               # Next.js routes (upload, analytics, history, chat, auth)
  components/        # UI building blocks (auth guard, charts, cards)
  context/           # React context for auth & language
  lib/               # API client, Supabase browser client, formatting helpers
  styles/
```

## Troubleshooting & Tips

- **Missing JWT secret**: Backend endpoints will return `500 Supabase JWT secret is not configured` if `SUPABASE_JWT_SECRET` is absent.
- **Service role vs anon key**: Use the service role key on the backend so inserts succeed even with RLS. Keep it server-side only.
- **Legacy datasets**: After adding `user_id`, backfill or remove old rows before enforcing the NOT NULL constraint.
- **OpenAI quota**: Recommendations fall back gracefully when the API key is missing or requests fail; logs show decoding issues.
- **CSV parsing errors**: Ensure UTF-8 encoding and required columns. Example valid row:
  ```
  date,time,kwh,cost
  2025-03-01,07:00,18.5,5.90
  ```
- **Export file opens with garbled characters**: The report uses UTF-8 with CRLF terminators for spreadsheet compatibility; choose UTF-8 when importing manually.

## Roadmap Ideas

- Role-based access and shared datasets.
- Automated Supabase migrations (SQL files or Prisma).
- Unit tests for analytics aggregation and recommendation parsing.
- Additional export formats (PDF, XLSX).
- Scheduled refresh & alerts when new CSVs arrive.

Happy analyzing!
