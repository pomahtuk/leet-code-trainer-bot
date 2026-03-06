# LeetCode Training Bot

Telegram bot for practicing LeetCode problem recognition. Answer quiz questions about algorithms and approaches, get hints on wrong answers, see Java solutions on success. Gamified with XP, streaks, and levels.

## Setup

```bash
npm install
cp .env.example .env  # fill in TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY
npm run dev            # starts in polling mode
```

## Production

Dockerized, deployed via Coolify with webhook mode.

```bash
docker build -t leetcode-bot .
docker run -e TELEGRAM_BOT_TOKEN=... -e SUPABASE_URL=... -e SUPABASE_KEY=... -e WEBHOOK_URL=https://your-domain.com -p 3000:3000 leetcode-bot
```

See [docs/DESIGN.md](docs/DESIGN.md) for architecture, data model, and gamification details.

## Content Generation

Quiz content is generated with LLMs (generator + judge) and stored in Supabase.

```bash
npm run generate -- --company meta        # generate Meta problems
npm run generate -- --difficulty easy      # filter by difficulty
npm run generate -- --dry-run              # preview without saving
```
