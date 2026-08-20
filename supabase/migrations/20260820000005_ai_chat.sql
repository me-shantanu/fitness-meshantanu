-- Fitness-Meshantanu — Phase 5: AI assistant conversation persistence.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx
  on public.ai_messages (conversation_id, created_at asc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "ai_conversations_all_own" on public.ai_conversations;
create policy "ai_conversations_all_own" on public.ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_messages_all_own" on public.ai_messages;
create policy "ai_messages_all_own" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();
