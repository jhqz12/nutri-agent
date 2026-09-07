create table if not exists public.nutrition_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_state enable row level security;

drop policy if exists "nutrition_state_select_own" on public.nutrition_state;
create policy "nutrition_state_select_own"
on public.nutrition_state for select
using (auth.uid() = user_id);

drop policy if exists "nutrition_state_insert_own" on public.nutrition_state;
create policy "nutrition_state_insert_own"
on public.nutrition_state for insert
with check (auth.uid() = user_id);

drop policy if exists "nutrition_state_update_own" on public.nutrition_state;
create policy "nutrition_state_update_own"
on public.nutrition_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_state_delete_own" on public.nutrition_state;
create policy "nutrition_state_delete_own"
on public.nutrition_state for delete
using (auth.uid() = user_id);
