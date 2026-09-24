import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getSettings, saveSettings } from "../profile-data.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "⚙️ Настройки", data: "settings:open", order: 30 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx) { const s = await getSettings(ctx); await ctx.reply(`Настройки уведомлений\n\nО совпадениях: ${s.notifyOnMatch ? "включены" : "выключены"}\nО сообщениях: ${s.notifyOnMessage ? "включены" : "выключены"}\nПоиск: ${s.searchPrefsBasic}`, { reply_markup: inlineKeyboard([[inlineButton("О совпадениях", "settings:match"), inlineButton("О сообщениях", "settings:message")], [inlineButton("⬅️ В меню", "menu:main")]]) }); }
composer.callbackQuery("settings:open", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.callbackQuery("settings:match", async (ctx) => { await ctx.answerCallbackQuery(); const s = await getSettings(ctx); s.notifyOnMatch = !s.notifyOnMatch; await saveSettings(ctx, s); await show(ctx); });
composer.callbackQuery("settings:message", async (ctx) => { await ctx.answerCallbackQuery(); const s = await getSettings(ctx); s.notifyOnMessage = !s.notifyOnMessage; await saveSettings(ctx, s); await show(ctx); });
export default composer;
