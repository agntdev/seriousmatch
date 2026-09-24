# Серьёзные знакомства — Bot specification

**Archetype:** community

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

Telegram-бот для взрослых, которые ищут долгосрочные отношения. Фаза 1 реализует persistent storage, регистрацию одного реального профиля на Telegram-пользователя (текст + фото), и адаптивное главное меню до/после создания профиля. Никаких демонстрационных/фейковых аккаунтов и платёжной логики.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Adults seeking long-term relationships who use Telegram
- Russian-speaking Telegram users (owner-provided copy)

## Success criteria

- New users can complete the guided profile creation and have a persisted Profile record (name + age required) including up to 6 photo file_ids.
- Returning users see an adapted main menu reflecting whether a Profile exists.
- Users can view, edit, and delete their single Profile; edits persist across bot restarts.
- Critical errors and user-generated reports are delivered to ADMIN_CHAT_ID.

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and load user data (entry fallback).
  - inputs: telegram_user_id
  - outputs: user_record_loaded, profile_exists_boolean, main_menu_displayed
- **👤 Создать анкету** (button, actor: user, callback: profile:create) — Start guided profile creation (visible when user has no profile).
  - inputs: telegram_user_id
  - outputs: registration_session_started, profile_draft
- **👤 Моя анкета** (button, actor: user, callback: profile:view) — View and manage your existing profile (visible when user has a profile).
  - inputs: telegram_user_id, profile_id
  - outputs: profile_summary_displayed
- **🔎 Знакомства** (button, actor: user, callback: discovery:open) — Open the discovery placeholder screen (no matchmaking implemented in Phase 1).
  - inputs: telegram_user_id, settings.search_prefs
  - outputs: discovery_placeholder_shown
- **⚙️ Настройки** (button, actor: user, callback: settings:open) — Open settings (notification prefs, basic search prefs).
  - inputs: telegram_user_id, settings_id
  - outputs: settings_displayed, settings_updated
- **🆘 Помощь** (button, actor: user, callback: help:open) — Open help/FAQ (static owner-provided Russian text).
  - inputs: telegram_user_id
  - outputs: help_displayed

## Flows

### Onboarding /start
_Trigger:_ /start

1. Load or create User entity by Telegram id
2. Detect whether Profile exists
3. Show adaptive main menu (no-profile or with-profile) in Russian

_Data touched:_ User, Profile, Settings

### Create profile (guided)
_Trigger:_ callback: profile:create

1. Start registration session and create profile draft linked to User
2. Ask for name (ForceReply); validate non-empty
3. Ask for gender (inline buttons: e.g. Мужчина/Женщина/Другое/Пропустить)
4. Ask for birthdate or age (ForceReply) — accept age as integer or birthdate in dd.mm.yyyy; compute/validate age; require age
5. Ask for city (ForceReply; optional)
6. Ask for short bio (ForceReply; optional)
7. Ask to upload photos (accept up to 6 Telegram photo messages; allow skip)
8. Show profile preview and Confirm/Cancel buttons
9. On Confirm: persist Profile, set completed_at, notify user and update main menu

_Data touched:_ Profile, Photos, User

### View / Edit profile
_Trigger:_ callback: profile:view

1. Fetch Profile and Photos for user
2. Render profile summary with Edit and Delete inline buttons
3. If Edit -> show per-field editing menu (buttons) and accept updates via ForceReply or photo uploads
4. Persist updates and refresh profile view

_Data touched:_ Profile, Photos

### Delete profile
_Trigger:_ callback: profile:delete

1. Ask for confirmation with inline Yes/No
2. On Yes: remove Profile and associated Photos from persistent store, clear completed_at, show no-profile main menu, optionally notify admin
3. On No: return to profile view

_Data touched:_ Profile, Photos, User

### Photo upload & management
_Trigger:_ during profile create/edit

1. Accept photo messages and store Telegram file_id and order up to 6
2. Allow user to remove or reorder uploaded photos via inline callbacks
3. Persist Photos entity after each change

