-- =============================================================================
-- 0002 — Governança: perfis, preferências, auditoria e consentimento LGPD
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles — extensão 1:1 de auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  full_name           text not null default '',
  role                public.user_role not null default 'viewer',
  job_title           text,
  department          text,
  phone               text,
  avatar_url          text,
  plant_id            uuid,                       -- FK adicionada em 0003
  two_factor_enabled  boolean not null default false,
  is_active           boolean not null default true,
  last_login_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_email_key unique (email)
);

comment on table public.profiles is 'Perfil de aplicação espelhando auth.users; fonte da verdade do RBAC.';

create index if not exists profiles_role_idx     on public.profiles (role);
create index if not exists profiles_plant_id_idx on public.profiles (plant_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_settings — preferências de UI persistidas por usuário
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  dark_mode               boolean not null default true,
  primary_color           text    not null default 'orange',
  language                text    not null default 'pt',
  sidebar_open            boolean not null default true,
  max_alerts_display      integer not null default 10,
  dashboard_refresh_ms    integer not null default 5000,
  notify_email            boolean not null default true,
  notify_critical_only    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint user_settings_primary_color_check check (primary_color in ('orange', 'purple')),
  constraint user_settings_language_check      check (language in ('pt', 'en')),
  constraint user_settings_refresh_check       check (dashboard_refresh_ms between 1000 and 300000),
  constraint user_settings_max_alerts_check    check (max_alerts_display between 1 and 100)
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Provisionamento automático a partir de auth.users
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.user_role;
begin
  -- O papel pode vir de raw_user_meta_data.role no momento do convite/signup.
  begin
    v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'viewer');
  exception when others then
    v_role := 'viewer';
  end;

  insert into public.profiles (id, email, full_name, role, job_title, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data ->> 'job_title',
    new.raw_user_meta_data ->> 'department'
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém e-mail sincronizado quando alterado no Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Helpers de RBAC — SECURITY DEFINER para não recursar nas policies de profiles
-- -----------------------------------------------------------------------------
-- Nome evita a palavra reservada CURRENT_ROLE.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(variadic p_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and role = any(p_roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

-- Pode escrever dados operacionais (ativos, alertas, manutenção).
create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin', 'engineer', 'technician');
$$;

-- Qualquer usuário ativo autenticado pode ler o acervo operacional.
create or replace function public.can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

-- -----------------------------------------------------------------------------
-- audit_logs — trilha de auditoria (Módulo 6 / requisito regulatório)
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_email  text,
  action       text not null,               -- insert | update | delete | login | export | ...
  entity_type  text not null,
  entity_id    text,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx       on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx      on public.audit_logs (entity_type, entity_id);

-- Trigger genérico anexável a qualquer tabela que exija rastreabilidade.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id text;
  v_email     text;
begin
  v_entity_id := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    null
  );

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    v_email,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- -----------------------------------------------------------------------------
-- lgpd_consents — consentimento explícito e revogação
-- -----------------------------------------------------------------------------
create table if not exists public.lgpd_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  consent_type    public.consent_type not null,
  granted         boolean not null default false,
  policy_version  text not null default '1.0',
  granted_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint lgpd_consents_unique unique (user_id, consent_type, policy_version)
);

create index if not exists lgpd_consents_user_idx on public.lgpd_consents (user_id);

drop trigger if exists lgpd_consents_set_updated_at on public.lgpd_consents;
create trigger lgpd_consents_set_updated_at
  before update on public.lgpd_consents
  for each row execute function public.set_updated_at();
