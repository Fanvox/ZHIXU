-- ============================================================
-- 知序 Zhixu — 用户 AI 配置（界面化配置，覆盖环境变量默认值）
-- 说明：本地登录相关的 sessions / profiles.password_hash 由本地模式处理，
--       生产环境使用 Supabase Auth 负责身份认证，无需这两张表。
-- ============================================================

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  ai_api_key text,
  ai_base_url text,
  ai_model text,
  ai_extract_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_own" on public.user_settings;
create policy "user_settings_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
