import type { Bot, Context } from "grammy";
import { startCommand } from "./start.js";
import { problemCommand } from "./problem.js";
import { statsCommand } from "./stats.js";
import { skipCommand } from "./skip.js";

export function registerCommands(bot: Bot<Context>) {
  bot.command("start", startCommand);
  bot.command("problem", problemCommand);
  bot.command("stats", statsCommand);
  bot.command("skip", skipCommand);
}
