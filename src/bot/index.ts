import "dotenv/config";
import { Bot, webhookCallback } from "grammy";
import Fastify from "fastify";
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

const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. https://your-domain.com
const PORT = parseInt(process.env.PORT ?? "3000");

if (WEBHOOK_URL) {
  // Production: webhook mode
  const app = Fastify({ logger: false });

  app.get("/health", async () => "ok");

  const handleUpdate = webhookCallback(bot, "std/http");

  app.post("/bot", async (request, reply) => {
    const res = await handleUpdate(
      new Request(`http://localhost/bot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
      }),
    );
    reply.status(res.status);
    return res.text();
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[${new Date().toISOString()}] Listening on :${PORT}`);

  try {
    await bot.api.setWebhook(WEBHOOK_URL + "/bot");
    console.log(`[${new Date().toISOString()}] Webhook registered`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Webhook registration failed (will retry on next deploy):`, err);
  }
} else {
  // Dev: polling mode
  bot.start();
  console.log(`[${new Date().toISOString()}] Bot started (polling)`);
}
