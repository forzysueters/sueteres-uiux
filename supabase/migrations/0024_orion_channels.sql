-- =============================================================================
-- 0024 — Canais do Órion: WhatsApp e avisos de alerta por e-mail/WhatsApp
--
-- ARQUITETURA PRONTA, DESLIGADA POR PADRÃO
--
-- Tudo aqui é inerte até alguém configurar os provedores: o trigger enfileira,
-- mas nada sai enquanto `orion_notify_config.enabled = false` e as Edge
-- Functions não tiverem os secrets (Brevo / WhatsApp Cloud API).
--
--   alerts INSERT ──trigger──▶ orion_notifications (fila, 1 linha por pessoa+canal)
--   pg_cron 1 min ──pg_net──▶ Edge Function orion-notify ──▶ Brevo / Meta
--   Meta webhook ────────────▶ Edge Function whatsapp-webhook ──▶ _shared/orion.ts
--
-- Para ligar:
--   update public.orion_notify_config
--      set enabled = true,
--          function_url = 'https://<ref>.supabase.co/functions/v1/orion-notify',
--          secret = '<mesmo valor do secret ORION_NOTIFY_SECRET>';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Vínculo do WhatsApp no perfil
--
-- `profiles.phone` é contato livre de cadastro; o número que AUTENTICA uma
-- conversa com o Órion é outro campo, normalizado em E.164 só com dígitos (o
-- formato que a Meta entrega em `from`) e único — dois perfis com o mesmo
-- número tornariam a identidade ambígua.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists whatsapp_phone     text,
  add column if not exists whatsapp_opt_in    boolean not null default false,
  add column if not exists whatsapp_opt_in_at timestamptz;

do $$ begin
  alter table public.profiles
    add constraint profiles_whatsapp_phone_format check (whatsapp_phone ~ '^[1-9][0-9]{11,14}$');
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_whatsapp_phone_key
  on public.profiles (whatsapp_phone) where whatsapp_phone is not null;

create or replace function public.stamp_whatsapp_opt_in()
returns trigger
language plpgsql
as $$
begin
  if new.whatsapp_opt_in and not coalesce(old.whatsapp_opt_in, false) then
    new.whatsapp_opt_in_at := now();
  end if;
  -- Trocar o número desfaz o consentimento: o aceite foi dado para o número antigo.
  if old.whatsapp_phone is distinct from new.whatsapp_phone and new.whatsapp_opt_in = old.whatsapp_opt_in then
    new.whatsapp_opt_in := false;
    new.whatsapp_opt_in_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_whatsapp_opt_in on public.profiles;
create trigger profiles_whatsapp_opt_in
  before update of whatsapp_phone, whatsapp_opt_in on public.profiles
  for each row execute function public.stamp_whatsapp_opt_in();

alter table public.user_settings
  add column if not exists notify_whatsapp boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. Sessões e trilha de entrada do WhatsApp (só a service role toca)
