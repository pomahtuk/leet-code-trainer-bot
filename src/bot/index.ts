import "dotenv/config";
import { Bot, webhookCallback } from "grammy";
import express from "express";
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

const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. https://your-domain.com/bot
const PORT = parseInt(process.env.PORT ?? "3000");

if (WEBHOOK_URL) {
  // Production: webhook mode
  const app = express();

  app.get("/health", (_req, res) => {
    res.send("ok");
  });

  app.use(express.json());
  app.post("/bot", webhookCallback(bot, "express"));

  app.listen(PORT, async () => {
    await bot.api.setWebhook(WEBHOOK_URL + "/bot");
    console.log(`[${new Date().toISOString()}] Bot started (webhook on :${PORT})`);
  });
} else {
  // Dev: polling mode
  bot.start();
  console.log(`[${new Date().toISOString()}] Bot started (polling)`);
}
