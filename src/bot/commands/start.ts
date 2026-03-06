import type { Context } from "grammy";
import { getOrCreateUser } from "../../db/queries.js";

export async function startCommand(ctx: Context) {
  const telegramId = ctx.from!.id;
  const username = ctx.from!.username;
  await getOrCreateUser(telegramId, username);

  await ctx.reply(
    "Welcome to LeetCode Training Bot!\n\n" +
      "Commands:\n" +
      "/problem - Get a random problem\n" +
      "/stats - View your progress\n\n" +
      "Let's start! Use /problem to get your first question.",
  );
}
