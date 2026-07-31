# LogicFlow API

The LogicFlow API is an Express and TypeScript service. Phase 1.1 provides the
application foundation only; database-backed modules will be added as the
existing Supabase schema becomes available.

## Setup

1. Copy `.env.example` to `.env` and set the application values.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

The health endpoint is available at `GET /api/health`. It verifies that the
configured Supabase PostgREST endpoint is reachable without querying a table;
no schema assumptions are made.

## Commands

- `npm run build` — type-check the source.
- `npm run lint` — run ESLint.
- `npm run format:check` — verify Prettier formatting.

The required Supabase and authentication environment variables are documented
in `.env.example` for their respective upcoming modules.
