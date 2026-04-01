# Railway Deployment Guide

## Step 1 — Create a Railway account
Go to railway.app and sign up with GitHub.

## Step 2 — Create a new project
Click "New Project" → "Deploy from GitHub repo" → select Nsk246/thinktrace

## Step 3 — Add services
Railway will auto-detect the repo. You need 3 services:

### Service 1: API (thinktrace-api)
- Root directory: backend
- Config file: railway.toml
- Start command: gunicorn main:app -c gunicorn.conf.py

### Service 2: Worker (thinktrace-worker)  
- Root directory: backend
- Config file: railway.worker.toml
- Start command: celery -A services.celery_app.celery_app worker --loglevel=info --queues=analysis,watchdog --concurrency=2

### Service 3: Frontend (thinktrace-frontend)
- Root directory: frontend
- Config file: railway.toml
- Start command: npm start

## Step 4 — Add PostgreSQL
Click "New" → "Database" → "PostgreSQL"
Railway creates it and gives you DATABASE_URL automatically.

## Step 5 — Add Redis
Click "New" → "Database" → "Redis"
Railway creates it and gives you REDIS_URL automatically.
Note: Use your Upstash Redis URL instead if you prefer.

## Step 6 — Set environment variables
For the API and Worker services, add these secrets:

ANTHROPIC_API_KEY=your-key
APP_SECRET_KEY=your-64-char-key
LANGCHAIN_API_KEY=your-key
PINECONE_API_KEY=your-key
NEO4J_URI=neo4j+s://aa8f5628.databases.neo4j.io
NEO4J_USER=aa8f5628
NEO4J_PASSWORD=your-password
SERPER_API_KEY=your-key
NEWS_API_KEY=your-key
RESEND_API_KEY=your-key

For the Frontend service:
NEXT_PUBLIC_API_URL=https://thinktrace-api.up.railway.app

## Step 7 — Deploy
Railway auto-deploys on every git push to main.

## Step 8 — Update CORS
After deployment, add your Railway frontend URL to the CORS allowed origins
in backend/main.py for production.
