# Schedule-optimizer service

Thin [FastAPI](https://fastapi.tiangolo.com/) wrapper around the existing
PuLP MILP optimizer (`scheduling_milp.py`). It owns **optimization only**: it
never queries Supabase, never connects to PostgreSQL, and contains no database
credentials or AI/LLM/RAG logic. The Node/Express backend sends a complete,
already-expanded optimizer payload and consumes the structured result.

## Endpoints

| Method | Path               | Purpose                                       |
| ------ | ------------------ | --------------------------------------------- |
| GET    | `/health`          | `{"status": "ok"}`                            |
| POST   | `/schedule-optimize` | Run the existing MILP and return a result. |

`/schedule-optimize` returns HTTP 200 for `optimal`, `infeasible`, and other
solver statuses. Invalid model data returns HTTP 422 (`invalid_input`);
unexpected internal failures return HTTP 500 (`internal_error`).

## Local run

```bash
cd server/optimizer
pip install -r requirements.txt          # pulp
pip install fastapi uvicorn pytest       # FastAPI layers + test runner
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

The Node backend then points at the service with:

```
SCHEDULE_OPTIMIZER_URL=http://localhost:8001
```

The `/schedule-optimize` payload mirrors the existing MILP
`solve_backend_request` input (courses, sections with meetings, min/max
credits, weights, attribute requirement groups, professor scores, excluded
CRNs, `request_id`, etc.).

## Tests

The optimizer suites live with the rest of the test suite under
`server/tests/optimizer/`. Run them from `server/` (Python must be able to
resolve the optimizer source, which the test files bootstrap automatically):

```bash
cd server
python -m pytest tests/optimizer/test_api.py -q          # FastAPI HTTP contract tests
python -m unittest discover -s tests/optimizer -p "test_*.py"   # original MILP tests
```

## Node integration

The Express backend exposes `POST /api/schedule/optimize` which validates a
user-level request, queries Supabase, expands it into the optimizer payload,
and forwards it to the FastAPI service (see
`server/src/services/schedule-optimizer.service.ts`).
