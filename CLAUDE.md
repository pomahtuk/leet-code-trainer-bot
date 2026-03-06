# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Telegram bot for LeetCode training with gamification. Quiz-based problem practice with XP, streaks, and levels. See [docs/DESIGN.md](docs/DESIGN.md) for architecture, data model, and deployment details.

## Commands

```bash
npm run dev              # Bot with hot reload (polling mode)
npm run build            # TypeScript compile
npm start                # Run compiled bot
npm run generate         # Content generation pipeline
npm run fetch-problems   # Fetch from LeetCode GraphQL API
npx tsc --noEmit         # Type-check
```

## Key paths

- `src/bot/` — Entry point (Fastify webhook / polling), commands, callback handlers
- `src/db/` — Supabase client, queries, migrations. Tables prefixed `lc_`
- `src/problems/loader.ts` — Problem queries from Supabase (GIN-indexed arrays)
- `src/gamification/xp.ts` — XP levels, streak formatting
- `scripts/generate.ts` — LLM content pipeline (Gemini generator + judge → Supabase)

## Environment

`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` required. `WEBHOOK_URL` + `PORT` for production. `GOOGLE_AI_API_KEY` for content generation.
