import "dotenv/config";
import { Bot } from "grammy";
import { registerCommands } from "./commands/index.js";
import { registerCallbacks } from "./handlers/quiz.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new Bot(token);

registerCommands(bot);
registerCallbacks(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

bot.start();
console.log("Bot started");
