# Fitness-Meshantanu — Product & Engineering Audit Report

Date: 2026-08-19 · Auditor: Claude Code (full repo + backend probe) · Repo state: `main @ d35e53b`

---

## 0. CRITICAL BLOCKER — the backend is gone

The Supabase project hardcoded in `src/lib/supabase.js:7` (`ttoauublnprcdgvumrpj.supabase.co`) **does not resolve (DNS NXDOMAIN)**. This is the signature of a **paused or deleted Supabase project** (free-tier projects are paused after ~1 week of inactivity; paused projects lose DNS).

Consequences:
- The app is 100% non-functional right now: no login, no data, nothing.
- The database schema, RLS policies, triggers, and data **cannot be inspected or verified** — there are **no migration files in the repo**, so the hosted DB was the only source of truth for the schema.
- Everything in §3 below is **reconstructed from code**, and every RLS claim is **unverifiable** until the project is restored.

**Action required (only you can do this):** log into the Supabase dashboard and either
1. **Restore** the paused project `ttoauublnprcdgvumrpj` (data comes back), or
2. Tell me to **provision a fresh schema** — I can write complete SQL migrations (tables, constraints, cascades, RLS, trigger for profile creation) from the reconstruction below, and you'd create a new project and run them (data is lost unless you have a backup).

Either way, this repo should gain a `supabase/migrations/` directory so the schema is never unrecoverable again.

---

## 1. Current architecture

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81.5 / React 19.1, targets iOS + Android + static web (`expo export -p web`, EAS deploy) |
| Routing | expo-router v6 (file-based, `src/app/`), auth-gating via a redirect effect in the root layout |
| Styling | NativeWind 4 (Tailwind) + a CSS-variable theme system (`src/theme/`) |
| State | Zustand: `authStore`, `workoutStore`, `exerciseStore`, `useThemeStore` |
| Data | `@supabase/supabase-js` v2 direct from the client (no API layer); wger.de public REST API for the exercise catalogue |
| Charts | `victory-native` installed but **never imported** (charts are hand-rolled Views) |
| AI | `chatService.js` (OpenAI GPT-3.5) — **dead code**: `openai` is not in package.json, nothing imports it |
| Tests / lint / CI | **None. Zero.** No test runner, no ESLint config, no CI, no typecheck script |

Route inventory (18 routes): `(auth)/login`, `(auth)/signup`, `(tabs)/index` (dashboard), `(tabs)/exercises`, `(tabs)/workout`, `(tabs)/profile`, `profile-setup`, `create-plan`, `edit-plan`, `browse-templates`, `exercise-detail`, `favorites`, `history`, `progress`, `nutrition`, `workout-session`, `workout-complete`. **No forgot-password, no AI chat, no meal-plan, no settings/notifications route.**

## 2. Existing features (what genuinely works, pending backend restore)

- **Auth**: email/password signup (with a profile-creation DB trigger assumed), login, logout, email-verification screen. Session persistence via AsyncStorage/localStorage.
- **Onboarding**: `profile-setup` collects height/weight/age/gender/BMR/goal; root layout gates on `profile.height`.
- **Exercise library**: browse/search/filter wger exercises + 30 hardcoded warmup/cooldown entries; favorites persisted to `favorite_exercises` with optimistic updates.
- **Workout plans**: create weekly plan (2-step wizard), edit plan (inline, per-field writes), templates (list + activate), delete plan (manual client-side cascade).
- **Workout execution**: session start → per-set logging (`exercise_sets`) with automatic PR detection (`personal_records`) → completion with calorie estimate → summary screen.
- **History & progress**: session list grouped by date with period filters; weekly volume/calories/sets/workouts bar chart; streaks; PR list (top 5).
- **Nutrition**: real tracking, not a mock — BMR (Mifflin-St Jeor) → TDEE → goal-based macro targets computed from the profile; daily consumption + water in `daily_nutrition`; food entries in `food_log` (write-only, never read back).

## 3. Reconstructed database schema (from code — must be verified/recreated)

