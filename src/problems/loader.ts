import { supabase } from "../db/client.js";
import type { Problem, UserSettings } from "../types.js";

export async function loadFilteredProblems(
  settings: UserSettings,
  solvedIds: number[] = [],
): Promise<Problem[]> {
  let query = supabase.from("lc_problems").select("*");

  if (settings.difficulties?.length) {
    query = query.in("difficulty", settings.difficulties);
  }
  if (settings.topics?.length) {
    query = query.overlaps("topics", settings.topics);
  }
  if (settings.companies?.length) {
    query = query.overlaps("companies", settings.companies);
  }
  if (settings.exclude_solved && solvedIds.length > 0) {
    query = query.not("leetcode_id", "in", `(${solvedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToProblem);
}

export async function getProblemById(id: number): Promise<Problem | null> {
  const { data } = await supabase
    .from("lc_problems")
    .select("*")
    .eq("id", id)
    .single();

  return data ? rowToProblem(data) : null;
}

export function getRandomProblem(problems: Problem[]): Problem | null {
  if (problems.length === 0) return null;
  return problems[Math.floor(Math.random() * problems.length)];
}

function rowToProblem(row: Record<string, unknown>): Problem {
  return {
    id: row.id as number,
    leetcode_id: row.leetcode_id as number,
    title: row.title as string,
    difficulty: row.difficulty as Problem["difficulty"],
    companies: row.companies as string[],
    topics: row.topics as string[],
    statement: row.statement as string,
    quiz: row.quiz as Problem["quiz"],
    solution: row.solution as Problem["solution"],
  };
}
