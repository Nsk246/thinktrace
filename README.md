# ThinkTrace

Enterprise multi-tenant AI reasoning audit platform. Four specialist agents analyze any argument in parallel — mapping logic, detecting fallacies, verifying facts against live sources, and scoring reasoning quality.

## Architecture
```
Parser → Mapper ─┐
                 ├→ Epistemic Scorer → Report
Detector ────────┤
Verifier ────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Claude API (Anthropic) |
| Orchestration | LangGraph + LangChain |
| Fact checking | Serper, Wikipedia, ArXiv, PubMed, NewsAPI |
| Backend | FastAPI + SQLAlchemy |
| Queue | Celery + Upstash Redis |
| Vector DB | Pinecone |
| Graph DB | Neo4j Aura |
| Frontend | Next.js 14 + TypeScript |
| Auth | JWT + bcrypt |
| Infra | Docker + GitHub Actions + Render |

## Quick Start
```bash
# Backend
cd backend
cp .env.example .env  # fill in your keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Celery worker
celery -A services.celery_app.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

See `backend/.env.example` for all required variables.

## API Documentation

Available at `/api/docs` in development mode.

## Deployment

See `render.yaml` for one-click Render deployment.

## Eval Suite
```bash
curl -X POST http://localhost:8000/api/v1/eval/run
```

3/3 test cases passing at 100% — verified epistemic scoring calibration.

## Built by

[@Nsk246](https://github.com/Nsk246)
