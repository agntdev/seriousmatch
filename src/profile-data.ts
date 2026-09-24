import type { Ctx } from "./bot.js";
import type { FlowSession, ProfileRecord, SettingsRecord } from "./flow-session.js";
import { adminChatId } from "./toolkit/index.js";

// One clock seam keeps expiry and audit timestamps deterministic in tests.
export let now = (): Date => new Date();
export function setNow(clock: () => Date): void { now = clock; }

type Db = {
  prepare(sql: string): { bind(...args: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } };
};

function dbOf(ctx: Ctx): Db | undefined {
  const env = (ctx as Ctx & { env?: { DB?: unknown } }).env;
  return env?.DB as Db | undefined;
}

async function ensure(db: Db): Promise<void> {
  await db.prepare("CREATE TABLE IF NOT EXISTS profiles (user_id INTEGER PRIMARY KEY, value TEXT NOT NULL)").bind().run();
  await db.prepare("CREATE TABLE IF NOT EXISTS settings (user_id INTEGER PRIMARY KEY, value TEXT NOT NULL)").bind().run();
}

export async function getProfile(ctx: Ctx): Promise<ProfileRecord | undefined> {
  const userId = ctx.from?.id;
  if (!userId) return undefined;
  const db = dbOf(ctx);
  if (db) {
    await ensure(db);
    const row = await db.prepare("SELECT value FROM profiles WHERE user_id = ?").bind(userId).first<{ value: string }>();
    return row ? JSON.parse(row.value) as ProfileRecord : undefined;
  }
  return ((ctx.session as unknown as FlowSession).domain?.profile);
}

export async function saveProfile(ctx: Ctx, profile: ProfileRecord): Promise<void> {
  const session = ctx.session as unknown as FlowSession;
  const db = dbOf(ctx);
  if (db) {
    await ensure(db);
    await db.prepare("INSERT INTO profiles(user_id,value) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value")
      .bind(profile.userId, JSON.stringify(profile)).run();
  } else {
    session.domain ??= {};
    session.domain.profile = profile;
  }
}

export async function deleteProfile(ctx: Ctx): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;
  const db = dbOf(ctx);
  if (db) {
    await ensure(db);
    await db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();
  } else {
    const session = ctx.session as unknown as FlowSession;
    if (session.domain) delete session.domain.profile;
  }
}

export async function getSettings(ctx: Ctx): Promise<SettingsRecord> {
  const userId = ctx.from?.id ?? 0;
  const db = dbOf(ctx);
  if (db) {
    await ensure(db);
    const row = await db.prepare("SELECT value FROM settings WHERE user_id = ?").bind(userId).first<{ value: string }>();
    if (row) return JSON.parse(row.value) as SettingsRecord;
  } else {
    const value = (ctx.session as unknown as FlowSession).domain?.settings;
    if (value) return value;
  }
  const value = { userId, notifyOnMatch: true, notifyOnMessage: true, searchPrefsBasic: "Без заданных предпочтений" };
  await saveSettings(ctx, value);
  return value;
}

export async function saveSettings(ctx: Ctx, settings: SettingsRecord): Promise<void> {
  const db = dbOf(ctx);
  if (db) {
    await ensure(db);
    await db.prepare("INSERT INTO settings(user_id,value) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value")
      .bind(settings.userId, JSON.stringify(settings)).run();
  } else {
    const session = ctx.session as unknown as FlowSession;
    session.domain ??= {};
    session.domain.settings = settings;
  }
}

export function freshDraft(): NonNullable<FlowSession["draft"]> {
  return { photos: [] };
}

export async function notifyAdmin(ctx: Ctx, context: string): Promise<boolean> {
  const target = adminChatId(ctx as Ctx & { env?: Record<string, unknown> });
  if (!target) return false;
  try {
    await ctx.api.sendMessage(target, `Сообщение бота\nПользователь: ${ctx.from?.id ?? "неизвестен"}\nКонтекст: ${context}\nВремя: ${now().toISOString()}`);
    return true;
  } catch { return false; }
}
