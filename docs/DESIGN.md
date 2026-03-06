# LeetCode Training Bot — Design Document

## 1. Product Overview

A Telegram bot that helps users practice LeetCode-style problem recognition and solution patterns. Instead of writing full code, users identify the correct algorithm/approach and receive pseudocode/Java solutions.

### Core Loop
1. User requests a problem (optionally filtered by company/difficulty/topic)
2. Bot presents the problem statement + multiple-choice options (algorithm/data structure to use, edge cases, time complexity)
3. On correct answer → bot shows pseudocode/Java implementation with key insights
4. On incorrect answer → bot gives a hint, user retries
5. Progress is tracked, gamification rewards consistency

---

## 2. Key Questions & Decisions

### 2.1 Problem Data Source

**Option A: Static curated dataset (JSON/YAML files in repo)**
- Pros: Full control over content, no API dependency, can version-control
- Cons: Manual curation effort, limited scale

**Option B: LeetCode API (unofficial) + curated metadata overlay**
- Pros: Access to all problems, auto-updated
- Cons: Unofficial API may break, rate limits, TOS concerns

**Option C: Hybrid — curated problem list with metadata, link to LeetCode for full statement**
- Pros: Balanced effort, users still practice on LeetCode
- Cons: Requires maintaining mapping

**Decision:** Start with **Option A** — a curated dataset of ~200 problems covering the most common interview patterns. Each problem entry includes our own quiz questions and solution explanations. Scale later.

**Content generation pipeline:** Use LLM to draft quiz questions and solutions using LeetCode problem descriptions and discussion/solution sections as reference. Cross-validate output with a second LLM before committing to the dataset.

### 2.2 Problem Data Schema

```yaml
problem:
  id: 1                          # internal ID
  leetcode_id: 121               # LeetCode problem number
  title: "Best Time to Buy and Sell Stock"
  difficulty: easy | medium | hard
  companies: [amazon, google, meta]  # tagged companies
  topics: [array, dynamic_programming, greedy]
  statement: "Given an array prices..."  # short version or link

  quiz:
    - question: "What algorithm pattern best solves this?"
      options:
        - "Sliding window"
        - "Kadane's algorithm variant (track min so far)"  # correct
        - "Two pointers from both ends"
        - "Sort and pick extremes"
      correct: 1  # 0-indexed
      hint: "Think about tracking the minimum price seen so far as you scan left to right."

    - question: "What is the optimal time complexity?"
      options:
        - "O(n log n)"
        - "O(n²)"
        - "O(n)"  # correct
        - "O(n · k)"
      correct: 2
      hint: "You only need a single pass through the array."

  solution:
    explanation: |
      Track minimum price seen so far. At each step,
      calculate profit if selling today. Keep global max profit.
    pseudocode: |
      minPrice = infinity
      maxProfit = 0
      for price in prices:
        minPrice = min(minPrice, price)
        maxProfit = max(maxProfit, price - minPrice)
      return maxProfit
    java: |
      public int maxProfit(int[] prices) {
          int minPrice = Integer.MAX_VALUE, maxProfit = 0;
          for (int price : prices) {
              minPrice = Math.min(minPrice, price);
              maxProfit = Math.max(maxProfit, price - minPrice);
          }
          return maxProfit;
      }
    javascript: |  # secondary language
      var maxProfit = function(prices) {
          let minPrice = Infinity, maxProfit = 0;
          for (const price of prices) {
              minPrice = Math.min(minPrice, price);
              maxProfit = Math.max(maxProfit, price - minPrice);
          }
          return maxProfit;
      };
```

### 2.3 User Progress & State Storage

**Option A: SQLite (single file, embedded)**
- Pros: Zero infra, easy backup, SQL queries for analytics
- Cons: Single-server only

**Option B: PostgreSQL (e.g., Supabase free tier)**
- Pros: Scales, concurrent access, hosted backups
- Cons: External dependency, more setup

**Option C: Redis + JSON files**
- Pros: Fast session state
- Cons: Volatile, not great for persistent history

**Decision:** **PostgreSQL via Supabase** — using existing Supabase project ("testify"). Tables will live alongside existing data in that project.

#### User State Schema (Postgres)

```sql
CREATE TABLE lc_users (
  telegram_id  BIGINT PRIMARY KEY,
  username     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  settings     JSONB DEFAULT '{}'  -- preferred difficulty, companies, etc.
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

CREATE TABLE lc_user_stats (
  telegram_id    BIGINT PRIMARY KEY REFERENCES lc_users(telegram_id),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_correct  INT DEFAULT 0,
  total_attempts INT DEFAULT 0,
  xp             INT DEFAULT 0,
  last_active    DATE
);
```

