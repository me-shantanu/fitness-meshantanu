# LiftLab (fitness-meshantanu)

A full-stack fitness app: workout planning & live session tracking, personal
records, body-weight & progress tracking, nutrition targets + food logging,
and an AI coach — built with Expo (iOS / Android / Web) and Supabase.

## Features

- **Workout plans** — build weekly plans, use starter templates, or let the
  AI coach generate one; quick add-to-plan from a searchable exercise library
  (wger.de) with images, videos, and YouTube tutorials
- **Live sessions** — set-by-set logging with smart prefill, rest timer,
  automatic PR detection, resume after interruption
- **Progress** — body-weight log (auto-syncs profile + recalculates BMR),
  streaks, volume charts, PR list with deep links to the achieving session
- **Nutrition** — BMR/TDEE-based calorie & macro targets, meal-typed food
  log with atomic edits, water tracking, day-by-day history
- **AI Coach** — Gemini-powered chat (server-side key, RLS-scoped context),
  structured workout-plan generation with one-tap adoption
- **Theming** — light / dark / system with persistent preference

## Stack

Expo SDK 54 · expo-router · React Native 0.81 · NativeWind (Tailwind) ·
Zustand · Supabase (Postgres + RLS + Edge Functions) · Google Gemini

## Setup

### 1. Install

```sh
npm install
```

### 2. Supabase project

1. Create a project at https://supabase.com/dashboard
2. Run every file in `supabase/migrations/` **in filename order** via the
   SQL Editor (tables, RLS policies, triggers, and the atomic RPCs)
3. (Optional) Authentication → Providers → Email: decide whether to require
   email confirmation

### 3. Environment

```sh
cp .env.example .env.local
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(Project Settings → API). The anon key is safe to ship — RLS is the
security boundary; never put the `service_role` key anywhere in this repo.

### 4. AI coach (optional but recommended)

1. Get a free Gemini API key: https://aistudio.google.com/apikey
2. Dashboard → Edge Functions → deploy a function named `ai-chat` with the
   contents of `supabase/functions/ai-chat/index.ts`
3. Add Edge Function secrets:
   - `GEMINI_API_KEY` — your key
   - `GEMINI_MODEL` — `gemini-flash-latest` (rolling alias; survives model
     retirements)

The function authenticates callers with their own JWT and queries the
database through RLS, so the AI can only ever see the requesting user's
data. The key never reaches the client bundle.

### 5. Run

```sh
npm run web        # web dev server
npm run android    # Android (Expo Go / dev build)
npm run ios        # iOS
```

> After changing `tailwind.config.js` or `src/theme/*`, restart the dev
> server with a cleared cache: `npx expo start --web -c` — NativeWind
> compiles color classes at bundle time.

## Checks

```sh
npm run typecheck            # TypeScript (strict-enough; 0 errors expected)
npx expo export -p web       # production web build
```

## Deploy (web)

```sh
npm run deploy               # expo export -p web + EAS Hosting
```

## Architecture notes

- **All writes that span rows are atomic RPCs** (`create_weekly_plan`,
  `activate_template` (clones), `log_exercise_set` (race-free PR upsert),
  `complete_workout_session` (idempotent + calorie rollup),
  `increment_daily_nutrition`, `remove_food_log_entry`, `log_body_weight`
  (syncs profile weight + recomputes BMR)). Client code never does
  check-then-write against these tables.
- **RLS on every table**; client queries are additionally user-scoped as
  defense in depth.
- **Web + native parity**: user-facing dialogs must use `showAlert`
  (`src/utils/alert.ts`) — React Native's `Alert.alert` is a silent no-op
  on web.
- Exercise catalogue comes from the public wger.de API (fulltext search via
  the `name__search` filter; the legacy `/exercise/search/` and
  `/exercisevideo/` endpoints were removed upstream).
- Theme tokens live in `src/theme/colors.ts` (RGB triplets consumed as CSS
  variables); changing the palette is a one-file edit.
