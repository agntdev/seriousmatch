import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { deleteProfile, getProfile, now, notifyAdmin, saveProfile } from "../profile-data.js";
import type { FlowSession } from "../flow-session.js";
import type { ProfileRecord } from "../flow-session.js";

registerMainMenuItem({ label: "👤 Моя анкета", data: "profile:view", order: 10 });
const composer = new Composer<Ctx>();
const s = (ctx: Ctx) => ctx.session as unknown as FlowSession;
function card(p: ProfileRecord): string {
  return `👤 ${p.name}, ${p.age}\nПол: ${p.gender ?? "не указан"}\nГород: ${p.city || "не указан"}\nО себе: ${p.bio || "не указано"}\nФото: ${p.photos.length}`;
}
async function show(ctx: Ctx) {
  const p = await getProfile(ctx);
  if (!p) { await ctx.reply("Анкеты пока нет — нажмите «Создать анкету», чтобы начать.", { reply_markup: inlineKeyboard([[inlineButton("👤 Создать анкету", "profile:create")]]) }); return; }
  await ctx.reply(card(p), { reply_markup: inlineKeyboard([[inlineButton("Изменить", "profile:edit"), inlineButton("Удалить", "profile:delete")], [inlineButton("⬅️ В меню", "menu:main")]]) });
}
composer.callbackQuery("profile:view", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.callbackQuery("profile:edit", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Что хотите изменить?", { reply_markup: inlineKeyboard([[inlineButton("Имя", "profile:edit:name"), inlineButton("Город", "profile:edit:city")], [inlineButton("О себе", "profile:edit:bio"), inlineButton("Фото", "profile:edit:photos")], [inlineButton("⬅️ Назад", "profile:view")]]) }); });
composer.callbackQuery("profile:delete", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Удалить анкету и фотографии? Это действие нельзя отменить.", { reply_markup: inlineKeyboard([[inlineButton("Удалить", "profile:delete:yes"), inlineButton("Оставить", "profile:delete:no")]]) }); });
composer.callbackQuery("profile:delete:no", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.callbackQuery("profile:delete:yes", async (ctx) => { await ctx.answerCallbackQuery(); await deleteProfile(ctx); s(ctx).domain && delete s(ctx).domain!.profile; await notifyAdmin(ctx, "Пользователь удалил анкету"); await ctx.reply("Анкета удалена. Если захотите вернуться, мы будем рады.", { reply_markup: inlineKeyboard([[inlineButton("Создать анкету", "profile:create")]]) }); });

composer.callbackQuery("profile:edit:name", async (ctx) => { await ctx.answerCallbackQuery(); s(ctx).step = "edit-name"; await ctx.reply("Как вас теперь называть?", { reply_markup: { force_reply: true, input_field_placeholder: "Ваше имя" } }); });
composer.callbackQuery("profile:edit:city", async (ctx) => { await ctx.answerCallbackQuery(); s(ctx).step = "edit-city"; await ctx.reply("В каком городе вы живёте?", { reply_markup: { force_reply: true, input_field_placeholder: "Ваш город" } }); });
composer.callbackQuery("profile:edit:bio", async (ctx) => { await ctx.answerCallbackQuery(); s(ctx).step = "edit-bio"; await ctx.reply("Что рассказать о вас?", { reply_markup: { force_reply: true, input_field_placeholder: "Пара слов о себе" } }); });
composer.callbackQuery("profile:edit:photos", async (ctx) => { await ctx.answerCallbackQuery(); const p = await getProfile(ctx); if (!p) { await ctx.reply("Анкета не найдена. Откройте меню и создайте её заново."); return; } s(ctx).draft = { name: p.name, gender: p.gender, age: p.age, birthdate: p.birthdate, city: p.city, bio: p.bio, photos: [...p.photos] }; s(ctx).step = "edit-photos"; await ctx.reply(`Пришлите новые фотографии. Сейчас добавлено: ${p.photos.length}.`, { reply_markup: inlineKeyboard([[inlineButton("Готово", "profile:edit:photos:done")]]) }); });
composer.callbackQuery("profile:edit:photos:done", async (ctx) => { await ctx.answerCallbackQuery(); const p = await getProfile(ctx); const d = s(ctx).draft; if (p && d) { p.photos = d.photos; p.updatedAt = now().toISOString(); await saveProfile(ctx, p); } s(ctx).draft = undefined; s(ctx).step = "idle"; await ctx.reply("Фото обновлены."); await show(ctx); });
composer.on("message:text", async (ctx, next) => {
  const flow = s(ctx); if (!flow.step?.startsWith("edit-") || !flow.draft) return next();
  const p = await getProfile(ctx); if (!p) { flow.step = "idle"; await ctx.reply("Анкета не найдена. Откройте меню и создайте её заново."); return; }
  const text = ctx.message.text.trim(); if (flow.step === "edit-name" && text) p.name = text.slice(0, 80); else if (flow.step === "edit-city") p.city = text || undefined; else if (flow.step === "edit-bio") p.bio = text || undefined; else return next();
  p.updatedAt = now().toISOString(); await saveProfile(ctx, p); flow.step = "idle"; flow.draft = undefined; await ctx.reply("Изменения сохранены."); await show(ctx);
});
export default composer;
