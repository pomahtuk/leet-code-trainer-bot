import { InlineKeyboard, type Context } from "grammy";
import type { Problem } from "../types.js";

const NUM_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

export async function sendQuizQuestion(
  ctx: Context,
  problem: Problem,
  quizIndex: number,
) {
  const q = problem.quiz[quizIndex];

  // Full options in message text, buttons are just numbers
  const optionsText = q.options
    .map((opt, i) => `${NUM_EMOJI[i]} ${opt}`)
    .join("\n");

  const keyboard = new InlineKeyboard();
  q.options.forEach((_, i) => {
    keyboard.text(NUM_EMOJI[i], `ans:${problem.id}:${quizIndex}:${i}`);
  });

  await ctx.reply(`❓ ${q.question}\n\n${optionsText}`, {
    reply_markup: keyboard,
  });
}

export async function sendSolution(ctx: Context, problem: Problem) {
  const sol = problem.solution;
  let text = `🎯 *Solution: ${problem.title}*\n\n${sol.explanation}\n`;

  // Pseudocode
  text += `\n\`\`\`\n${sol.pseudocode.trim()}\n\`\`\`\n`;

  // Java
  text += `\n*Java:*\n\`\`\`java\n${sol.java.trim()}\n\`\`\``;

  // Split if too long for Telegram (4096 char limit)
  if (text.length > 4000) {
    const explanation = `🎯 *Solution: ${problem.title}*\n\n${sol.explanation}`;
    await ctx.reply(explanation, { parse_mode: "Markdown" });
    await ctx.reply(`\`\`\`java\n${sol.java.trim()}\n\`\`\``, {
      parse_mode: "Markdown",
    });
  } else {
    await ctx.reply(text, { parse_mode: "Markdown" });
  }
}
