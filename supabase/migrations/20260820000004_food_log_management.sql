-- Fitness-Meshantanu — Phase 4: nutrition completion.
-- Removing a logged food must delete the food_log row AND decrement the
-- day's daily_nutrition totals in one transaction.

create or replace function public.remove_food_log_entry(
  p_id uuid
) returns public.daily_nutrition
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_food food_log;
  v_row daily_nutrition;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from food_log
  where id = p_id and user_id = v_uid
  returning * into v_food;

  if v_food.id is null then
    raise exception 'food entry not found';
  end if;

  update daily_nutrition as dn
  set calories_consumed = greatest(0, dn.calories_consumed - coalesce(v_food.calories, 0)),
      protein_consumed  = greatest(0, dn.protein_consumed  - coalesce(v_food.protein, 0)),
      carbs_consumed    = greatest(0, dn.carbs_consumed    - coalesce(v_food.carbs, 0)),
      fats_consumed     = greatest(0, dn.fats_consumed     - coalesce(v_food.fats, 0))
  where dn.user_id = v_uid and dn.date = v_food.date
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.remove_food_log_entry(uuid) to authenticated;