| Table | Columns inferred | Constraints the code silently assumes |
|---|---|---|
| `profiles` | id (pk = auth.uid), email, full_name, height, weight, age, gender, bmr, goal, activity_level, created_at, updated_at | created by an auth trigger (signup waits 1s for it); `activity_level` has **no UI** to set it |
| `workout_plans` | id, user_id, name, description, start_date, end_date, is_active, is_template, created_at | — |
| `workout_days` | id, plan_id, day_of_week (0=Mon!), name, is_rest_day | FK → workout_plans, cascade unknown |
| `planned_exercises` | id, workout_day_id, exercise_id (text: wger ids + `warmup_N`), exercise_name, exercise_type, target_sets, target_reps, target_weight, target_duration (never written), notes, order_index, user_id (**written by one screen, omitted by another** — schema ambiguity) | FK → workout_days |
| `workout_sessions` | id, user_id, workout_day_id (nullable), date, started_at, completed_at, total_calories_burned, notes | no duration column (duration is lost on reload) |
| `exercise_sets` | id, session_id, planned_exercise_id, exercise_id, exercise_name, set_number, reps, weight, duration, notes, is_pr, created_at | **no user_id** → RLS must join through session |
| `personal_records` | id, user_id, exercise_id, exercise_name, max_weight, max_reps, achieved_at, session_id | code needs UNIQUE(user_id, exercise_id) |
| `favorite_exercises` | id, user_id, exercise_id (text), exercise_name, exercise_type, created_at | code needs UNIQUE(user_id, exercise_id) |
| `daily_nutrition` | id, user_id, date, target_calories/protein/carbs/fats, calories_consumed/protein/carbs/fats_consumed, water_intake_ml, calories_burned, updated_at | code needs UNIQUE(user_id, date) — get-or-create is a TOCTOU race without it |
| `food_log` | id, user_id, date, food_name, calories, protein, carbs, fats, serving_size, meal_type, logged_at | **write-only** — no screen ever reads it |

Missing tables for requested product scope: body-weight/measurement history, meal plans & meals, AI conversations/messages, notification preferences/reminders.

## 4. Existing AI functionality

**Effectively none.** `src/services/chatService.js` contains two OpenAI GPT-3.5 helpers (workout recommendations, plan generation) but:
- the `openai` package is not installed and not in package.json → would crash on import;
- nothing imports it anywhere;
- it uses `dangerouslyAllowBrowser: true` with `EXPO_PUBLIC_OPENAI_API_KEY` — i.e. **the OpenAI secret key shipped inside the client bundle**. This pattern must never go to production. The key in `.env.local` should be **rotated** and any AI must be moved server-side (Supabase Edge Function).

No AI chat UI, no conversation persistence, no meal-plan generation, no structured tool-calling. The entire AI feature set (prompt §16–19) is greenfield.

## 5. Existing notification functionality

**None.** No expo-notifications dependency, no reminder tables, no preferences UI, no scheduling. Greenfield (prompt §12).

## 6. Missing features (vs. product requirements)

1. **Forgot/reset/change password — completely absent** (no route, no `resetPasswordForEmail` call anywhere). Users who forget a password are permanently locked out.
2. Email-verification **Resend button is a dead button** — `onPress={() => {/* Handle resend logic */}}`.
3. No deep-link/`onAuthStateChange` handling at all — verifying email via the link is never detected by the app.
4. Body-weight logging & history (weight exists only as a scalar on `profiles`).
5. Meal plans (create/edit/follow), food search, editable meal types (`meal_type` hardcoded to `'snack'`), food-log history view.
6. AI assistant, AI meal-plan generator, AI workout generator (see §4).
7. Notifications/reminders (see §5).
8. Onboarding is a single cramped screen with a **manual free-text BMR field** ("calculate it online") even though `calculateBMR` exists in-repo; no activity-level, dietary preference, country/region, or units input anywhere.
9. Settings: no theme toggle (theme system is 100% inert dead code — light mode unreachable), no units, no change email/password, no delete account, no avatar upload.
10. PR list screen ("Coming Soon" alert at `progress.tsx:373`).
11. Charts: victory-native installed but unused; current chart is a hand-rolled bar chart.
12. Rest timer, set editing/undo, workout notes during sessions.

## 7. Bugs (the catalogue — 80+ found; the load-bearing ones)

**Data-destroying / integrity**
- `workout.tsx:56-85` — **Delete Plan executes immediately: the confirmation dialog is commented out**, and success/failure feedback is `console.log` only.
- `workoutService.ts:321-328` — cascade-delete fallback **deletes the user's workout-session history** when nulling the FK fails. Silent data loss.
- `workoutService.ts:483,511` — PR check ignores the query `error`; any transient failure ⇒ **false PR recorded, real record overwritten**.
- `createWeeklyPlan` / `activateTemplate` / `manualCascadeDelete` are all non-atomic multi-request sequences; mid-failure leaves zero active plans and/or orphan rows. `activateTemplate` **mutates the template row** instead of cloning it (template and live plan become the same record).
- Timezone: `new Date().toISOString().split('T')[0]` (3 sites) files workouts/nutrition under **tomorrow's date** for anyone west of UTC.

