# ThinkTrace

**Enterprise multi-tenant AI reasoning audit platform.**

ThinkTrace analyzes any argument — text, PDF, or URL — using four specialist AI agents running in parallel. It maps logical structure, detects named fallacies, verifies facts against live web sources, and produces an epistemic score with a structured audit report.

**Live:** https://thinktrace.nandhusk.dev  

---

## What it does

Submit any argument. Four agents fire simultaneously and their findings are combined into a single structured report:

- **Parser** — Extracts every distinct claim from the text. Premises, conclusions, and sub-claims are identified and typed. Attribution metadata is tracked so claims attributed to others are flagged separately from the author's own assertions.

- **Mapper** — Builds an argument graph showing which claims support which, which contradict each other, and where the reasoning chain breaks. Scores each logical connection for validity (0.0–1.0) and identifies missing premises.

- **Detector** — Identifies named logical fallacies (Ad Hominem, Straw Man, False Cause, Hasty Generalization, etc.) with severity ratings and plain-language explanations. Only fires on the author's own claims, not on attributed statements.

- **Verifier** — Fact-checks every verifiable claim against 5 live sources in parallel: Google Search, Wikipedia, ArXiv, PubMed, and NewsAPI. Each claim gets a verdict: Supported, Contradicted, Contested, or Unverifiable, with source attribution and confidence scores. Smart source routing — medical claims hit PubMed, scientific claims hit ArXiv, current events hit NewsAPI.

- **Epistemic Scorer** — Synthesizes all agent findings into an overall score (0–100) with sub-scores for evidence quality and logical validity. Context-aware — encyclopedic content is scored differently from direct arguments.

---

## Architecture

Parser runs first. Mapper, Detector, and Verifier fire simultaneously using ThreadPoolExecutor. This reduces analysis time from ~90 seconds sequential to ~20 seconds parallel.
```
Parser ──────────────────────────────────────► Claims
         ├── Mapper   ──► Argument graph + validity scores
         ├── Detector ──► Named fallacies + severity
         └── Verifier ──► Fact verdicts (5 sources async)
                              └── Epistemic Scorer ──► 0-100 score
```

---

## Enterprise Stack

### AI Orchestration

| Technology | Role | How it is used |
|---|---|---|
| Claude API (Sonnet) | Core LLM | Powers all 4 agents. Each agent sends a structured prompt and parses the JSON response |
| LangGraph | Agent orchestration | Defines agents as nodes in a directed graph, manages parallel execution and state |
| LangChain | LLM toolkit | ChatAnthropic wrapper, message formatting, prompt management |
| LangSmith | Observability | Every agent call is traced with inputs, outputs, latency, and token usage |

### Data Storage — Triple Store

| Technology | Role | How it is used |
|---|---|---|
| PostgreSQL | Primary database | Stores users, organisations, and full analysis records. SQLAlchemy QueuePool (10 base + 20 overflow connections) |
| SQLAlchemy | ORM | Maps Python models to PostgreSQL tables, handles connection pooling |
| Pinecone | Vector database | Stores 384-dim semantic embeddings per analysis, namespaced by org. Enables similarity search |
| Neo4j Aura | Graph database | Stores Org → User → Analysis → Claim → Fallacy relationships for cross-analysis graph queries |
| sentence-transformers | Embeddings | all-MiniLM-L6-v2 generates local embeddings with no network calls for Pinecone upserts |

### Fact Checking — 5 Live Sources

| Source | Trigger | What it returns |
|---|---|---|
| Serper (Google) | All claims | Web search results with snippets |
| Wikipedia REST API | All claims | Article summaries and search results |
| ArXiv API | Scientific language detected | Academic paper titles and abstracts |
| PubMed (NCBI) | Medical or health claims | Research paper titles |
| NewsAPI | Current events claims | Recent news articles |

Source routing is automatic. All selected sources run in parallel with 8-second per-source timeouts.

### Async Infrastructure

| Technology | Role | How it is used |
|---|---|---|
| Celery | Task queue | Handles async analysis jobs, Watchdog scheduling, and eval runs |
| Upstash Redis | Message broker and cache | Celery broker, token blacklist, rate limit counters, OTP storage, content hash cache, eval results |
| APScheduler | Cron scheduling | Fires Watchdog URL checks at configurable intervals |

### Backend

