import type { Bot, Context } from "grammy";
import {
  getSession,
  upsertSession,
  deleteSession,
  recordAttempt,
  updateStatsOnCorrect,
  updateStatsOnIncorrect,
  getOrCreateStats,
} from "../../db/queries.js";
import { getProblemById } from "../../problems/loader.js";
import { sendQuizQuestion, sendSolution } from "../helpers.js";
import { getLevel } from "../../gamification/xp.js";

export function registerCallbacks(bot: Bot<Context>) {
  // Callback format: ans:{problemId}:{quizIndex}:{selectedOption}
  bot.callbackQuery(/^ans:(\d+):(\d+):(\d+)$/, async (ctx) => {
    const match = ctx.match!;
    const problemId = parseInt(match[1]);
    const quizIndex = parseInt(match[2]);
    const selected = parseInt(match[3]);

    const telegramId = ctx.from.id;
    const session = await getSession(telegramId);

    if (!session || session.problem_id !== problemId) {
      await ctx.answerCallbackQuery("This question is no longer active.");
      return;
    }

    const problem = await getProblemById(problemId);
    if (!problem) {
      await ctx.answerCallbackQuery("Problem not found.");
      return;
    }

    const quiz = problem.quiz[quizIndex];
    const isCorrect = selected === quiz.correct;

    await recordAttempt(telegramId, problemId, quizIndex, selected, isCorrect);

    if (isCorrect) {
      await updateStatsOnCorrect(telegramId);
      await ctx.answerCallbackQuery("✅ Correct!");

      const nextQuizIndex = quizIndex + 1;

      if (nextQuizIndex < problem.quiz.length) {
        // More quiz questions
        await upsertSession(telegramId, {
          problem_id: problemId,
          quiz_index: nextQuizIndex,
        });
        await ctx.reply("✅ Correct!\n");
        await sendQuizQuestion(ctx, problem, nextQuizIndex);
      } else {
        // All questions answered — show solution
        await deleteSession(telegramId);
        await sendSolution(ctx, problem);

        const stats = await getOrCreateStats(telegramId);
        const level = getLevel(stats.xp);
        await ctx.reply(
          `🔥 Streak: ${stats.current_streak} days | ⭐ +10 XP (${stats.xp} total) | ${level.title}\n\n/problem for another one!`,
        );
      }
    } else {
      await updateStatsOnIncorrect(telegramId);
      await ctx.answerCallbackQuery("❌ Not quite.");
      await ctx.reply(`❌ Not quite.\n💡 Hint: ${quiz.hint}`);
      // Re-send the same question
      await sendQuizQuestion(ctx, problem, quizIndex);
    }
  });
}
