# LeetCode Training Bot — Design Document

## 1. Product Overview

A Telegram bot that helps users practice LeetCode-style problem recognition and solution patterns. Instead of writing full code, users identify the correct algorithm/approach and receive Java solutions.

### Core Loop
1. User requests a problem (optionally filtered by company/difficulty/topic)
2. Bot presents the problem statement + multiple-choice quiz (algorithm/data structure, edge cases, time complexity)
3. Correct answer → next question or solution reveal
4. Incorrect answer → hint, retry
5. Progress tracked with XP, streaks, and levels

---

## 2. Data Model

### Problem Schema (Supabase `lc_problems`)

```sql
CREATE TABLE lc_problems (
  id           SERIAL PRIMARY KEY,
  leetcode_id  INT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  slug         TEXT,
  difficulty   TEXT NOT NULL,          -- 'easy' | 'medium'
  companies    TEXT[] DEFAULT '{}',    -- GIN-indexed
  topics       TEXT[] DEFAULT '{}',    -- GIN-indexed
  statement    TEXT,
  quiz         JSONB NOT NULL,         -- array of {question, options, correct, hint}
  solution     JSONB NOT NULL          -- {explanation, pseudocode, java}
);
```

### User Tables

```sql
CREATE TABLE lc_users (
  telegram_id  BIGINT PRIMARY KEY,
  username     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  settings     JSONB DEFAULT '{}'
);

CREATE TABLE lc_user_stats (
  telegram_id    BIGINT PRIMARY KEY REFERENCES lc_users(telegram_id),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_correct  INT DEFAULT 0,
  total_attempts INT DEFAULT 0,
  xp             INT DEFAULT 0,
  last_active    DATE
);

CREATE TABLE lc_attempts (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT REFERENCES lc_users(telegram_id),
  problem_id   INT NOT NULL,
  quiz_index   INT NOT NULL,
  selected     INT NOT NULL,
  correct      BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lc_sessions (
  telegram_id  BIGINT PRIMARY KEY REFERENCES lc_users(telegram_id),
  problem_id   INT NOT NULL,
  quiz_index   INT DEFAULT 0
);
```

---

## 3. Gamification

| Mechanic | Details |
|----------|---------|
| **XP** | +10 per problem completed (all quiz questions answered) |
| **Streaks** | Daily streak — increments once per day on first problem completion. Resets if a day is missed |
| **Levels** | Beginner (0) → Apprentice (50) → Practitioner (150) → Skilled (400) → Expert (800) → Master (1500) → Grandmaster (3000) |
| **Accuracy** | Tracked as total_correct / total_attempts across all quiz answers |

---

## 4. Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message, create user record |
| `/problem` | Get a random problem matching filters |
| `/stats` | View XP, streak, accuracy, level |
| `/skip` | Abandon current problem |

---

## 5. Content Generation Pipeline

CLI tool (`scripts/generate.ts`) that produces quiz content using two LLMs:

1. **Generator** (Gemini 3 Flash Preview) — drafts quiz YAML from problem statement
2. **Judge** (Gemini 2.5 Pro) — validates correctness, distractor quality, hint quality, code consistency
3. Passed problems saved directly to Supabase `lc_problems` table
4. Failed problems retried up to 2 times, then skipped

Problem metadata sourced from:
- LeetCode GraphQL API (`scripts/fetch-problems.ts`) — 2367 easy+medium problems with statements
- Company tags from snehasishroy/leetcode-companywise-interview-questions (`scripts/fetch-company-tags.ts`) — 662 companies, 3310 problems

Config in `scripts/generate-config.yaml`. Supports `--company`, `--difficulty`, `--dry-run`, `--flagged-only` flags.

---

## 6. Tech Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript (Node.js 24) |
| Bot framework | grammY |
| HTTP server | Fastify (webhook mode) |
| Database | PostgreSQL (Supabase) |
| Problem storage | Supabase `lc_problems` table |
| Content generation | Google Gemini (generator + judge) |
| Hosting | Docker on own server via Coolify |
| DNS | Cloudflare |
| Bot mode | Webhook (production) / Polling (dev) |

---

## 7. Deployment

- Multi-stage Docker build (`node:24-alpine`)
- Healthcheck: `GET /health` on port 3000
- Coolify handles blue/green deploys
- Env vars: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `WEBHOOK_URL`, `PORT`
