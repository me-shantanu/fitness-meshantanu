-- Fitness-Meshantanu — initial schema, reconstructed 2026-08-19 from application code.
-- The original hosted project (ttoauublnprcdgvumrpj) is paused/deleted; this migration
-- recreates the 10 tables the app queries, plus the constraints the code assumes:
--   UNIQUE(user_id, exercise_id) on personal_records and favorite_exercises,
--   UNIQUE(user_id, date) on daily_nutrition,
--   ON DELETE CASCADE down the plan hierarchy, and RLS on every table.
-- If the old project is restored instead, diff its schema against this file.

-- ============================= profiles =============================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  height numeric,          -- cm
  weight numeric,          -- kg
  age integer check (age is null or age between 5 and 120),
  gender text check (gender is null or gender in ('male', 'female', 'other')),
  bmr numeric,
  goal text check (goal is null or goal in ('lose_weight', 'gain_muscle', 'maintain')),
  activity_level text check (activity_level is null or activity_level in
    ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row on signup (authStore.signUp waits for this trigger).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================ workout_plans =========================
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  is_template boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists workout_plans_user_idx on public.workout_plans (user_id, is_active);

-- ============================ workout_days ==========================
create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Monday (app convention)
  name text,
  is_rest_day boolean not null default false
);
create index if not exists workout_days_plan_idx on public.workout_days (plan_id);

-- ========================== planned_exercises =======================
create table if not exists public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade, -- written by some paths only
  exercise_id text,        -- wger numeric id as text, or 'warmup_N'/'cooldown_N'
  exercise_name text not null,
  exercise_type text,
  target_sets integer,
  target_reps integer,
  target_weight numeric,
  target_duration integer, -- seconds, for cardio
  notes text,
  order_index integer not null default 0
);
create index if not exists planned_exercises_day_idx on public.planned_exercises (workout_day_id);

-- ========================== workout_sessions ========================
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_day_id uuid references public.workout_days (id) on delete set null,
  date date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_calories_burned integer not null default 0,
  notes text
);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, date desc);
create index if not exists workout_sessions_day_idx on public.workout_sessions (workout_day_id);

-- ============================ exercise_sets =========================
create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  planned_exercise_id uuid references public.planned_exercises (id) on delete set null,
  exercise_id text,
  exercise_name text,
  set_number integer,
  reps integer,
  weight numeric,
  duration integer,
  notes text,
  is_pr boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists exercise_sets_session_idx on public.exercise_sets (session_id);

-- =========================== personal_records =======================
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  exercise_name text,
  max_weight numeric,
  max_reps integer,
  achieved_at timestamptz not null default now(),
  session_id uuid references public.workout_sessions (id) on delete set null,
  unique (user_id, exercise_id)
);

-- ========================== favorite_exercises ======================
create table if not exists public.favorite_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  exercise_name text,
  exercise_type text check (exercise_type in ('workout', 'warmup', 'cooldown')),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

-- ============================ daily_nutrition =======================
create table if not exists public.daily_nutrition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  target_calories integer,
  target_protein numeric,
  target_carbs numeric,
  target_fats numeric,
  calories_consumed numeric not null default 0,
  protein_consumed numeric not null default 0,
  carbs_consumed numeric not null default 0,
  fats_consumed numeric not null default 0,
  water_intake_ml integer not null default 0,
  calories_burned integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

drop trigger if exists daily_nutrition_updated_at on public.daily_nutrition;
create trigger daily_nutrition_updated_at
  before update on public.daily_nutrition
  for each row execute function public.set_updated_at();

-- =============================== food_log ===========================
create table if not exists public.food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  food_name text not null,
  calories integer not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fats numeric not null default 0,
  serving_size text,
  meal_type text not null default 'snack'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz not null default now()
);
create index if not exists food_log_user_date_idx on public.food_log (user_id, date desc);

-- ========================= Row Level Security =======================
alter table public.profiles           enable row level security;
alter table public.workout_plans      enable row level security;
alter table public.workout_days       enable row level security;
alter table public.planned_exercises  enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.exercise_sets      enable row level security;
alter table public.personal_records   enable row level security;
alter table public.favorite_exercises enable row level security;
alter table public.daily_nutrition    enable row level security;
alter table public.food_log           enable row level security;

-- profiles: owner only (insert handled by security-definer trigger)
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- direct user_id-owned tables
create policy "workout_plans_all_own" on public.workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sessions_all_own" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_records_all_own" on public.personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorite_exercises_all_own" on public.favorite_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_nutrition_all_own" on public.daily_nutrition
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "food_log_all_own" on public.food_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- workout_days: ownership via parent plan
create policy "workout_days_all_own" on public.workout_days
  for all using (
    exists (select 1 from public.workout_plans p
            where p.id = workout_days.plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_plans p
            where p.id = workout_days.plan_id and p.user_id = auth.uid())
  );

-- planned_exercises: ownership via day -> plan
create policy "planned_exercises_all_own" on public.planned_exercises
  for all using (
    exists (select 1 from public.workout_days d
            join public.workout_plans p on p.id = d.plan_id
            where d.id = planned_exercises.workout_day_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_days d
            join public.workout_plans p on p.id = d.plan_id
            where d.id = planned_exercises.workout_day_id and p.user_id = auth.uid())
  );

-- exercise_sets: ownership via session
create policy "exercise_sets_all_own" on public.exercise_sets
  for all using (
    exists (select 1 from public.workout_sessions s
            where s.id = exercise_sets.session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_sessions s
            where s.id = exercise_sets.session_id and s.user_id = auth.uid())
  );
