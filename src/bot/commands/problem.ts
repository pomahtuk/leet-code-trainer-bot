import { InlineKeyboard, type Context } from "grammy";
import {
  getOrCreateUser,
  getUserSettings,
  getSolvedProblemIds,
  upsertSession,
  getSession,
  deleteSession,
} from "../../db/queries.js";
import {
  loadAllProblems,
  filterProblems,
  getRandomProblem,
  getProblemById,
} from "../../problems/loader.js";
import { sendQuizQuestion } from "../helpers.js";

export async function problemCommand(ctx: Context) {
  const telegramId = ctx.from!.id;
  await getOrCreateUser(telegramId, ctx.from!.username);

  // Check for existing session
  const existing = await getSession(telegramId);
  if (existing) {
    const problem = getProblemById(existing.problem_id);
    if (problem) {
      await ctx.reply(
        `You have an active problem: *${problem.title}*\nUse /skip to get a new one, or answer the current question.`,
        { parse_mode: "Markdown" },
      );
      await sendQuizQuestion(ctx, problem, existing.quiz_index);
      return;
    }
    await deleteSession(telegramId);
  }

  const settings = await getUserSettings(telegramId);
  const solvedIds = settings.exclude_solved
    ? await getSolvedProblemIds(telegramId)
    : [];

  const all = loadAllProblems();
  const filtered = filterProblems(all, settings, solvedIds);
  const problem = getRandomProblem(filtered);

  if (!problem) {
    await ctx.reply("No problems found matching your filters. Try /settings to adjust.");
    return;
  }

  await upsertSession(telegramId, { problem_id: problem.id, quiz_index: 0 });

  const diffEmoji =
    problem.difficulty === "easy"
      ? "🟢"
      : problem.difficulty === "medium"
        ? "🟡"
        : "🔴";

  await ctx.reply(
    `${diffEmoji} *${problem.title}* (${problem.difficulty})\n` +
      `Topics: ${problem.topics.join(", ")}\n\n` +
      `${problem.statement}`,
    { parse_mode: "Markdown" },
  );

  await sendQuizQuestion(ctx, problem, 0);
}
