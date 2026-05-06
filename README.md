# Portfolio Health Dashboard

A C-level dashboard that pulls deal + project + communication data from **HubSpot** and **Jira**, runs **OpenAI** sentiment + next-action analysis at refresh time, and presents per-client health scores, sprint progress, risks, opportunities, and forecasts on a password-gated URL.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts · OpenAI (gpt-4o-mini) · jose (Edge auth) · pnpm · Vercel**.

---

## Quick start

```bash
pnpm install
cp .env.example .env       # then fill in the values (see "Environment" below)
pnpm dev                   # http://localhost:3000
```

Login password is whatever you set in `ACCESS_PASSWORD`. The page loads empty by default — click **Refresh** to trigger the data + LLM pipeline.

---

## Integration modes

The dashboard runs in one of three modes via the `INTEGRATIONS_MODE` env var. The same UI and same parsing code path is used in all three; only the data source changes.

| Mode | What it does | When to use |
|---|---|---|
| **`mock-domain`** *(default)* | Reads scenarios directly from `src/mocks/seed.ts`. No HTTP. | Fastest dev loop; no creds needed. |
| **`mock-api`** | Routes through `*.real.ts` adapters; the adapters synthesize realistic Jira/HubSpot API responses from `seed.ts` and the real parser code consumes them. | Validates the parsing layer end-to-end; proves the swap to live mode will work. |
| **`real`** | `*.real.ts` adapters call live HubSpot + Jira REST APIs using your tokens. | Production / staging with real accounts. |

Switch via `.env`:

```env
INTEGRATIONS_MODE=mock-domain   # or mock-api / real
```

---

## Environment

Copy `.env.example` → `.env`, then fill these in:

```env
OPENAI_API_KEY=sk-...
ACCESS_PASSWORD=demo
AUTH_SECRET=run-`openssl rand -base64 48`-once-and-paste-here
USE_MOCKS=1
DISABLE_CACHE=0          # set 1 to bypass LLM caches (fresh OpenAI on every refresh)
INTEGRATIONS_MODE=mock-domain

# Required only when INTEGRATIONS_MODE=real
JIRA_BASE_URL=https://yourname.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=ATATT...
HUBSPOT_PORTAL_ID=12345678
HUBSPOT_ACCESS_TOKEN=pat-na1-...
```

`AUTH_SECRET` must be ≥32 chars. Generate with `openssl rand -base64 48`.

---

## How a refresh works

1. **Click Refresh** → opens an SSE stream to `GET /api/refresh`.
2. Server pulls deals from HubSpot, projects from Jira, calls + emails per deal.
3. **Sentiment** classifier (gpt-4o-mini) runs on every call note + email body — concurrency 15, cached forever per `(id, content-hash)`.
4. **Next actions** generator (gpt-4o-mini) runs per client — concurrency 10, cached per snapshot hash.
5. **Predictions** — deterministic math, extrapolates current burn / delivery rate.
6. **Health score** — weighted combination of 6 signals (budget vs timeline, promised vs delivered, calls sentiment, email sentiment, momentum, staleness).
7. Snapshot streamed back to the browser; SWR cache updated; UI fills in.

The pipeline takes ~5–25s on first run, ~2–5s on subsequent runs (cache hits). Set `DISABLE_CACHE=1` to force every run to be a cold OpenAI run.

---

## Project layout

```
src/
├── app/                          # Next.js App Router
│   ├── login/                    # password form
│   ├── portfolio/
│   │   ├── PortfolioClient.tsx   # client component, SWR
│   │   └── [clientId]/           # drill-down
│   └── api/
│       ├── login/route.ts        # cookie-based auth
│       ├── portfolio/route.ts    # JSON fetch (SWR)
│       └── refresh/route.ts      # SSE stream of pipeline progress
├── components/
│   ├── portfolio/                # KPI strip, donut, at-risk list, client grid
│   └── client-detail/            # timeline, health breakdown, burn chart, sprints, predictions, risks/opps, calls timeline, actions
├── lib/
│   ├── ai/                       # sentiment + next-actions LLM modules
│   ├── data/                     # composer + derive helpers
│   ├── health/score.ts           # weighted health score
│   ├── integrations/
│   │   ├── jira.ts               # mode dispatcher
│   │   ├── jira.real.ts          # Jira REST adapter (also covers mock-api via synth)
│   │   ├── hubspot.ts            # mode dispatcher
│   │   └── hubspot.real.ts       # HubSpot CRM v3 adapter
│   ├── predictions.ts            # deterministic forecasts
│   ├── auth.ts                   # jose JWT
│   ├── cache.ts                  # in-memory snapshot cache
│   └── env.ts                    # zod-validated env schema
├── mocks/
│   ├── seed.ts                   # 5 demo scenarios — single source of truth
│   └── fixtures/                 # committed sentiment + actions warm-start
└── proxy.ts                      # Edge auth middleware
scripts/
├── generate-sentiment.ts         # offline batch sentiment generator (warm fixture)
├── generate-actions.ts           # offline batch actions generator
├── dump-scores.ts                # CLI: per-scenario health scores
└── dump-predictions.ts           # CLI: per-scenario forecasts
```

---

## Demo scenarios

Five companies, each engineered to show a distinct chart pattern:

| Company | At "today" | What it demos |
|---|---|---|
| **Northwind Logistics** | Delivered 65% > Time 50% > Budget 35% | Best case — efficient + ahead |
| **Pinecone Retail** | Budget 105% > Time 70% > Delivered 40% | Worst case — over budget AND behind |
| **Acme Foods** | Time 70% > Budget 25% ≈ Delivered 20% | Stalled — calendar moves, no work |
| **Helio Bank** | Time 65% > Budget 60% > Delivered 35% | Productivity problem — on budget, behind |
| **Onyx Studios** | Delivered 80% > Budget 65% > Time 50% | Done early, premium pace |

---

## Useful scripts

```bash
pnpm tsx scripts/dump-scores.ts          # health scores per scenario
pnpm tsx scripts/dump-predictions.ts     # forecasts per scenario
pnpm tsx scripts/generate-sentiment.ts   # regenerate sentiment fixture
FORCE=1 pnpm tsx scripts/generate-sentiment.ts   # force re-classify all
pnpm build                               # production build
pnpm dev                                 # dev server
```

---

## Deploy (Vercel)

1. Push to GitHub.
2. Import project in Vercel.
3. Add the same env vars from `.env` to the Vercel project's Environment Variables UI (Production + Preview).
4. Deploy. Visit the preview URL, log in with `ACCESS_PASSWORD`, click Refresh.
