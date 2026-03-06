import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { parse, stringify } from "yaml";
import { createClient } from "@supabase/supabase-js";
import { llmGenerate, type LLMConfig } from "./llm.js";
import { generatorPrompt, judgePrompt } from "./prompts.js";

const ROOT = dirname(import.meta.dirname);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
);

// --- Types ---

interface ProblemInput {
  leetcode_id: number;
  title: string;
  slug?: string;
  difficulty: string;
  topics: string[];
  companies: string[];
  statement: string;
}

interface Config {
  generator: LLMConfig;
  judge: LLMConfig;
  regenerate: { flagged_only: boolean; max_retries: number };
  output: { flagged_dir: string };
}

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--flagged-only") {
      flags.flaggedOnly = true;
    } else if (arg === "--generator-model" && args[i + 1]) {
      flags.generatorModel = args[++i];
    } else if (arg === "--generator-provider" && args[i + 1]) {
      flags.generatorProvider = args[++i];
    } else if (arg === "--judge-model" && args[i + 1]) {
      flags.judgeModel = args[++i];
    } else if (arg === "--judge-provider" && args[i + 1]) {
      flags.judgeProvider = args[++i];
    } else if (arg === "--difficulty" && args[i + 1]) {
      flags.difficulty = args[++i];
    } else if (arg === "--skip" && args[i + 1]) {
      flags.skip = args[++i];
    } else if (arg === "--company" && args[i + 1]) {
      flags.company = args[++i];
    }
  }
  return flags;
}

// --- Load config ---

function loadConfig(flags: Record<string, string | boolean>): Config {
  const raw = readFileSync(join(ROOT, "scripts/generate-config.yaml"), "utf-8");
  const config = parse(raw) as Config;

  if (typeof flags.generatorModel === "string") config.generator.model = flags.generatorModel;
  if (typeof flags.generatorProvider === "string")
    config.generator.provider = flags.generatorProvider as LLMConfig["provider"];
  if (typeof flags.judgeModel === "string") config.judge.model = flags.judgeModel;
  if (typeof flags.judgeProvider === "string")
    config.judge.provider = flags.judgeProvider as LLMConfig["provider"];
  if (flags.flaggedOnly) config.regenerate.flagged_only = true;

  return config;
}

// --- Load inputs ---

function loadInputProblems(config: Config): ProblemInput[] {
  if (config.regenerate.flagged_only) {
    const flaggedDir = join(ROOT, config.output.flagged_dir);
    if (!existsSync(flaggedDir)) return [];
    const files = readdirSync(flaggedDir).filter((f) => f.endsWith(".yaml"));
    const problems: ProblemInput[] = [];
    for (const file of files) {
      const content = readFileSync(join(flaggedDir, file), "utf-8");
      const parsed = parse(content);
      if (parsed) {
        problems.push({
          leetcode_id: parsed.leetcode_id,
          title: parsed.title,
          difficulty: parsed.difficulty,
          topics: parsed.topics,
          companies: parsed.companies,
          statement: parsed.statement,
        });
      }
    }
    return problems;
  }

  return parse(
    readFileSync(join(ROOT, "scripts/problems-input.yaml"), "utf-8"),
  ) as ProblemInput[];
}

// --- Supabase helpers ---

