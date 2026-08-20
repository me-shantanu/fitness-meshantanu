-- Fitness-Meshantanu — Phase 2: atomic server-side operations.
-- Replaces the client-side multi-request sequences (non-atomic plan creation,
-- check-then-write PR detection, read-modify-write nutrition accumulation,
-- template mutation on activate) with transactional RPCs.
-- All functions are SECURITY INVOKER, so RLS still applies to every table access.

-- ============ create_weekly_plan: plan + days + exercises in one transaction ============
create or replace function public.create_weekly_plan(
  p_name text,
  p_description text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_is_template boolean default false,
  p_days jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan_id uuid;
  v_day_id uuid;
  d jsonb;
  e jsonb;
  v_order int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'plan name is required';
  end if;

  -- Only a real plan deactivates the others; templates never do.
  if not p_is_template then
    update workout_plans set is_active = false
    where user_id = v_uid and is_active = true;
  end if;

  insert into workout_plans (user_id, name, description, start_date, end_date, is_active, is_template)
  values (v_uid, trim(p_name), p_description, p_start_date, p_end_date, not p_is_template, p_is_template)
  returning id into v_plan_id;

  for d in select * from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    insert into workout_days (plan_id, day_of_week, name, is_rest_day)
    values (
      v_plan_id,
      (d->>'day_of_week')::int,
      coalesce(d->>'name', ''),
      coalesce((d->>'is_rest_day')::boolean, false)
    )
    returning id into v_day_id;

    v_order := 0;
    for e in select * from jsonb_array_elements(coalesce(d->'exercises', '[]'::jsonb)) loop
      insert into planned_exercises
        (workout_day_id, user_id, exercise_id, exercise_name, exercise_type,
         target_sets, target_reps, target_weight, target_duration, notes, order_index)
      values (
        v_day_id,
        v_uid,
        e->>'exercise_id',
        coalesce(nullif(trim(e->>'exercise_name'), ''), 'Exercise'),
        e->>'exercise_type',
        nullif(e->>'target_sets', '')::int,
        nullif(e->>'target_reps', '')::int,
        nullif(e->>'target_weight', '')::numeric,
        nullif(e->>'target_duration', '')::int,
        e->>'notes',
        coalesce(nullif(e->>'order_index', '')::int, v_order)
      );
      v_order := v_order + 1;
    end loop;
  end loop;

  return v_plan_id;
end;
$$;

-- ============ activate_template: CLONE the template into a fresh active plan ============
-- (The old client code mutated the template row in place, corrupting the template.)
create or replace function public.activate_template(
  p_template_id uuid,
  p_start_date date default null,
  p_end_date date default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_plan uuid;
  r_day record;
  v_new_day uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from workout_plans
  where id = p_template_id and user_id = v_uid and is_template = true;
  if not found then
    raise exception 'template not found';
  end if;

  update workout_plans set is_active = false
  where user_id = v_uid and is_active = true;

  insert into workout_plans (user_id, name, description, start_date, end_date, is_active, is_template)
  select user_id, name, description,
         coalesce(p_start_date, current_date),
         p_end_date,
         true, false
  from workout_plans where id = p_template_id
  returning id into v_new_plan;

  for r_day in
    select id, day_of_week, name, is_rest_day
    from workout_days where plan_id = p_template_id
  loop
    insert into workout_days (plan_id, day_of_week, name, is_rest_day)
    values (v_new_plan, r_day.day_of_week, r_day.name, r_day.is_rest_day)
    returning id into v_new_day;

    insert into planned_exercises
      (workout_day_id, user_id, exercise_id, exercise_name, exercise_type,
       target_sets, target_reps, target_weight, target_duration, notes, order_index)
    select v_new_day, v_uid, exercise_id, exercise_name, exercise_type,
           target_sets, target_reps, target_weight, target_duration, notes, order_index
    from planned_exercises where workout_day_id = r_day.id;
  end loop;

  return v_new_plan;
end;
$$;

-- ============ log_exercise_set: set insert + race-free conditional PR upsert ============
create or replace function public.log_exercise_set(
  p_session_id uuid,
  p_planned_exercise_id uuid default null,
  p_exercise_id text default null,
  p_exercise_name text default null,
  p_set_number int default 1,
  p_reps int default 0,
  p_weight numeric default null,
  p_duration int default null,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_pr boolean := false;
  v_set exercise_sets;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from workout_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'session not found';
  end if;

  if p_exercise_id is not null and p_weight is not null and p_weight > 0 then
    -- Atomic conditional upsert: the RETURNING row exists only when the
    -- insert happened or the conditional update actually ran (i.e. a real PR).
    insert into personal_records as pr
      (user_id, exercise_id, exercise_name, max_weight, max_reps, achieved_at, session_id)
    values (v_uid, p_exercise_id, p_exercise_name, p_weight, p_reps, now(), p_session_id)
    on conflict (user_id, exercise_id) do update
      set max_weight = excluded.max_weight,
          max_reps = excluded.max_reps,
          exercise_name = excluded.exercise_name,
          achieved_at = excluded.achieved_at,
          session_id = excluded.session_id
      where excluded.max_weight > coalesce(pr.max_weight, 0)
    returning true into v_is_pr;
    v_is_pr := coalesce(v_is_pr, false);
  end if;

  insert into exercise_sets
    (session_id, planned_exercise_id, exercise_id, exercise_name,
     set_number, reps, weight, duration, notes, is_pr)
  values
    (p_session_id, p_planned_exercise_id, p_exercise_id, p_exercise_name,
     p_set_number, p_reps, p_weight, p_duration, p_notes, v_is_pr)
  returning * into v_set;

  return to_jsonb(v_set);
end;
$$;

-- ============ increment_daily_nutrition: atomic get-or-create + accumulate ============
create or replace function public.increment_daily_nutrition(
  p_date date,
  p_calories numeric default 0,
  p_protein numeric default 0,
  p_carbs numeric default 0,
  p_fats numeric default 0,
  p_water_ml int default 0,
  p_calories_burned int default 0,
  p_target_calories int default null,
  p_target_protein numeric default null,
  p_target_carbs numeric default null,
  p_target_fats numeric default null
) returns daily_nutrition
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row daily_nutrition;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into daily_nutrition as dn
    (user_id, date,
     target_calories, target_protein, target_carbs, target_fats,
     calories_consumed, protein_consumed, carbs_consumed, fats_consumed,
     water_intake_ml, calories_burned)
  values
    (v_uid, p_date,
     p_target_calories, p_target_protein, p_target_carbs, p_target_fats,
     greatest(0, coalesce(p_calories, 0)), greatest(0, coalesce(p_protein, 0)),
     greatest(0, coalesce(p_carbs, 0)), greatest(0, coalesce(p_fats, 0)),
     greatest(0, coalesce(p_water_ml, 0)), greatest(0, coalesce(p_calories_burned, 0)))
  on conflict (user_id, date) do update
    set calories_consumed = greatest(0, dn.calories_consumed + coalesce(excluded.calories_consumed, 0)),
        protein_consumed  = greatest(0, dn.protein_consumed  + coalesce(excluded.protein_consumed, 0)),
        carbs_consumed    = greatest(0, dn.carbs_consumed    + coalesce(excluded.carbs_consumed, 0)),
        fats_consumed     = greatest(0, dn.fats_consumed     + coalesce(excluded.fats_consumed, 0)),
        water_intake_ml   = greatest(0, dn.water_intake_ml   + coalesce(excluded.water_intake_ml, 0)),
        calories_burned   = greatest(0, dn.calories_burned   + coalesce(excluded.calories_burned, 0)),
        target_calories   = coalesce(dn.target_calories, excluded.target_calories),
        target_protein    = coalesce(dn.target_protein,  excluded.target_protein),
        target_carbs      = coalesce(dn.target_carbs,    excluded.target_carbs),
        target_fats       = coalesce(dn.target_fats,     excluded.target_fats)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============ complete_workout_session: once-only completion + calorie rollup ============
create or replace function public.complete_workout_session(
  p_session_id uuid,
  p_calories_burned int default 0
) returns workout_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sess workout_sessions;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update workout_sessions
  set completed_at = now(),
      total_calories_burned = greatest(0, coalesce(p_calories_burned, 0))
  where id = p_session_id and user_id = v_uid and completed_at is null
  returning * into v_sess;

  if v_sess.id is null then
    -- Already completed (or not this user's): return current state, change nothing.
    select * into v_sess from workout_sessions
    where id = p_session_id and user_id = v_uid;
    return v_sess;
  end if;

  -- Roll burned calories into the day's nutrition row.
  perform increment_daily_nutrition(
    v_sess.date,
    0, 0, 0, 0, 0,
    greatest(0, coalesce(p_calories_burned, 0))
  );

  return v_sess;
end;
$$;

grant execute on function
  public.create_weekly_plan(text, text, date, date, boolean, jsonb),
  public.activate_template(uuid, date, date),
  public.log_exercise_set(uuid, uuid, text, text, int, int, numeric, int, text),
  public.increment_daily_nutrition(date, numeric, numeric, numeric, numeric, int, int, int, numeric, numeric, numeric),
  public.complete_workout_session(uuid, int)
to authenticated;
