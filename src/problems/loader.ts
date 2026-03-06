import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import type { Problem, UserSettings } from "../types.js";

const DATA_DIR = join(import.meta.dirname, "../../data/problems");

let problemCache: Problem[] | null = null;

export function loadAllProblems(): Problem[] {
  if (problemCache) return problemCache;

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".yaml"));
  const problems: Problem[] = [];

  for (const file of files) {
    const content = readFileSync(join(DATA_DIR, file), "utf-8");
    const parsed = parse(content);
    if (Array.isArray(parsed)) {
      problems.push(...parsed);
    }
  }

  problemCache = problems;
  return problems;
}

export function filterProblems(
  problems: Problem[],
  settings: UserSettings,
  solvedIds: number[] = [],
): Problem[] {
  return problems.filter((p) => {
    if (
      settings.difficulties?.length &&
      !settings.difficulties.includes(p.difficulty)
    )
      return false;
    if (
      settings.companies?.length &&
      !p.companies.some((c) => settings.companies!.includes(c))
    )
      return false;
    if (
      settings.topics?.length &&
      !p.topics.some((t) => settings.topics!.includes(t))
    )
      return false;
    if (settings.exclude_solved && solvedIds.includes(p.id)) return false;
    return true;
  });
}

export function getRandomProblem(problems: Problem[]): Problem | null {
  if (problems.length === 0) return null;
  return problems[Math.floor(Math.random() * problems.length)];
}

export function getProblemById(id: number): Problem | undefined {
  return loadAllProblems().find((p) => p.id === id);
}