**Duplicate-record / double-submit**
- Workout completion can run twice via 3 paths (`router.push` leaves live session on the back stack; no in-flight guard; no `completed_at` guard).
- Session resume re-logs `set_number` 1,2,3… (`currentSet` hardcoded to 1 on mount).
- `startWorkout` double-tap inserts two `workout_sessions` (dashboard + workout tab).
- Nutrition read-modify-write races on `daily_nutrition` (`addWater` has no guard at all); get-or-create TOCTOU can create duplicate day rows.

**Broken UX / dead ends**
- **6 dead navigation targets**: `/workout-details` (history + progress cards — the primary interaction of both screens), `/workouts` and `/(tabs)/workouts` (4 more sites). None of these routes exist.
- Dashboard renders the literal string `undefined` for all four macros when the profile is incomplete (`index.tsx:154` guard bug), and "Total volume" is structurally always 0 (missing `exercise_sets` join).
- History "All Time" filter shows **less** than "This Year" (falls into the 30-day default branch).
- Streak math: single workout ⇒ bestStreak 0; same-day sessions ignored; "current" streak may have ended a month ago.
- `browse-templates` store bug leaves `loading: true` forever after activation; workout tab can spin indefinitely.
- Store bug: deleting any template **blanks the active plan in the UI** (`workoutStore` sets `activePlan: null` unconditionally).
- `edit-plan` fires **one Supabase UPDATE per keystroke** on name/sets/reps/weight fields.
- Unguarded `user.id` dereferences in 6 screens crash if auth hasn't hydrated.
- `nutrition.tsx` double-counts exercise calories (added to target AND subtracted from consumed).
- Stale data everywhere: no `useFocusEffect` — dashboard/workout tab never refresh after creating/editing/completing anything.
- Profile edit form never resyncs to async-loaded profile (can silently blank `full_name`); signup relies on a **1-second sleep** racing the DB trigger.

**Rendering / theming**
- The entire theme system is inert: `tailwind.config.js` hardcodes hex values instead of `var(--*)`; `toggleTheme` is never called; light palette is commented out. `bg-primary`, `border-border`, `max-h-3/4`, `bg-gradient-to-r` (dashboard hero card has **no background**) are all invalid/undefined classes silently doing nothing.

## 8. Security issues

1. **RLS is unverifiable and is the only defense** (anon key is public by design and committed). Until the project is restored and policies are audited, assume the worst.
2. **IDOR pattern in `workoutService.ts`**: 9 mutating/reading queries filter by row id only, never `user_id` (`activateTemplate`, `deactivatePlan`, `convertToTemplate`, `deletePlan` cascade ×4, `completeWorkoutSession`, `getSessionDetails`). If RLS is missing on even one table, any authenticated user can read/modify/delete any other user's data by UUID. Defense-in-depth demands `.eq('user_id', …)` regardless of RLS.
3. **OpenAI API key exposed to the client** (`EXPO_PUBLIC_` + `dangerouslyAllowBrowser`). Rotate the key; move AI server-side.
4. PII in logs: `exerciseStore` logs user ids and full favorites payloads; ~100 `console.*` calls repo-wide, some in per-render paths.
5. Raw Postgres error messages surfaced to users via `Alert.alert(error.message)` in several screens.
6. No server-side validation anywhere (client-direct-to-DB architecture) — numeric fields accept `NaN`, absurd ranges; validation exists only client-side and only partially.

## 9. Performance issues

- `getWorkoutExercises` fetches **1500 fat records in one request** on the default exercises tab; deprecated `searchExercises` does up to 4 serial round-trips of 200–500 rows with client-side filtering. The optimized paginated methods exist (~230 lines) but are **dead code — no caller**.
- `exerciseStore.isFavorite` `console.log`s **per list item per render** (thousands of bridge crossings per render of the exercise list).
- Artificial 300ms `setTimeout` "fake pagination delay" on every page change (also a race/leak).
- `createWeeklyPlan` = 14 serial requests; `manualCascadeDelete` = 6–8; both should be one RPC each.
- Unbounded queries: `getPersonalRecords` (all rows), history screen (no limit), unbounded in-memory API cache (no eviction).
- FlatList `keyExtractor` includes page number → full list remount every page.
- No `React.memo`/`useCallback` discipline; `InfoCard` component redefined per render.