### 2.4 Conversation Flow

```
/start → Welcome + set preferences (difficulty, topics, companies)
/problem → Get a random problem matching preferences
/stats → View personal stats (streak, accuracy, XP)
/settings → Change difficulty/topic/company filters
/hint → Get hint for current question (costs XP or just free)
```

#### Problem Flow Detail

```
User: /problem
Bot:  📝 *Best Time to Buy and Sell Stock* (Easy)
      Companies: Amazon, Google, Meta

      Given an array `prices` where prices[i] is the price on day i,
      find the maximum profit from one buy-sell transaction.

      ❓ What algorithm pattern best solves this?

      1️⃣ Sliding window
      2️⃣ Kadane's algorithm variant (track min so far)
      3️⃣ Two pointers from both ends
      4️⃣ Sort and pick extremes

User: [taps inline button "1"]
Bot:  ❌ Not quite.
      💡 Hint: Think about tracking the minimum price seen
      so far as you scan left to right.

      Try again:
      1️⃣ Sliding window
      2️⃣ Kadane's algorithm variant (track min so far)
      3️⃣ Two pointers from both ends
      4️⃣ Sort and pick extremes

User: [taps "2"]
Bot:  ✅ Correct!

      Next question:
      ❓ What is the optimal time complexity?
      ...

[After all quiz questions answered]
Bot:  🎯 Solution:
      Track minimum price seen so far. At each step,
      calculate profit if selling today.

      ```java
      public int maxProfit(int[] prices) {
          int minPrice = Integer.MAX_VALUE, maxProfit = 0;
          for (int price : prices) {
              minPrice = Math.min(minPrice, price);
              maxProfit = Math.max(maxProfit, price - minPrice);
          }
          return maxProfit;
      }
      ```

      🔥 Streak: 5 days | ⭐ +20 XP (150 total)

      /problem for another one!
```

### 2.5 Gamification

| Mechanic | Description |
|----------|-------------|
| **XP** | Earned per correct answer. Bonus for first-try correct. |
| **Streaks** | Daily streak counter. Bonus XP for milestones (7, 30, 100 days). |
| **Accuracy** | Track per-topic accuracy to surface weak areas. |
| **Levels** | XP thresholds unlock titles (e.g., "Array Apprentice" → "Graph Master"). |
| **Daily challenge** | One featured problem per day, bonus XP for completing it. |

### 2.6 Filtering & Personalization

Users can configure via `/settings`:
- **Difficulty**: easy, medium, hard (multi-select)
- **Companies**: filter by company tags
- **Topics**: arrays, trees, graphs, DP, etc.
- **Exclude solved**: toggle to skip already-completed problems

Bot uses these filters when selecting random problems via `/problem`.

---

## 3. Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript (Node.js) | Good Telegram bot libs, fast dev |
| Bot framework | grammY | Modern, well-maintained, good TS support |
| Database | PostgreSQL (Supabase) | Existing "testify" project, managed, SQL |
| Problem data | YAML files in repo | Version-controlled, easy to edit/review |
| Solution languages | Java (primary), JavaScript (secondary) | User's strongest languages |
| Hosting | Own server, Docker | Full control, no vendor dependency |
| Bot mode | Webhook (production) / Polling (dev) | Webhook more efficient for production |
| Content pipeline | LLM-generated, cross-validated | Draft with one LLM using LC discussions as reference, validate with another |

---

## 4. Project Structure (Proposed)

```
leetcode-training/
├── docs/
│   └── DESIGN.md              # this file
├── data/
│   ├── problems/               # approved quiz YAML files
│   │   ├── arrays.yaml
│   │   ├── trees.yaml
│   │   └── ...
│   └── flagged/                # judge-flagged, needs human review
├── scripts/
│   ├── generate.ts             # content generation CLI
│   └── generate-config.yaml    # model/input configuration
├── src/
│   ├── bot/
│   │   ├── index.ts            # bot entry point
│   │   ├── commands/           # /start, /problem, /stats, /settings
│   │   └── handlers/           # inline button callbacks
│   ├── db/
│   │   ├── client.ts           # Supabase/pg client
│   │   ├── migrations/         # SQL migrations
│   │   └── queries.ts          # DB query functions
│   ├── problems/
│   │   └── loader.ts           # load & filter YAML problem data
│   └── gamification/
│       └── xp.ts               # XP/streak/level logic
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example              # TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY
└── CLAUDE.md
```

---

