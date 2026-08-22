# RetailPulse AI — Resume Summary

## Project title
**RetailPulse AI**

## One-line description
A full-stack, multi-vendor retail operations platform combining a Node/Express/MongoDB API, a Python/FastAPI demand-forecasting and anomaly-detection service, a deterministic recommendation engine, a retrieval-grounded Gemini AI assistant, and a React dashboard — Dockerized across all three services.

## Resume bullets

- Designed and built a full-stack retail operations platform (React, Node/Express, MongoDB, Python/FastAPI) with JWT authentication, role-based access control (3 roles), and a layered routes → controllers → services → models backend architecture across 11 Mongoose models and 44 REST endpoints.
- Implemented a commerce integration layer using the adapter pattern (a mock external provider plus a second stub adapter demonstrating pluggability) with idempotent webhook ingestion enforced by a database-level unique index, and MongoDB aggregation pipelines for sales/vendor/product analytics.
- Built a demand-forecasting and anomaly-detection service in Python/FastAPI/scikit-learn (`RandomForestRegressor` evaluated against a naive baseline on a chronological — non-leaking — train/test split; `IsolationForest` for anomaly detection), measuring the model beating baseline on 8 of 9 seeded products and reporting the honest exception rather than hiding it.
- Designed a retrieval-grounded AI assistant (Gemini) that classifies user questions into a fixed intent set, retrieves only the minimally-scoped MongoDB data needed to answer, and never gives the LLM direct database or tool access — verified with tests proving prompt-injection attempts never reach the model.
- Wrote 178 automated tests across three languages/frameworks (Jest/Supertest, pytest, Vitest/React Testing Library), reaching ~91% backend statement coverage, and Dockerized all three services with health checks, verified end-to-end via `docker compose up`.

## Technology stack

**Frontend:** React 19, Vite, Tailwind CSS v4, React Router v7, Recharts v3, Vitest, React Testing Library
**Backend:** Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Zod, Helmet, express-rate-limit, node-cron, Jest, Supertest
**ML:** Python, FastAPI, pandas, NumPy, scikit-learn, pymongo, pytest
**AI:** Google Gemini API (server-side integration, no client-side key exposure)
**Infra:** Docker, Docker Compose, MongoDB (external)

## Key engineering concepts demonstrated

- Layered backend architecture with clean separation of concerns (routes/controllers/services/models/middleware/validators)
- JWT authentication with server-re-verified authorization (role read fresh from the database every request, not trusted from the token)
- Role-based access control enforced server-side, with a documented permission matrix
- Adapter design pattern for provider-agnostic external integrations
- Idempotent webhook processing backed by a database uniqueness constraint, not just application logic
- Database-side analytical computation via MongoDB aggregation pipelines ($match/$group/$lookup) rather than in-memory reduction
- Time-series feature engineering without data leakage (lag/rolling features computed strictly on prior observations) and chronological (non-random) train/test evaluation
- Baseline-comparison discipline in ML reporting — a model is only claimed useful if it's measured beating a naive baseline, and the one case where it doesn't is reported honestly
- Unsupervised anomaly detection (Isolation Forest) paired with deterministic, threshold-based human-readable explanations — no LLM-generated "reasoning"
- Retrieval-augmented generation architecture without heavyweight infrastructure: no vector database, no LangChain, no direct model-to-database access — intent classification plus scoped MongoDB retrieval sized to a small, well-known dataset
- Defense-in-depth security: bcrypt hashing, centralized error handling with environment-gated stack-trace exposure, Helmet, rate limiting, a CORS policy that fails closed (not open) when misconfigured in production, and dependency vulnerability auditing (`npm audit`, `pip-audit`)
- Multi-service Docker packaging with per-service health checks and a documented, verified `docker compose up` path

## Real project metrics (computed from the repository, not estimated)

| Metric | Value |
|---|---|
| Backend automated tests | 143 (19 suites) |
| ML service automated tests | 26 |
| Frontend automated tests | 9 |
| Total automated tests | 178 |
| Backend statement coverage | ~91% |
| Mongoose models | 11 |
| Backend services | 15 |
| REST API endpoints | 44 (13 resource route groups) |
| Frontend pages | 10 |
| ML algorithms implemented | 2 (RandomForestRegressor for forecasting, IsolationForest for anomaly detection) |
| Integration adapters | 2 (one functional mock provider, one pluggability-proof stub) |
| Dockerized services | 3 (frontend, backend, ML service) + external MongoDB |
| User roles | 3 (admin, operator, analyst) |
| Dependency vulnerabilities (npm audit + pip-audit, last check) | 0 |
