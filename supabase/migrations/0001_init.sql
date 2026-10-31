-- ============================================================
-- 知序 Zhixu — Supabase/PostgreSQL 初始化迁移
-- 与本地 SQLite 结构保持一致；生产环境使用 Supabase Auth + RLS。
-- 执行方式：在 Supabase SQL Editor 中运行，或 `supabase db push`。
-- ============================================================

-- ---------- 扩展 ----------
create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '学习者',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 注册用户时自动创建 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', '学习者'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- courses ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_courses_owner on public.courses(owner_id);

-- ---------- documents ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  filename text not null,
  storage_path text,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status text not null default 'pending'
    check (status in ('pending','parsing','extracting','completed','failed')),
  page_count int,
  chunk_count int,
  parse_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_documents_course on public.documents(course_id);

-- ---------- document_chunks ----------
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  chunk_index int not null,
  page_start int,
  page_end int,
  section text,
  created_at timestamptz not null default now()
);
create index if not exists idx_chunks_document on public.document_chunks(document_id);

-- ---------- knowledge_nodes ----------
create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  definition text,
  detail text,
  chapter text,
  difficulty int not null default 3 check (difficulty between 1 and 5),
  source_document_id uuid references public.documents(id) on delete set null,
  source_page int,
  confidence real not null default 0.5,
  verified boolean not null default false,
  mastery_status text not null default 'untouched'
    check (mastery_status in ('mastered','learning','review','untouched')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_nodes_course on public.knowledge_nodes(course_id);
create index if not exists idx_nodes_name on public.knowledge_nodes(course_id, name);

-- ---------- knowledge_edges ----------
create table if not exists public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  relation_type text not null check (relation_type in ('prerequisite','related','contains','example_of')),
  evidence text,
  confidence real not null default 0.5,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_edges_course on public.knowledge_edges(course_id);
create index if not exists idx_edges_source on public.knowledge_edges(source_node_id);
create index if not exists idx_edges_target on public.knowledge_edges(target_node_id);

-- ---------- learning_records ----------
create table if not exists public.learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  node_id uuid references public.knowledge_nodes(id) on delete set null,
  action_type text not null,
  detail text,
  score real,
  created_at timestamptz not null default now()
);
create index if not exists idx_records_course on public.learning_records(course_id, user_id);

-- ---------- quizzes ----------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  node_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_quizzes_course on public.quizzes(course_id);

-- ---------- quiz_questions ----------
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  type text not null check (type in ('single','multiple','true_false','short_answer','code')),
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  answer text not null,
  explanation text not null default '',
  node_id uuid references public.knowledge_nodes(id) on delete set null,
  difficulty int not null default 3 check (difficulty between 1 and 5)
);
create index if not exists idx_questions_quiz on public.quiz_questions(quiz_id);

-- ---------- quiz_attempts ----------
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score real not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_attempts_quiz on public.quiz_attempts(quiz_id);

-- ---------- learning_paths ----------
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_paths_course on public.learning_paths(course_id, user_id);

-- ---------- learning_path_items ----------
create table if not exists public.learning_path_items (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  order_index int not null,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','skipped')),
  completed_at timestamptz
);
create index if not exists idx_path_items_path on public.learning_path_items(path_id);

-- ---------- chat_sessions ----------
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sessions_course on public.chat_sessions(course_id, user_id);

-- ---------- chat_messages ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  node_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_session on public.chat_messages(session_id);

-- ============================================================
-- Row Level Security —— 用户只能访问自己的课程及其私有资料
-- ============================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.knowledge_nodes enable row level security;
alter table public.knowledge_edges enable row level security;
alter table public.learning_records enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_items enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- courses
drop policy if exists "courses_all_own" on public.courses;
create policy "courses_all_own" on public.courses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 辅助：判断某课程是否属于当前用户
create or replace function public.owns_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = cid and owner_id = auth.uid());
$$;

-- documents
drop policy if exists "documents_own_course" on public.documents;
create policy "documents_own_course" on public.documents
  for all using (public.owns_course(course_id)) with check (public.owns_course(course_id));

-- document_chunks
drop policy if exists "chunks_own_course" on public.document_chunks;
create policy "chunks_own_course" on public.document_chunks
  for all using (
    exists (select 1 from public.documents d where d.id = document_id and public.owns_course(d.course_id))
  ) with check (
    exists (select 1 from public.documents d where d.id = document_id and public.owns_course(d.course_id))
  );

-- knowledge_nodes
drop policy if exists "nodes_own_course" on public.knowledge_nodes;
create policy "nodes_own_course" on public.knowledge_nodes
  for all using (public.owns_course(course_id)) with check (public.owns_course(course_id));

-- knowledge_edges
drop policy if exists "edges_own_course" on public.knowledge_edges;
create policy "edges_own_course" on public.knowledge_edges
  for all using (public.owns_course(course_id)) with check (public.owns_course(course_id));

-- learning_records
drop policy if exists "records_own" on public.learning_records;
create policy "records_own" on public.learning_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quizzes
drop policy if exists "quizzes_own_course" on public.quizzes;
create policy "quizzes_own_course" on public.quizzes
  for all using (public.owns_course(course_id)) with check (public.owns_course(course_id));

-- quiz_questions
drop policy if exists "questions_own_course" on public.quiz_questions;
create policy "questions_own_course" on public.quiz_questions
  for all using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and public.owns_course(q.course_id))
  ) with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and public.owns_course(q.course_id))
  );

-- quiz_attempts
drop policy if exists "attempts_own" on public.quiz_attempts;
create policy "attempts_own" on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- learning_paths
drop policy if exists "paths_own" on public.learning_paths;
create policy "paths_own" on public.learning_paths
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- learning_path_items
drop policy if exists "path_items_own" on public.learning_path_items;
create policy "path_items_own" on public.learning_path_items
  for all using (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = auth.uid())
  );

-- chat_sessions
drop policy if exists "sessions_own" on public.chat_sessions;
create policy "sessions_own" on public.chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_messages
drop policy if exists "messages_own" on public.chat_messages;
create policy "messages_own" on public.chat_messages
  for all using (
    exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
