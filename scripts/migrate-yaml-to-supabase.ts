import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { parse } from "yaml";
import { createClient } from "@supabase/supabase-js";

const ROOT = dirname(import.meta.dirname);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// Load the input YAML to get slug/companies/topics per leetcode_id
const inputRaw = readFileSync(join(ROOT, "scripts/problems-input.yaml"), "utf-8");
const inputProblems: Record<number, { slug: string; companies: string[]; topics: string[] }> = {};
for (const p of parse(inputRaw) as any[]) {
  inputProblems[p.leetcode_id] = {
    slug: p.slug ?? "",
    companies: p.companies ?? [],
    topics: p.topics ?? [],
  };
}

async function run() {
  const dir = join(ROOT, "data/problems");
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  let migrated = 0;

  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    const problems = parse(content);
    if (!Array.isArray(problems)) continue;

    for (const p of problems) {
      const input = inputProblems[p.leetcode_id];
      const { error } = await supabase.from("lc_problems").upsert({
        leetcode_id: p.leetcode_id,
        title: p.title,
        slug: input?.slug ?? p.titleSlug ?? null,
        difficulty: p.difficulty,
        companies: input?.companies ?? p.companies ?? [],
        topics: input?.topics ?? p.topics ?? [],
        statement: p.statement,
        quiz: p.quiz,
        solution: p.solution,
      }, { onConflict: "leetcode_id" });

      if (error) {
        console.log(`  Failed LC #${p.leetcode_id}: ${error.message}`);
      } else {
        migrated++;
      }
    }
  }

  console.log(`Migrated ${migrated} problems to Supabase.`);
}

run().catch(console.error);
