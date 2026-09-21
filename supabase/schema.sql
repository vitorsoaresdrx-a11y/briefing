-- SISTEMA DE BRIEFING — schema do Supabase
-- Como aplicar: Supabase Dashboard → SQL Editor → New query → cole este
-- arquivo inteiro → Run. Rode de novo após alterações (é idempotente).

create extension if not exists pgcrypto;

do $$ begin
  create type briefing_status as enum ('rascunho', 'em_andamento', 'concluido');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type transcript_status as enum ('pendente', 'processando', 'concluido', 'erro');
exception when duplicate_object then null;
end $$;

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  client_name text,
  client_email text,
  client_whatsapp text,
  company text,
  project_type text,
  niche text,
  status briefing_status not null default 'rascunho',
  current_step text,
  answers jsonb not null default '{}'::jsonb,
  completeness int not null default 0 check (completeness between 0 and 100),
  pending_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  viewed_at timestamptz
);

create table if not exists public.briefing_files (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  kind text not null default 'outro',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.briefing_audios (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  question_id text not null,
  storage_path text not null,
  mime_type text,
  duration_seconds int,
  transcript text,
  transcript_status transcript_status not null default 'pendente',
  transcript_error text,
  created_at timestamptz not null default now()
);

create index if not exists briefings_status_created_idx on public.briefings (status, created_at desc);
create index if not exists briefing_files_briefing_idx on public.briefing_files (briefing_id);
create index if not exists briefing_audios_briefing_question_idx on public.briefing_audios (briefing_id, question_id);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists briefings_updated_at on public.briefings;
create trigger briefings_updated_at before update on public.briefings
for each row execute function public.set_updated_at();

-- RLS: ligado e SEM policies = anon/authenticated não acessam nada.
-- Todo acesso passa por rotas do servidor com a service role (que ignora RLS).
alter table public.briefings enable row level security;
alter table public.briefing_files enable row level security;
alter table public.briefing_audios enable row level security;

-- Buckets privados
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('briefing-audios', 'briefing-audios', false, 26214400),
  ('briefing-files',  'briefing-files',  false, 20971520)
on conflict (id) do nothing;
