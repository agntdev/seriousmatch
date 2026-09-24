import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { freshDraft, getProfile, now, notifyAdmin, saveProfile } from "../profile-data.js";
import type { FlowSession } from "../flow-session.js";

registerMainMenuItem({ label: "👤 Создать анкету", data: "profile:create", order: 10 });
const composer = new Composer<Ctx>();
const force = (placeholder: string) => ({ force_reply: true as const, input_field_placeholder: placeholder });

function session(ctx: Ctx): FlowSession { return ctx.session as unknown as FlowSession; }
function preview(d: NonNullable<FlowSession["draft"]>): string {
  return `Проверьте анкету:\n\nИмя: ${d.name}\nВозраст: ${d.age}\nПол: ${d.gender ?? "не указан"}\nГород: ${d.city || "не указан"}\nО себе: ${d.bio || "не указано"}\nФото: ${d.photos.length}`;
}
async function askName(ctx: Ctx) {
  session(ctx).step = "name";
  await ctx.reply("Как вас зовут?", { reply_markup: force("Ваше имя") });
}
async function showPreview(ctx: Ctx) {
  const d = session(ctx).draft;
  if (!d?.name || !d.age) return askName(ctx);
  session(ctx).step = "idle";
  await ctx.reply(preview(d), { reply_markup: inlineKeyboard([[inlineButton("✅ Сохранить", "profile:confirm"), inlineButton("Отменить", "profile:cancel")]]) });
}
function photoControls(ctx: Ctx) {
  const count = session(ctx).draft?.photos.length ?? 0;
  const rows = [[inlineButton("Готово", "profile:photos:done")]];
  if (count) rows.push([inlineButton("Удалить последнее", `profile:photo:remove:${count - 1}`)]);
  if (count > 1) rows.push([inlineButton("Поднять последнее", `profile:photo:up:${count - 1}`), inlineButton("Опустить последнее", `profile:photo:down:${count - 1}`)]);
  return inlineKeyboard(rows);
}

composer.callbackQuery("profile:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (await getProfile(ctx)) { await ctx.reply("Анкета уже создана — её можно открыть в меню."); return; }
  session(ctx).draft = freshDraft();
  await askName(ctx);
});
composer.callbackQuery("profile:restart", async (ctx) => { await ctx.answerCallbackQuery(); session(ctx).draft = freshDraft(); await askName(ctx); });
composer.callbackQuery("profile:resume", async (ctx) => {
  await ctx.answerCallbackQuery();
  const s = session(ctx);
  if (!s.draft) { s.draft = freshDraft(); await askName(ctx); return; }
  if (s.step === "name") await ctx.reply("Как вас зовут?", { reply_markup: force("Ваше имя") });
  else if (s.step === "age") await ctx.reply("Сколько вам лет? Напишите число от 18 до 100 или дату в формате дд.мм.гггг.", { reply_markup: force("Возраст или дата рождения") });
  else if (s.step === "city") await ctx.reply("В каком городе вы живёте? Можно пропустить.", { reply_markup: force("Ваш город") });
  else if (s.step === "bio") await ctx.reply("Расскажите о себе в двух-трёх предложениях. Можно пропустить.", { reply_markup: force("Пара слов о себе") });
  else await showPreview(ctx);
});