-- -----------------------------------------------------------------------------
create table if not exists public.whatsapp_sessions (
  phone           text primary key,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete set null,
  -- Última mensagem RECEBIDA: marca a janela de 24 h da Meta para texto livre.
  last_inbound_at timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists whatsapp_sessions_profile_idx on public.whatsapp_sessions (profile_id);

drop trigger if exists whatsapp_sessions_set_updated_at on public.whatsapp_sessions;
create trigger whatsapp_sessions_set_updated_at
  before update on public.whatsapp_sessions
  for each row execute function public.set_updated_at();

-- Chave = id da mensagem na Meta: reenvio do webhook não gera resposta dupla.
create table if not exists public.whatsapp_inbound_log (
  message_id   text primary key,
  phone        text not null,
  message_type text not null,
  status       text not null default 'received',
  detail       text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists whatsapp_inbound_log_phone_idx on public.whatsapp_inbound_log (phone, received_at desc);

-- -----------------------------------------------------------------------------
-- 3. Fila de avisos
-- -----------------------------------------------------------------------------
create table if not exists public.orion_notifications (
  id                  bigint generated always as identity primary key,
  alert_id            uuid not null references public.alerts(id) on delete cascade,
  asset_id            uuid not null references public.assets(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  channel             text not null check (channel in ('email', 'whatsapp')),
  severity            public.alert_severity not null,
  status              text not null default 'queued'
                        check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts            integer not null default 0,
  last_error          text,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  claimed_at          timestamptz,
  sent_at             timestamptz,
  constraint orion_notifications_once unique (alert_id, profile_id, channel)
);

create index if not exists orion_notifications_queue_idx
  on public.orion_notifications (created_at) where status = 'queued';
create index if not exists orion_notifications_cooldown_idx
  on public.orion_notifications (profile_id, asset_id, channel, created_at desc);

create table if not exists public.orion_notify_config (
  id               boolean primary key default true check (id),
  enabled          boolean not null default false,
  function_url     text,
  secret           text,
  -- O cenário simulado reabre alerta a cada 30 min por sensor; sem janela de
  -- silêncio por ativo, o técnico receberia uma mensagem a cada meia hora.
  cooldown         interval not null default interval '6 hours',
  min_severity     public.alert_severity not null default 'warning',
  updated_at       timestamptz not null default now()
);

insert into public.orion_notify_config (id) values (true) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.whatsapp_sessions    enable row level security;
alter table public.whatsapp_inbound_log enable row level security;
alter table public.orion_notifications  enable row level security;
alter table public.orion_notify_config  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['whatsapp_sessions', 'whatsapp_inbound_log', 'orion_notifications', 'orion_notify_config'] loop
    execute format('drop policy if exists service_role_all on public.%I', t);
    execute format(
      'create policy service_role_all on public.%I as permissive for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- Cada pessoa vê o histórico dos próprios avisos; a configuração (que guarda o
-- secret) e as sessões ficam só com a service role.
drop policy if exists orion_notifications_own on public.orion_notifications;
create policy orion_notifications_own on public.orion_notifications
  for select to authenticated using (profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. Enfileiramento a partir do alerta
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_orion_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.orion_notify_config;
begin
  select * into v_cfg from public.orion_notify_config where id;
  if v_cfg is null or new.severity < v_cfg.min_severity then
    return new;
  end if;

  insert into public.orion_notifications (alert_id, asset_id, profile_id, channel, severity)
  select new.id, new.asset_id, p.id, c.channel, new.severity
  from public.profiles p
  left join public.user_settings us on us.user_id = p.id
  cross join lateral (values ('email'), ('whatsapp')) as c(channel)
  where p.is_active
    and (not coalesce(us.notify_critical_only, false) or new.severity = 'critical')
    and case c.channel
          when 'email'    then coalesce(us.notify_email, true)
          when 'whatsapp' then coalesce(us.notify_whatsapp, false) and p.whatsapp_opt_in and p.whatsapp_phone is not null
        end
    and not exists (
      select 1 from public.orion_notifications n
      where n.profile_id = p.id and n.asset_id = new.asset_id and n.channel = c.channel
        and n.severity >= new.severity
        and n.status in ('queued', 'sending', 'sent')
        and n.created_at > now() - v_cfg.cooldown
    )
  on conflict on constraint orion_notifications_once do nothing;

  return new;
end;
$$;

drop trigger if exists alerts_enqueue_orion on public.alerts;
create trigger alerts_enqueue_orion
  after insert on public.alerts
  for each row execute function public.enqueue_orion_notifications();

-- -----------------------------------------------------------------------------
-- 5. Contrato com a Edge Function
--
-- `for update skip locked` deixa duas execuções sobrepostas pegarem lotes
-- disjuntos; linha presa em 'sending' por mais de 10 min (function caiu no
-- meio) volta para a fila.
-- -----------------------------------------------------------------------------
create or replace function public.claim_orion_notifications(p_limit integer default 25)
returns table (
  id bigint, channel text, attempts integer,
  alert_id uuid, severity public.alert_severity, title text, message text, ml_insight text, triggered_at timestamptz,
  asset_id uuid, asset_tag text, asset_name text, asset_location text, health_index double precision, asset_insight text,
  profile_email text, profile_name text, whatsapp_phone text, language text, last_inbound_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  update public.orion_notifications
     set status = 'queued'
   where status = 'sending' and claimed_at < now() - interval '10 minutes';

  return query
  with picked as (
    select n.id from public.orion_notifications n
    where n.status = 'queued'
    order by n.severity desc, n.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.orion_notifications n
       set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
      from picked where n.id = picked.id
    returning n.*
  )
  select c.id, c.channel, c.attempts,
         al.id, al.severity, al.title, al.message, al.ml_insight, al.triggered_at,
         a.id, a.tag, a.name, a.location, a.health_index::double precision, a.insight,
         p.email, nullif(p.full_name, ''), p.whatsapp_phone, coalesce(us.language, 'pt'), ws.last_inbound_at
  from claimed c
  join public.alerts al on al.id = c.alert_id
  join public.assets a on a.id = c.asset_id
  join public.profiles p on p.id = c.profile_id
  left join public.user_settings us on us.user_id = p.id
  left join public.whatsapp_sessions ws on ws.profile_id = p.id;
end;
$$;

create or replace function public.complete_orion_notification(
  p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null, p_retry boolean default true
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orion_notifications
     set status = case
                    when p_ok then 'sent'
                    when p_retry and attempts < 3 then 'queued'
                    when p_error in ('email_not_configured', 'whatsapp_not_configured', 'no_phone') then 'skipped'
                    else 'failed'
                  end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_message_id = coalesce(p_provider_id, provider_message_id),
         last_error = p_error
   where id = p_id;
$$;

create or replace function public.orion_notify_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cfg public.orion_notify_config;
begin
  select * into v_cfg from public.orion_notify_config where id;
  if v_cfg is null or not v_cfg.enabled or v_cfg.function_url is null or v_cfg.secret is null then
    return null;
  end if;
  if not exists (select 1 from public.orion_notifications where status = 'queued') then
    return null;
  end if;
  return net.http_post(
    url := v_cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-orion-secret', v_cfg.secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function public.claim_orion_notifications(integer) from public, anon, authenticated;
revoke all on function public.complete_orion_notification(bigint, boolean, text, text, boolean) from public, anon, authenticated;
revoke all on function public.orion_notify_dispatch() from public, anon, authenticated;
grant execute on function public.claim_orion_notifications(integer) to service_role;
grant execute on function public.complete_orion_notification(bigint, boolean, text, text, boolean) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'forzy-orion-notify';
select cron.schedule('forzy-orion-notify', '* * * * *', $$select public.orion_notify_dispatch()$$);

comment on table public.orion_notifications is
  'Fila de avisos do Órion (e-mail/WhatsApp) gerada por alerta; entregue pela Edge Function orion-notify.';
comment on table public.whatsapp_sessions is
  'Conversa corrente e janela de 24 h da Meta por número vinculado.';
