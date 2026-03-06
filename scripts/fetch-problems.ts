import "dotenv/config";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { stringify } from "yaml";

const ROOT = dirname(import.meta.dirname);
const GRAPHQL_URL = "https://leetcode.com/graphql";
const BATCH_SIZE = 100;
const DELAY_MS = 1500; // be nice to LC servers

interface LCQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "EASY" | "MEDIUM";
  paidOnly: boolean;
  topicTags: { name: string; slug: string }[];
}

interface ProblemInput {
  leetcode_id: number;
  title: string;
  slug: string;
  difficulty: string;
  topics: string[];
  companies: string[]; // empty for now — LC requires auth
  statement: string;
}

// --- Fetch problem list ---

async function fetchBatch(
  skip: number,
  limit: number,
): Promise<{ questions: LCQuestion[]; totalLength: number; hasMore: boolean }> {
  const query = `{
    problemsetQuestionListV2(
      categorySlug: ""
      limit: ${limit}
      skip: ${skip}
      filters: {
        filterCombineType: ALL
        difficultyFilter: { difficulties: [EASY, MEDIUM] }
        premiumFilter: { premiumStatus: [NOT_PREMIUM] }
      }
    ) {
      totalLength
      hasMore
      questions {
        questionFrontendId
        title
        titleSlug
        difficulty
        paidOnly
        topicTags { name slug }
      }
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.problemsetQuestionListV2;
}

// --- Fetch problem statement ---

async function fetchStatement(titleSlug: string): Promise<string> {
  const query = `{
    question(titleSlug: "${titleSlug}") {
      content
    }
  }`;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) return "";
  const json = await res.json();
  const html: string = json.data?.question?.content ?? "";

  // Strip HTML to plain text (rough but sufficient for LLM consumption)
  return html
    .replace(/<pre>[^]*?<\/pre>/g, (m) => m.replace(/<[^>]+>/g, ""))
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--no-statements") flags.noStatements = true;
    if (args[i] === "--limit" && args[i + 1]) flags.limit = args[++i];
  }
  return flags;
}

// --- Main ---

async function run() {
  const flags = parseArgs();
  const maxProblems = flags.limit ? parseInt(flags.limit as string) : Infinity;
  const fetchStatements = !flags.noStatements;

  console.log("Fetching easy + medium free problems from LeetCode...\n");

  const allQuestions: LCQuestion[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore && allQuestions.length < maxProblems) {
    const batch = await fetchBatch(skip, BATCH_SIZE);
    allQuestions.push(...batch.questions);
    hasMore = batch.hasMore;
    skip += BATCH_SIZE;
    console.log(`  Fetched ${allQuestions.length} / ${batch.totalLength}`);
    if (hasMore) await sleep(DELAY_MS);
  }

  // Trim to limit
  const questions = allQuestions.slice(0, maxProblems);
  console.log(`\nTotal: ${questions.length} problems`);

  // Convert to our input format
  const problems: ProblemInput[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    let statement = "";
    if (fetchStatements) {
      if (i > 0 && i % 10 === 0)
        console.log(`  Fetching statements... ${i}/${questions.length}`);
      statement = await fetchStatement(q.titleSlug);
      await sleep(500); // lighter delay for individual fetches
    }

    problems.push({
      leetcode_id: parseInt(q.questionFrontendId),
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty.toLowerCase(),
      topics: q.topicTags.map((t) => t.slug),
      companies: [], // requires LC premium auth
      statement: statement || `See https://leetcode.com/problems/${q.titleSlug}/`,
    });
  }

  const outPath = join(ROOT, "scripts/problems-input.yaml");
  writeFileSync(outPath, stringify(problems, { lineWidth: 120 }));
  console.log(`\nWritten to ${outPath}`);
  console.log(
    "Note: company tags require LC premium. Add them manually or from external sources.",
  );
}

run().catch((err) => {
  console.error("Fetch error:", err);
  process.exit(1);
});