## 5. MVP Scope

Phase 1 — get it working:
- [ ] Problem data: curate 20-30 problems across 5 topics
- [ ] Bot commands: `/start`, `/problem`, `/stats`
- [ ] Quiz flow with inline buttons, hints, solution reveal
- [ ] Basic XP and streak tracking
- [ ] Filter by difficulty

Phase 2 — expand:
- [ ] Company filtering
- [ ] Topic filtering
- [ ] More problems (target 100+)
- [ ] Daily challenge
- [ ] Leaderboard (optional, multi-user)

Phase 3 — polish:
- [ ] Spaced repetition (resurface problems user got wrong)
- [ ] Weakness analysis ("You struggle with graph problems")
- [ ] Problem difficulty auto-adjustment based on user performance

---

## 6. Resolved Decisions

| Question | Decision |
|----------|----------|
| Problem curation | LLM-generated using LC problem + discussions as reference, cross-validated with second LLM, human review before merge |
| Solution languages | Java (primary) + JavaScript (secondary) |
| Hosting | Own server, Dockerized |
| Database | Existing Supabase project "testify" |
| Rate limiting | Unlimited for now |
| Session timeout | Persist quiz state in DB, resume on next `/problem` |
| Table naming | Prefix with `lc_` (e.g., `lc_users`, `lc_attempts`, `lc_user_stats`) — existing testify tables can be dropped |
| Long messages | Keep solutions concise (key lines only). If still over 4096 chars, split into multiple messages |
| Secrets | Runtime env vars via Coolify in production. `.env` file for local dev. No secrets baked into Docker image |

## 7. Content Generation Pipeline

A CLI tool (`scripts/generate.ts`) that produces and validates problem YAML files. Run once per batch, re-run to regenerate flagged problems.

### Pipeline Steps

```
1. INPUT        → Problem list (LC IDs or topic+difficulty filter)
2. GENERATE     → Generator LLM creates quiz YAML from problem + discussions
3. JUDGE        → Judge LLM reviews output, flags issues
4. OUTPUT       → Clean YAML → data/problems/   |   Flagged → data/flagged/
```

### Step 2: Generate

The generator receives a prompt with:
- LeetCode problem statement (scraped or pasted)
- Top discussion solutions / editorial as reference
- Output schema (the YAML format from section 2.2)

It produces: quiz questions (algorithm choice, complexity, edge cases), hints, solution explanation, Java + JS code.

### Step 3: Judge

The judge LLM receives the generated YAML and checks for:
- **Correctness** — Is the marked correct answer actually correct? Does the code work?
- **Distractor quality** — Are wrong options plausible but clearly wrong? (not trick questions, not obviously absurd)
- **Hint quality** — Does the hint guide without giving away the answer?
- **Consistency** — Does the explanation match the code? Do complexity claims match the algorithm?

Judge outputs a verdict per problem: `pass` | `flag` with reasons.

### Configuration (`scripts/generate-config.yaml`)

```yaml
generator:
  model: "haiku"               # cheap/fast model for bulk generation
  provider: "anthropic"         # anthropic | google | openai
  temperature: 0.7

judge:
  model: "claude-sonnet-4-6"         # stronger model for validation
  provider: "anthropic"
  temperature: 0.3

# Which problems to process
input:
  mode: "list"                  # "list" | "range" | "topic"
  leetcode_ids: [1, 15, 121, 200, 206]  # explicit list
  # range: { from: 1, to: 50 }
  # topic: { name: "arrays", difficulty: "medium" }

# Re-run options
regenerate:
  flagged_only: true            # only redo problems the judge flagged
  max_retries: 2                # retry flagged problems N times before manual review

output:
  problems_dir: "data/problems"
  flagged_dir: "data/flagged"   # flagged problems land here for human review
```

### CLI Usage

```bash
# Generate quiz data for a list of problems
npx tsx scripts/generate.ts

# Re-run only flagged problems with a different generator
npx tsx scripts/generate.ts --flagged-only --generator-model gemini-flash

# Override judge model
npx tsx scripts/generate.ts --judge-model claude-opus-4-6

# Dry run — print generated YAML to stdout, don't write files
npx tsx scripts/generate.ts --dry-run
```

### Swappable Models

The pipeline abstracts the LLM call behind a simple interface so models are trivially swappable:

```typescript
interface LLMProvider {
  generate(prompt: string, model: string): Promise<string>;
}
```

Implementations for Anthropic, Google (Gemini), and OpenAI. Provider + model configured in YAML or CLI flags.

## 8. Open Questions

(none — all resolved)