| Technology | Role | How it is used |
|---|---|---|
| FastAPI | API framework | 33 endpoints across 5 routers. Async request handling, automatic OpenAPI docs |
| Gunicorn + Uvicorn | Production server | (2xCPU)+1 workers, 150s timeout, max 1000 requests per worker before recycle |
| Pydantic v2 | Validation | All request and response models. Field validators on email, password strength, content length |
| bcrypt | Password hashing | Direct bcrypt with 72-byte truncation, salted per user |
| python-jose | JWT auth | 24-hour tokens, Redis blacklist on logout |
| Resend | Transactional email | OTP verification emails via verified noreply@nandhusk.dev domain |

### Frontend

| Technology | Role | How it is used |
|---|---|---|
| Next.js 14 | React framework | App Router, server components, layout system |
| TypeScript | Type safety | Full type coverage across all components, API client, and store |
| Tailwind CSS | Styling | Utility classes and CSS variables for dark and light theming |
| Zustand | State management | Auth state (token, user, org_id) with localStorage persistence |
| Axios | HTTP client | All API calls with automatic JWT header injection |

### Infrastructure

| Technology | Role | How it is used |
|---|---|---|
| Railway | Cloud deployment | 3 services: API (Gunicorn), Celery worker, Next.js frontend |
| GitHub Actions | CI/CD | On every push: Python syntax check, TypeScript type check, Next.js build |
| Docker | Containerisation | docker-compose.yml for local dev with all services |

---

## Production Readiness

### Scalability
- **Horizontal scaling** — Stateless API layer. Add instances behind a load balancer without coordination
- **Connection pooling** — SQLAlchemy QueuePool with 10 base + 20 overflow connections
- **Redis state** — Token blacklist and rate limiting stored in Redis, shared across all API instances
- **Worker scaling** — Celery workers scale independently from the API layer
- **Parallel agents** — Each analysis runs 3 agents simultaneously via ThreadPoolExecutor

### Security
- **Password hashing** — bcrypt with 72-byte truncation, salted per user
- **JWT blacklist** — Logout invalidates tokens immediately via Redis
- **Brute force protection** — 5 failed login attempts triggers 5-minute lockout per email
- **OTP verification** — Email verification required on registration. OTP single-use, 10-minute TTL
- **Rate limiting** — Per-IP limits on every sensitive endpoint: register 5/hr, login 20/hr, OTP 10/10min, analyze 3/day guest and 100/hr authenticated
- **Org monthly quota** — 50 analyses per month per organisation
- **Input validation** — 50k character limit, 10MB PDF limit, 1MB general payload limit
- **CORS** — Locked to frontend domain in production
- **Secret validation** — Server refuses to start in production if APP_SECRET_KEY is weak or missing

### Reliability
- **Content hash caching** — SHA256 hash deduplication with 24hr TTL. Identical content returns in ~460ms
- **Celery reliability** — task_acks_late=True, reject_on_worker_lost=True, max 50 tasks per worker
- **Graceful degradation** — Neo4j, sentence-transformers, and Redis all fail gracefully with fallbacks
- **Health check** — /health endpoint verifies DB and Redis connectivity, returns degraded status if either fails
- **Request ID tracing** — Every request gets a short UUID in X-Request-ID header for log correlation
- **Global error handler** — Unhandled exceptions return clean JSON, never raw Python tracebacks

### Observability
- **LangSmith tracing** — Every Claude API call logged with full prompt, response, latency, and token count
- **Structured logging** — All agents log claim counts, scores, fallacy counts, and timing
- **Health monitoring** — Railway auto-restarts on crash, health check path configured

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/auth/register | Send OTP to email |
| POST | /api/v1/auth/verify-otp | Verify OTP and create account |
| POST | /api/v1/auth/resend-otp | Resend OTP |
| POST | /api/v1/auth/login | Login, returns JWT |
| POST | /api/v1/auth/logout | Blacklist token |
| GET | /api/v1/auth/me | Current user info |

### Analysis
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/analyze | Synchronous full analysis |
| POST | /api/v1/analyze/async | Queue async analysis |
| GET | /api/v1/jobs/{id} | Poll async job status |
| POST | /api/v1/compare | Compare two arguments |
| GET | /api/v1/reports/{id} | Public shareable report |
| GET | /api/v1/analyses/similar | Semantic similarity search |

### Organisation
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/org/dashboard | Usage stats and recent analyses |
| GET | /api/v1/org/members | List org members |
| POST | /api/v1/org/members/invite | Invite member |
| DELETE | /api/v1/org/members/{id} | Remove member |

### Watchdog
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/watchdog/sources | Add URL to monitor |
| GET | /api/v1/watchdog/sources | List monitored sources |
| DELETE | /api/v1/watchdog/sources/{id} | Remove source |
| GET | /api/v1/watchdog/sources/{id}/alerts | Get alerts |
| POST | /api/v1/watchdog/sources/{id}/check-now | Manual check |

