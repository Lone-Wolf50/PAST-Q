-- ─── AI Conversation History Tables ──────────────────────────────────────────
-- Run this once in the Supabase SQL Editor.
-- Conversations auto-expire after 7 days (enforced by query filter on expires_at).

-- 1. Conversations (one row per chat session)
create table if not exists upsa_ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references upsa_users(id) on delete cascade,
  title           text not null default 'New Conversation',
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days')
);

alter table upsa_ai_conversations enable row level security;

create policy "users manage own conversations"
  on upsa_ai_conversations for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Index for fast per-user lookups
create index if not exists idx_ai_conversations_user
  on upsa_ai_conversations (user_id, last_message_at desc);

-- 2. Messages (one row per message in a session)
create table if not exists upsa_ai_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references upsa_ai_conversations(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  created_at        timestamptz not null default now()
);

alter table upsa_ai_messages enable row level security;

create policy "users manage own messages"
  on upsa_ai_messages for all
  using (
    conversation_id in (
      select id from upsa_ai_conversations where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from upsa_ai_conversations where user_id = auth.uid()
    )
  );

-- Index for fast message retrieval per conversation
create index if not exists idx_ai_messages_conversation
  on upsa_ai_messages (conversation_id, created_at asc);
