# Energy Insight Backend

This FastAPI service ingests CSV exports of energy usage and returns computed analytics to the Next.js frontend.

## Install & Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

The API runs on http://127.0.0.1:8000. Interactive docs are available at http://127.0.0.1:8000/docs.

Configure Supabase credentials before starting the server (environment variables or `backend/.env` files are supported):

```bash
# option 1: export in the shell
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# (or SUPABASE_ANON_KEY if you prefer the anon key)

# option 2: backend/.env (auto-loaded)
cat <<EOF > backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

cat <<EOF >> backend/.env
SUPABASE_DB_URL=postgresql://user:password@host:5432/postgres?sslmode=require
EOF
```

Create the `energy_datasets` and `energy_readings` tables in your Supabase project with columns matching the payloads described below.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Basic readiness probe |
| `POST` | `/api/upload` | Accepts a UTF-8 CSV (datetime or date+time, kwh[,cost]) and returns computed analytics |
| `GET` | `/api/analytics/summary` | Retrieves the most recent analytics summary |
| `GET` | `/api/analytics/history` | Lists stored dataset uploads (latest first) |
| `GET` | `/api/analytics/datasets/{id}` | Retrieves a stored dataset with readings and summary |
| `POST` | `/api/chat` | Natural-language chat with safe SQL retrieval |

Analytics metrics include:
- Total consumption, total cost, estimated CO₂ emissions, and peak usage day
- Daily usage series for charting
- Cost breakdown (peak, off-peak, weekend) driven by the uploaded data
- AI recommendations generated via OpenAI when configured

Energy datasets are stored in Supabase with every upload, including per-day readings and the rendered summary payload.

Upload a new CSV whenever you want to refresh the dashboard.

## AI-powered recommendations

Set an OpenAI API key so the backend can request live recommendations during uploads.

```bash
export OPENAI_API_KEY=sk-your-key
# optional: override the default model
export OPENAI_RECOMMENDATION_MODEL=gpt-4o-mini
```

If the key is missing or the OpenAI SDK is not installed, the service returns an empty recommendations list.

## Architecture

- `backend/main.py`: FastAPI application factory and middleware setup.
- `backend/api/routes.py`: HTTP endpoints for health checks and analytics operations.
- `backend/services/analytics.py`: CSV parsing and metric aggregation.
- `backend/services/recommendations.py`: OpenAI integration and fallbacks for AI recommendations.
- `backend/core/config.py`: environment-driven configuration shared across services.
- `backend/services/supabase_storage.py`: helpers for storing uploads and fetching summaries from Supabase.

### Supabase schema

Create the following tables in Supabase (names can be overridden via `SUPABASE_DATASET_TABLE` and `SUPABASE_READINGS_TABLE` environment variables):

`energy_datasets`
- `id` (bigint, primary key)
- `original_filename` (text)
- `uploaded_at` (timestamptz, default now())
- `total_kwh` (double precision)
- `total_cost` (double precision)
- `total_co2` (double precision)
- `row_count` (integer)
- `summary_json` (jsonb)
- `fingerprint` (text, unique)

`energy_readings`
- `id` (bigint, primary key)
- `dataset_id` (bigint, foreign key -> `energy_datasets.id`)
- `reading_date` (date)
- `kwh` (double precision)
- `cost` (double precision)