### Eval
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/eval/run | Run evaluation suite |
| GET | /api/v1/eval/results | Get eval results |

---

## Evaluation Suite

3 test cases covering the full scoring range:

| Test | Content | Expected Score | Result |
|---|---|---|---|
| Vaccine misinformation | Anti-vax claims with conspiracy framing | 0-30 | 17.5 |
| Climate science | Peer-reviewed consensus statements | 35-100 | 52.5 |
| Supplement marketing | Unverified health product claims | 0-35 | 20.0 |

Pass rate: 3/3 (100%)

---

## Concurrent Load Test Results

4 authenticated users simultaneously on Railway free tier:
```
User 1: HTTP 200 in 19.3s
User 2: HTTP 200 in 21.0s
User 3: HTTP 200 in 24.0s
User 4: HTTP 200 in 21.0s
```

All 4 completed within 5 seconds of each other — true parallel execution across Gunicorn workers confirmed.

---

## Local Development
```bash
# 1. Clone
git clone https://github.com/Nsk246/thinktrace.git
cd thinktrace

# 2. Backend
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. Celery worker (separate terminal)
celery -A services.celery_app.celery_app worker --loglevel=info --queues=analysis,watchdog --concurrency=2

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

See backend/.env.example — all required variables are documented with descriptions.

Required: ANTHROPIC_API_KEY, REDIS_URL, DATABASE_URL, APP_SECRET_KEY, RESEND_API_KEY

Optional but recommended: LANGCHAIN_API_KEY, PINECONE_API_KEY, NEO4J_URI, SERPER_API_KEY, NEWS_API_KEY

---

## Project Structure
```
thinktrace/
├── backend/
│   ├── agents/
│   │   ├── ingestion.py          # Content parsing, claim extraction, attribution tracking
│   │   ├── logic_mapper.py       # Argument graph with brace-counting JSON extraction
│   │   ├── fallacy_hunter.py     # Named fallacy detection with confidence scores
│   │   ├── fact_checker.py       # 5-source parallel fact checking with timeouts
│   │   ├── epistemic_scorer.py   # Context-aware 0-100 scoring
│   │   └── watchdog.py           # Autonomous URL monitoring agent
│   ├── api/
│   │   ├── routes.py             # Analysis, compare, reports, rate limiting
│   │   ├── auth.py               # JWT + OTP email verification via Resend
│   │   ├── org_routes.py         # Dashboard, members
│   │   ├── watchdog_routes.py    # Watchdog management (auth protected)
│   │   └── eval_routes.py        # Eval suite endpoints
│   ├── core/
│   │   ├── config.py             # Pydantic settings
│   │   ├── models.py             # Claim, ArgumentGraph, Fallacy, FactCheck, EpistemicScore
│   │   ├── graph.py              # LangGraph parallel orchestration
│   │   ├── database.py           # SQLAlchemy + PostgreSQL with QueuePool
│   │   └── memory.py             # Neo4j Aura knowledge graph
│   ├── services/
│   │   ├── celery_app.py         # Celery + Upstash Redis
│   │   ├── tasks.py              # Async analysis task
│   │   ├── pinecone_service.py   # Semantic embeddings, org-namespaced
│   │   └── cache_service.py      # SHA256 content hash caching (24hr TTL)
│   ├── eval/scorers.py           # 3 test cases, 100% pass rate
│   ├── main.py                   # FastAPI app, middleware, rate limiting
│   ├── gunicorn.conf.py          # Multi-worker production config
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Main analyze page
│   │   ├── about/page.tsx        # Technical documentation
│   │   ├── auth/page.tsx         # Sign in and OTP verification
│   │   ├── dashboard/page.tsx    # Org dashboard
│   │   ├── compare/page.tsx      # Argument comparison
│   │   ├── watchdog/page.tsx     # URL monitoring
│   │   ├── evals/page.tsx        # Eval suite
│   │   ├── team/page.tsx         # Team management
│   │   └── report/[id]/page.tsx  # Public shareable report
│   └── components/
│       ├── Navbar.tsx
│       ├── Logo.tsx
│       ├── ScoreBadge.tsx
│       ├── FallacyCard.tsx
│       └── FactCheckCard.tsx
├── .github/workflows/ci.yml      # GitHub Actions CI/CD
├── docker-compose.yml
└── railway.toml
```

---

## Built by

[Nandhu S Kumar](https://nandhusk.dev) · [@Nsk246](https://github.com/Nsk246)  
[View on GitHub](https://github.com/Nsk246/thinktrace) · [Live Demo](https://thinktrace.nandhusk.dev)