_Data touched:_ Photos, Profile

### Admin notifications and reports (placeholder)
_Trigger:_ server_error OR user_report

1. Format notification message in Russian with minimal payload (user id, profile id, context, timestamp)
2. Send message to ADMIN_CHAT_ID
3. Log event

_Data touched:_ User, Profile, Reports (placeholder)

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — where admin notifications and reports are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User** _(retention: persistent)_ — Telegram account metadata and join timestamp; one record per telegram user id.
  - fields: telegram_id, display_name, username, language_code, created_at
- **Profile** _(retention: persistent)_ — One Profile per User. Stores the personal card used in later phases.
  - fields: profile_id, user_id, name, gender, age, birthdate_optional, city, bio, visibility, completed_at, updated_at
- **Settings** _(retention: persistent)_ — Per-user preferences (notification and basic search prefs).
  - fields: user_id, notify_on_match, notify_on_message, search_prefs_basic
- **Photos** _(retention: persistent)_ — Ordered list of Telegram file_ids uploaded by user for their profile.
  - fields: photo_id, user_id, file_id, position, uploaded_at
- **Likes / Matches / Reports / Blocks (placeholders)** _(retention: persistent)_ — Schema placeholders reserved for future phases; stored but not used in Phase 1.
  - fields: entity_type, user_from, user_to, created_at, metadata

## Integrations

- **Telegram** (required) — Bot API messaging, file_id-managed photo storage, inline callback interactions
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Receive admin notifications and reports to ADMIN_CHAT_ID
- Delete a user profile on owner request (manual admin command or tool)
- Request export of a single user's profile (format: JSON) via admin-only command
- Set or update help/FAQ Russian text content (owner-provided copy stored by bot)

## Notifications

- Admin: critical server errors and user reports -> ADMIN_CHAT_ID (Russian summary + ids).
- User: confirmation on profile creation, profile update, and profile deletion (concise Russian messages).

## Permissions & privacy

- One profile per Telegram user; Telegram user id is primary identifier.
- Photos are stored by Telegram file_id only; no external photo hosting in Phase 1.
- No profile data is shared externally; admin notifications include minimal identifying info.
- Owner must supply ADMIN_CHAT_ID to receive reports and critical error alerts.
- Explicit user-initiated delete removes profile and photo metadata from the bot's storage.

## Edge cases

- User abandons registration mid-flow: draft profile saved in session; provide Resume/Create Over option when they /start again.
- User uploads more than 6 photos: enforce limit and show clear error in Russian.
- Invalid age/birthdate formats: validate and re-prompt with example format dd.mm.yyyy or numeric age.
- Photo file_id invalid/unavailable: detect Telegram download/file retrieval errors and prompt user to re-upload.
- User changes Telegram username/display name externally: User entity stores snapshot; show latest display_name on next interaction if available.
- Race conditions: concurrent edits from multiple devices — last write wins; surface conflict warning in future phases.
- Admin_CHAT_ID missing or invalid: critical notifications fail — surface owner-facing setup error on first run.

## Required tests

- Dialog acceptance: new user completes full create-profile happy path (required fields + skip optionals) and sees updated menu.
- Dialog acceptance: user uploads photos (1..6), reorders and deletes photos, and changes persist after restart.
- Edit acceptance: user edits name, city, bio and changes are persisted and shown in profile preview.
- Delete acceptance: user deletes profile with confirmation; profile removed and main menu updates to no-profile state.
- Persistence test: data survives bot restart (User, Profile, Photos, Settings).
- Admin notification test: simulate user report and verify message arrives at ADMIN_CHAT_ID.

## Assumptions

- One Telegram account = one Profile enforced by telegram user_id.
- Required profile fields are name and age; gender, city, bio, photos optional for Phase 1.
- Max photos per profile = 6; photos stored as Telegram file_id.
- Russian-language copy will be supplied by owner for all user-facing strings; default prompts use the owner's Russian labels.
- No matchmaking, likes/matches, or search internals implemented in Phase 1 beyond placeholders.
