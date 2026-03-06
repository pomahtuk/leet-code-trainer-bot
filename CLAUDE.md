# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Telegram bot for LeetCode training with gamification. Users get a problem, answer multiple-choice quiz questions about the algorithm/approach, receive hints on wrong answers, and see the Java solution on completion. Progress tracked with XP, streaks, and levels.

See `docs/DESIGN.md` for the full design document.

## Commands

```bash
npm run dev          # Start bot locally with hot reload (polling mode)
npm run build        # TypeScript compile to dist/
npm start            # Run compiled bot (production)
npm run generate     # Run content generation pipeline
npx tsc --noEmit     # Type-check without emitting
```

## Architecture

- **TypeScript + grammY** — Telegram bot framework
- **Supabase (PostgreSQL)** — User data, attempts, stats. Tables prefixed `lc_`
- **YAML problem data** — `data/problems/*.yaml`, loaded at startup

### Key paths

- `src/bot/` — Bot entry point, command handlers, callback handlers
- `src/db/` — Supabase client, queries, SQL migrations
- `src/problems/loader.ts` — Loads and filters YAML problem data
- `src/gamification/xp.ts` — XP, levels, streak logic
- `src/types.ts` — Shared TypeScript types (Problem, QuizQuestion, etc.)
- `data/problems/` — Curated problem YAML files
- `scripts/generate.ts` — Content generation pipeline (LLM-based)

### Bot flow

1. `/problem` → pick random problem matching user filters → show statement
2. Send quiz question as inline keyboard buttons
3. Callback `ans:{problemId}:{quizIndex}:{selected}` → check answer
4. Wrong → hint + re-ask. Right → next quiz question or show solution
5. Session state in `lc_sessions` table, cleaned up on completion/skip

### Environment variables

`TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` (required). API keys for content generation are optional.
