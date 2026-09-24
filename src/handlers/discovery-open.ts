import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "🔎 Знакомства", data: "discovery:open", order: 20 });
const composer = new Composer<Ctx>();
composer.callbackQuery("discovery:open", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Раздел знакомств скоро откроется. Пока заполните анкету — так вас будет проще заметить.", { reply_markup: inlineKeyboard([[inlineButton("👤 Моя анкета", "profile:view"), inlineButton("⬅️ В меню", "menu:main")]]) }); });
export default composer;
