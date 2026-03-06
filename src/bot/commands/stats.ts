import type { Context } from "grammy";
import { getOrCreateStats } from "../../db/queries.js";
import { formatStats } from "../../gamification/xp.js";

export async function statsCommand(ctx: Context) {
  const telegramId = ctx.from!.id;
  const stats = await getOrCreateStats(telegramId);
  await ctx.reply(formatStats(stats));
}
