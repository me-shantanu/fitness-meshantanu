-- Fitness-Meshantanu — Phase 3: body-weight tracking.
-- One row per user per day (upsert), plus an RPC that keeps profiles.weight
-- current and recomputes profiles.bmr (Mifflin-St Jeor) so nutrition targets
-- never run on a stale weight (audit bug N3).

create table if not exists public.body_weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight numeric not null check (weight > 20 and weight < 500), -- kg
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists body_weight_log_user_date_idx
  on public.body_weight_log (user_id, date desc);

alter table public.body_weight_log enable row level security;

drop policy if exists "body_weight_log_all_own" on public.body_weight_log;
create policy "body_weight_log_all_own" on public.body_weight_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.log_body_weight(
  p_weight numeric,
  p_date date default null,
  p_notes text default null
) returns public.body_weight_log
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := coalesce(p_date, current_date);
  v_row body_weight_log;
  v_latest date;
  v_profile profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_weight is null or p_weight <= 20 or p_weight >= 500 then
    raise exception 'weight must be between 20 and 500 kg';
  end if;

  insert into body_weight_log as bw (user_id, date, weight, notes)
  values (v_uid, v_date, p_weight, p_notes)
  on conflict (user_id, date) do update
    set weight = excluded.weight,
        notes = coalesce(excluded.notes, bw.notes)
  returning * into v_row;

  -- Keep the profile in sync only when this entry is the newest one.
  select max(date) into v_latest from body_weight_log where user_id = v_uid;
  if v_date = v_latest then
    select * into v_profile from profiles where id = v_uid;
    update profiles
    set weight = p_weight,
        -- Recompute BMR when we have the inputs; otherwise leave it.
        bmr = case
          when v_profile.height is not null and v_profile.age is not null then
            round(
              10 * p_weight + 6.25 * v_profile.height - 5 * v_profile.age
              + case
                  when v_profile.gender = 'male' then 5
                  when v_profile.gender = 'female' then -161
                  else -78
                end
            )
          else v_profile.bmr
        end,
        updated_at = now()
    where id = v_uid;
  end if;

  return v_row;
end;
$$;

grant execute on function public.log_body_weight(numeric, date, text) to authenticated;