## 10. Testing gaps

Everything. No unit, integration, or E2E tests; no lint; no typecheck script; `tsconfig` has **strict mode off** (several catalogued bugs are strict-mode compile errors). `tsc --noEmit` currently passes only because strictness is off.

## 11. Recommended implementation order

- **Phase 0 — Unblock the backend (YOU)**: restore or recreate the Supabase project. Then: dump schema into `supabase/migrations/`, verify/write RLS on all 10 tables, add the 3 missing UNIQUE constraints + ON DELETE CASCADE, generate typed client (`supabase gen types typescript`).
- **Phase 1 — Stop-the-bleeding code fixes (no backend needed)**: delete confirmation, user_id scoping, PR error handling, remove history-deleting fallback, dead routes, double-submit guards, dashboard `undefined`/volume bugs, resend-verification, forgot-password flow, timezone-safe local dates, unguarded `user.id`, store `activePlan`/`loading` bugs, remove ~100 console.logs.
- **Phase 2 — Correctness at the DB**: move plan create/delete/PR-upsert/nutrition-accumulate into Postgres RPCs; upsert with onConflict; local-date handling.
- **Phase 3 — Core product completion**: session resume, rest timer, workout-details screen, history pagination, body-weight tracking (new table + progress chart), real onboarding (auto-BMR, activity level, units), profile settings.
- **Phase 4 — Nutrition completion**: meal types, food-log history UI, editable entries, meal plans, water goal from profile.
- **Phase 5 — AI (server-side)**: Supabase Edge Functions proxying a modern model with structured outputs + tool calls (createWorkoutPlan / recordWeight / createMealPlan), chat UI with streaming, conversation persistence, validation of all AI output before writes.
- **Phase 6 — Notifications**: expo-notifications, preferences table, timezone-aware reminders.
- **Phase 7 — UX/theming/a11y**: fix Tailwind config to consume CSS vars, restore light mode + toggle, accessibility labels/roles everywhere (currently **zero** in the repo), responsive passes at 320–1440px.
- **Phase 8 — Performance**: wire up paginated exercise fetching, kill fake delays, memoization, bounded caches.
- **Phase 9 — Quality gates**: strict TypeScript, ESLint, Jest + React Native Testing Library for services/stores, Maestro or Playwright (web) E2E for the 4 core journeys, CI.

## 12. Complexity estimates

| Area | Effort |
|---|---|
| Phase 0 backend restore + migrations + RLS | S–M (blocked on you) |
| Phase 1 bug fixes | M (large count, each small) |
| Phase 2 RPCs | M |
| Phase 3 core product | L |
| Phase 4 nutrition | M–L |
| Phase 5 AI (done right, server-side) | L |
| Phase 6 notifications | M |
| Phase 7 UX/theme/a11y | M–L |
| Phase 8 performance | S–M |
| Phase 9 testing + CI | L |

## Feature scorecard (current state)

| Feature | Status | Production ready |
|---|---|---|
| Authentication | Partial — no reset/resend/deep-links; 1s-sleep race | ❌ |
| Onboarding | Partial — manual BMR, height-only gate, no escape | ❌ |
| Profile | Partial — no resync, no settings, no avatar | ❌ |
| Exercise library | Works — severe perf + race issues | ❌ |
| Workout plans | Works — non-atomic writes, template mutation | ❌ |
| Workout execution | Works — duplicate/double-complete risks, no resume | ❌ |
| Workout history | Partial — dead detail nav, broken All-Time filter | ❌ |
| Progress tracking | Partial — no body weight, broken streaks | ❌ |
| Dashboard | Buggy — undefined macros, volume always 0, stale | ❌ |
| Nutrition | Partial — real tracking; no meals/plans/history UI | ❌ |
| Meal plans | Missing | ❌ |
| AI meal generator | Missing | ❌ |
| AI assistant | Dead code only | ❌ |
| Notifications | Missing | ❌ |
| Responsive UI | Partial — auth screens good, rest fixed-width | ❌ |
| Accessibility | Missing — zero a11y props in repo | ❌ |
| Performance | Poor in exercise/store paths | ❌ |
| Security | Unverifiable RLS + IDOR-pattern queries + exposed AI key | ❌ |
| Database/RLS | **Backend unreachable** | ❌ |
| Testing | None | ❌ |
| Production build | Typecheck passes (strict off); build untested | ❌ |
