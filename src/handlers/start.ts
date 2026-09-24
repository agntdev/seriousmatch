import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getProfile, getSettings } from "../profile-data.js";
import type { FlowSession } from "../flow-session.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "👋 Давайте знакомиться. Здесь можно создать анкету для серьёзных отношений.";

async function menu(ctx: Ctx) {
  const profile = await getProfile(ctx);
  await getSettings(ctx);
  const rows = profile
    ? [[inlineButton("👤 Моя анкета", "profile:view")]]
    : [[inlineButton("👤 Создать анкету", "profile:create")]];
  rows.push([inlineButton("🔎 Знакомства", "discovery:open"), inlineButton("⚙️ Настройки", "settings:open")]);
  rows.push([inlineButton("🆘 Помощь", "help:open")]);
  return inlineKeyboard(rows);
}

composer.command("start", async (ctx) => {
  const session = ctx.session as unknown as FlowSession;
  const profile = await getProfile(ctx);
  if (session.step && session.step !== "idle" && session.draft) {
    await ctx.reply("У вас есть незавершённая анкета. Продолжим с того места, где остановились?", {
      reply_markup: inlineKeyboard([[inlineButton("Продолжить", "profile:resume"), inlineButton("Начать заново", "profile:restart")]]),
    });
    return;
  }
  await ctx.reply(profile ? "Рады снова вас видеть. Анкета готова к просмотру." : WELCOME, { reply_markup: await menu(ctx) });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = await getProfile(ctx);
  await ctx.editMessageText(profile ? "Рады снова вас видеть. Анкета готова к просмотру." : WELCOME, { reply_markup: await menu(ctx) });
});

export default composer;
