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

// Log all incoming updates
bot.use(async (ctx, next) => {
  const user = ctx.from?.username ?? ctx.from?.id;
  if (ctx.message?.text) {
    console.log(`[${new Date().toISOString()}] ${user}: ${ctx.message.text}`);
  } else if (ctx.callbackQuery?.data) {
    console.log(`[${new Date().toISOString()}] ${user}: callback ${ctx.callbackQuery.data}`);
  }
  await next();
});

registerCommands(bot);
registerCallbacks(bot);

bot.catch((err) => {
  console.error(`[${new Date().toISOString()}] Bot error:`, err);
});

bot.start();
console.log(`[${new Date().toISOString()}] Bot started`);
