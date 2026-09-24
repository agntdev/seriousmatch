import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { notifyAdmin } from "../profile-data.js";
registerMainMenuItem({ label: "🆘 Помощь", data: "help:open", order: 40 });
const composer = new Composer<Ctx>();
const text = "ℹ️ Здесь люди знакомятся для серьёзных отношений. Создайте анкету, добавьте фото и укажите немного о себе.\n\nНужна помощь? Напишите нам — мы обязательно разберёмся.";
composer.callbackQuery("help:open", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Сообщить о проблеме", "report:open")], [inlineButton("⬅️ В меню", "menu:main")]]) }); });
composer.callbackQuery("report:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  const sent = await notifyAdmin(ctx, "Пользователь открыл форму сообщения о проблеме");
  await ctx.reply(sent ? "Сообщение отправлено владельцу. Спасибо, что помогаете улучшать бот." : "Сообщение не отправилось: доступ владельца ещё не настроен.");
});
export default composer;
