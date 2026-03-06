import type { Context } from "grammy";
import { deleteSession, getSession } from "../../db/queries.js";

export async function skipCommand(ctx: Context) {
  const telegramId = ctx.from!.id;
  const session = await getSession(telegramId);

  if (!session) {
    await ctx.reply("No active problem. Use /problem to get one.");
    return;
  }

  await deleteSession(telegramId);
  await ctx.reply("Skipped. Use /problem for a new one.");
}