async function getExistingLeetcodeIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase
      .from("lc_problems")
      .select("leetcode_id")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const row of data) ids.add(row.leetcode_id);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function saveProblem(input: ProblemInput, parsed: Record<string, unknown>) {
  const { error } = await supabase.from("lc_problems").upsert({
    leetcode_id: input.leetcode_id,
    title: input.title,
    slug: input.slug ?? null,
    difficulty: input.difficulty,
    companies: input.companies ?? [],
    topics: input.topics ?? [],
    statement: input.statement,
    quiz: parsed.quiz,
    solution: parsed.solution,
  }, { onConflict: "leetcode_id" });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// --- Pipeline ---

async function generateProblem(
  config: Config,
  input: ProblemInput,
): Promise<string> {
  const prompt = generatorPrompt(
    input.leetcode_id,
    input.title,
    input.difficulty,
    input.statement,
    input.topics,
    input.companies,
  );
  return llmGenerate(config.generator, prompt);
}

async function judgeProblem(
  config: Config,
  yaml: string,
): Promise<{ pass: boolean; reason?: string }> {
  const prompt = judgePrompt(yaml);
  const response = (await llmGenerate(config.judge, prompt)).trim();
  if (response.startsWith("PASS")) {
    return { pass: true };
  }
  const reason = response.replace(/^FLAG:\s*/, "");
  return { pass: false, reason };
}

function cleanYaml(raw: string): string {
  return raw.replace(/^```ya?ml?\n?/m, "").replace(/\n?```\s*$/m, "").trim();
}

async function run() {
  const flags = parseArgs();
  const config = loadConfig(flags);
  let inputs = loadInputProblems(config);
  const dryRun = !!flags.dryRun;

  // Filter by difficulty
  if (typeof flags.difficulty === "string") {
    inputs = inputs.filter((p) => p.difficulty === flags.difficulty);
  }

  // Filter by company
  if (typeof flags.company === "string") {
    const company = flags.company.toLowerCase();
    inputs = inputs.filter((p) => p.companies?.some((c) => c.toLowerCase() === company));
  }

  // Skip N problems (for resuming)
  if (typeof flags.skip === "string") {
    inputs = inputs.slice(parseInt(flags.skip));
  }

  if (inputs.length === 0) {
    console.log("No problems to process.");
    return;
  }

  // Skip already-generated problems (check Supabase)
  if (!dryRun) {
    console.log("Checking existing problems in Supabase...");
    const existingIds = await getExistingLeetcodeIds();
    const before = inputs.length;
    inputs = inputs.filter((p) => !existingIds.has(p.leetcode_id));
    if (before !== inputs.length) {
      console.log(`Skipping ${before - inputs.length} already-generated problems.`);
    }
  }

  const flaggedDir = join(ROOT, config.output.flagged_dir);
  mkdirSync(flaggedDir, { recursive: true });

  console.log(`Processing ${inputs.length} problems...`);
  console.log(`Generator: ${config.generator.provider}/${config.generator.model}`);
  console.log(`Judge: ${config.judge.provider}/${config.judge.model}\n`);

  let passedCount = 0;
  let flaggedCount = 0;
  let errors = 0;

  for (let idx = 0; idx < inputs.length; idx++) {
    const input = inputs[idx];
    console.log(`[${idx + 1}/${inputs.length}] LC #${input.leetcode_id}: ${input.title}`);

    try {
      let yaml: string | null = null;
      let verdict: { pass: boolean; reason?: string } = { pass: false, reason: "not generated" };

      for (let attempt = 0; attempt <= config.regenerate.max_retries; attempt++) {
        if (attempt > 0) console.log(`  Retry ${attempt}/${config.regenerate.max_retries}...`);

        console.log("  Generating...");
        const raw = await generateProblem(config, input);
        yaml = cleanYaml(raw);

        if (dryRun) {
          console.log("\n" + yaml + "\n");
          break;
        }

        console.log("  Judging...");
        verdict = await judgeProblem(config, yaml);

        if (verdict.pass) {
          console.log("  ✅ PASS");
          break;
        } else {
          console.log(`  ❌ FLAG: ${verdict.reason}`);
        }
      }

      if (dryRun || !yaml) continue;

      const parsed = parse(yaml);
      if (!parsed) {
        console.log("  ⚠️  Failed to parse YAML, flagging.");
        writeFileSync(join(flaggedDir, `lc${input.leetcode_id}.yaml`), yaml);
        continue;
      }

      if (verdict.pass) {
        await saveProblem(input, parsed);
        passedCount++;
        console.log(`  💾 Saved to Supabase (${passedCount} total)`);
      } else {
        flaggedCount++;
        parsed._flag_reason = verdict.reason;
        writeFileSync(
          join(flaggedDir, `lc${input.leetcode_id}.yaml`),
          stringify(parsed, { lineWidth: 120 }),
        );
      }
    } catch (err) {
      errors++;
      console.log(`  ⚠️  Error: ${err instanceof Error ? err.message : err}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (dryRun) return;

  console.log(`\n✅ ${passedCount} problems saved to Supabase`);
  if (flaggedCount > 0) console.log(`❌ ${flaggedCount} problems flagged in ${flaggedDir}`);
  if (errors > 0) console.log(`⚠️  ${errors} problems failed with errors`);
  console.log("Done.");
}

run().catch((err) => {
  console.error("Pipeline error:", err);
  process.exit(1);
});
