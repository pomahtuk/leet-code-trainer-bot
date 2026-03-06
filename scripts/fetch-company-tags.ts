import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { parse, stringify } from "yaml";

const ROOT = dirname(import.meta.dirname);

// snehasishroy/leetcode-companywise-interview-questions — Feb 2026 data
const REPO_API =
  "https://api.github.com/repos/snehasishroy/leetcode-companywise-interview-questions/contents";
const RAW_BASE =
  "https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master";

// We use "all.csv" per company to get maximum coverage.
// Timeframe files (thirty-days, three-months, six-months) are available
// for recency weighting if needed later.
const CSV_FILE = "all.csv";

interface GHEntry {
  name: string;
  type: string;
}

interface ProblemInput {
  leetcode_id: number;
  title: string;
  slug: string;
  difficulty: string;
  topics: string[];
  companies: string[];
  statement: string;
}

function slugFromUrl(url: string): string {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : "";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // 1. Get list of company directories
  console.log("Fetching company list from snehasishroy dataset (Feb 2026)...");
  const res = await fetch(REPO_API, {
    headers: { "User-Agent": "leetcode-training-bot" },
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  const entries: GHEntry[] = await res.json();
  const companies = entries
    .filter((e) => e.type === "dir")
    .map((e) => e.name);
  console.log(`Found ${companies.length} companies\n`);

  // 2. Download all.csv per company and build slug → company[] map
  const slugToCompanies = new Map<string, Set<string>>();
  let processed = 0;
  let failed = 0;

  for (const company of companies) {
    const url = `${RAW_BASE}/${encodeURIComponent(company)}/${CSV_FILE}`;
    const csvRes = await fetch(url);
    if (!csvRes.ok) {
      failed++;
      continue;
    }

    const csv = await csvRes.text();
    // Header: ID,URL,Title,Difficulty,Acceptance %,Frequency %
    const lines = csv.split("\n").slice(1);

    for (const line of lines) {
      if (!line.trim()) continue;
      // Parse: ID,URL,...
      const cols = line.split(",");
      if (cols.length < 2) continue;
      const slug = slugFromUrl(cols[1]);
      if (!slug) continue;

      if (!slugToCompanies.has(slug)) slugToCompanies.set(slug, new Set());
      slugToCompanies.get(slug)!.add(company);
    }

    processed++;
    if (processed % 50 === 0)
      console.log(`  Processed ${processed}/${companies.length} companies`);

    // Rate limit for raw.githubusercontent.com
    if (processed % 20 === 0) await sleep(300);
  }

  console.log(
    `\nProcessed ${processed} companies (${failed} failed)`,
  );
  console.log(
    `Built company tags for ${slugToCompanies.size} unique problems`,
  );

  // 3. Save raw mapping as JSON
  const mapPath = join(ROOT, "data/company-tags.json");
  const mapObj: Record<string, string[]> = {};
  for (const [slug, cos] of slugToCompanies) {
    mapObj[slug] = [...cos].sort();
  }
  writeFileSync(mapPath, JSON.stringify(mapObj, null, 2));
  console.log(`Saved raw mapping to ${mapPath}`);

  // 4. Enrich problems-input.yaml if it exists
  const inputPath = join(ROOT, "scripts/problems-input.yaml");
  if (existsSync(inputPath)) {
    const raw = readFileSync(inputPath, "utf-8");
    const problems: ProblemInput[] = parse(raw);
    let enriched = 0;

    for (const p of problems) {
      const slug = p.slug;
      if (slug && slugToCompanies.has(slug)) {
        p.companies = [...slugToCompanies.get(slug)!].sort();
        enriched++;
      }
    }

    writeFileSync(inputPath, stringify(problems, { lineWidth: 120 }));
    console.log(
      `Enriched ${enriched}/${problems.length} problems in problems-input.yaml`,
    );
  } else {
    console.log(
      "No problems-input.yaml found. Run fetch-problems first, then re-run this.",
    );
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