composer.callbackQuery(/^profile:gender:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  session(ctx).draft!.gender = ctx.match[1] === "skip" ? undefined : ctx.match[1];
  session(ctx).step = "age";
  await ctx.reply("Сколько вам лет? Напишите число от 18 до 100 или дату в формате дд.мм.гггг.", { reply_markup: force("Возраст или дата рождения") });
});
composer.callbackQuery("profile:skip", async (ctx) => { await ctx.answerCallbackQuery(); session(ctx).step = "photos"; await ctx.reply("Пришлите до 6 фотографий или нажмите «Пропустить».", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:photos:done")]]) }); });
composer.callbackQuery("profile:photos:done", async (ctx) => { await ctx.answerCallbackQuery(); await showPreview(ctx); });
composer.callbackQuery("profile:cancel", async (ctx) => { await ctx.answerCallbackQuery(); session(ctx).draft = undefined; session(ctx).step = "idle"; await ctx.reply("Хорошо, анкету не сохранили. Вернитесь, когда будете готовы."); });
composer.callbackQuery("profile:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const d = session(ctx).draft;
  if (!d?.name || !d.age || !ctx.from) { await ctx.reply("Не хватает имени или возраста. Давайте заполним анкету ещё раз."); return; }
  await saveProfile(ctx, { profileId: `profile-${ctx.from.id}`, userId: ctx.from.id, name: d.name, gender: d.gender, age: d.age, birthdate: d.birthdate, city: d.city, bio: d.bio, photos: d.photos, updatedAt: now().toISOString() });
  await notifyAdmin(ctx, "Создана новая анкета");
  session(ctx).draft = undefined; session(ctx).step = "idle";
  await ctx.reply("Анкета сохранена. Пусть знакомство получится тёплым и взаимным!", { reply_markup: inlineKeyboard([[inlineButton("👤 Моя анкета", "profile:view")]]) });
});

composer.on("message:photo", async (ctx, next) => {
  const s = session(ctx);
  if (s.step !== "photos" && s.step !== "edit-photos") return next();
  const photos = s.draft?.photos ?? [];
  if (photos.length >= 6) { await ctx.reply("Можно добавить не больше 6 фотографий."); return; }
  const photo = ctx.message.photo.at(-1);
  if (!photo?.file_id || !s.draft) { await ctx.reply("Не получилось получить это фото. Пришлите его ещё раз."); return; }
  s.draft.photos.push(photo.file_id);
  await ctx.reply(`Фото добавлено (${s.draft.photos.length} из 6).`, { reply_markup: photoControls(ctx) });
});

composer.callbackQuery(/^profile:photo:(remove|up|down):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const d = session(ctx).draft; const index = Number(ctx.match[2]);
  if (!d || index < 0 || index >= d.photos.length) { await ctx.reply("Это фото уже недоступно. Пришлите его ещё раз."); return; }
  const action = ctx.match[1];
  if (action === "remove") d.photos.splice(index, 1);
  if (action === "up" && index > 0) [d.photos[index - 1], d.photos[index]] = [d.photos[index], d.photos[index - 1]];
  if (action === "down" && index < d.photos.length - 1) [d.photos[index], d.photos[index + 1]] = [d.photos[index + 1], d.photos[index]];
  await ctx.reply(`Фото обновлены (${d.photos.length} из 6).`, { reply_markup: photoControls(ctx) });
});

composer.on("message:text", async (ctx, next) => {
  const s = session(ctx); const text = ctx.message.text.trim();
  if (!s.step || !s.draft || s.step === "idle") return next();
  if (s.step === "name") {
    if (!text) { await ctx.reply("Имя не может быть пустым. Напишите, как к вам обращаться.", { reply_markup: force("Ваше имя") }); return; }
    s.draft.name = text.slice(0, 80); s.step = "gender";
    await ctx.reply("Какой пол указать в анкете?", { reply_markup: inlineKeyboard([[inlineButton("Мужчина", "profile:gender:Мужчина"), inlineButton("Женщина", "profile:gender:Женщина")], [inlineButton("Другое", "profile:gender:Другое"), inlineButton("Пропустить", "profile:gender:skip")]]) }); return;
  }
  if (s.step === "age") {
    const age = /^(\d{1,3})$/.test(text) ? Number(text) : (() => { const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text); if (!m) return NaN; const day = Number(m[1]); const month = Number(m[2]); const year = Number(m[3]); const birth = new Date(year, month - 1, day); if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return NaN; const today = now(); let a = today.getFullYear() - year; if (today < new Date(today.getFullYear(), month - 1, day)) a--; s.draft!.birthdate = text; return a; })();
    if (!Number.isInteger(age) || age < 18 || age > 100) { await ctx.reply("Нужен возраст от 18 до 100 лет. Напишите число или дату в формате дд.мм.гггг.", { reply_markup: force("Возраст или дата рождения") }); return; }
    s.draft.age = age; s.step = "city"; await ctx.reply("В каком городе вы живёте? Можно пропустить.", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:city:skip")]]) }); return;
  }
  if (s.step === "city") { s.draft.city = text || undefined; s.step = "bio"; await ctx.reply("Расскажите о себе в двух-трёх предложениях. Можно пропустить.", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:bio:skip")]]) }); return; }
  if (s.step === "bio") { s.draft.bio = text || undefined; s.step = "photos"; await ctx.reply("Пришлите до 6 фотографий или нажмите «Пропустить».", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:photos:done")]]) }); return; }
  if (s.step.startsWith("edit-")) { await next(); return; }
  await next();
});
composer.callbackQuery("profile:city:skip", async (ctx) => { await ctx.answerCallbackQuery(); session(ctx).draft!.city = undefined; session(ctx).step = "bio"; await ctx.reply("Расскажите о себе в двух-трёх предложениях. Можно пропустить.", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:bio:skip")]]) }); });
composer.callbackQuery("profile:bio:skip", async (ctx) => { await ctx.answerCallbackQuery(); session(ctx).draft!.bio = undefined; session(ctx).step = "photos"; await ctx.reply("Пришлите до 6 фотографий или нажмите «Пропустить».", { reply_markup: inlineKeyboard([[inlineButton("Пропустить", "profile:photos:done")]]) }); });

export default composer;
