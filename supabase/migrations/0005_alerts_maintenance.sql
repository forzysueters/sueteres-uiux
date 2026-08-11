-- =============================================================================
-- 0005 — Alertas e ordens de manutenção
-- =============================================================================

-- -----------------------------------------------------------------------------
-- alerts
-- -----------------------------------------------------------------------------
create table if not exists public.alerts (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.assets(id) on delete cascade,
  sensor_id        uuid references public.sensors(id) on delete set null,
  severity         public.alert_severity not null default 'info',
  status           public.alert_status  not null default 'active',
  source           public.alert_source  not null default 'rule',
  title            text not null,
  message          text not null default '',
  ml_insight       text,
  triggered_value  double precision,
  threshold_value  double precision,
  triggered_at     timestamptz not null default now(),
  acknowledged_by  uuid references public.profiles(id) on delete set null,
  acknowledged_at  timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  resolved_at      timestamptz,
  resolution_notes text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Espelho booleano para consumo direto pela UI.
  resolved boolean generated always as (status = 'resolved') stored
);

create index if not exists alerts_asset_idx     on public.alerts (asset_id, triggered_at desc);
create index if not exists alerts_status_idx    on public.alerts (status, severity, triggered_at desc);
create index if not exists alerts_active_idx    on public.alerts (triggered_at desc) where status <> 'resolved';
create index if not exists alerts_sensor_idx    on public.alerts (sensor_id);

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

drop trigger if exists alerts_audit on public.alerts;
create trigger alerts_audit
  after insert or update or delete on public.alerts
  for each row execute function public.audit_row_change();

-- Carimba autor/momento conforme o alerta muda de estado.
create or replace function public.stamp_alert_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;

  if new.status = 'acknowledged' and old.status = 'active' then
    new.acknowledged_at := coalesce(new.acknowledged_at, now());
    new.acknowledged_by := coalesce(new.acknowledged_by, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists alerts_stamp_transition on public.alerts;
create trigger alerts_stamp_transition
  before update on public.alerts
  for each row execute function public.stamp_alert_transition();

-- Agora que public.alerts existe, liga o histórico de saúde do ativo (definido em 0003).
drop trigger if exists assets_snapshot_health on public.assets;
create trigger assets_snapshot_health
  after update on public.assets
  for each row execute function public.snapshot_asset_health();

-- -----------------------------------------------------------------------------
-- Geração automática de alerta a partir de leitura crítica
-- -----------------------------------------------------------------------------
create or replace function public.raise_alert_from_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sensor  record;
  v_asset   record;
  v_exists  boolean;
begin
  if new.status = 'normal' or new.value is null then
    return new;
  end if;

  select s.name, s.unit, s.warning_threshold, s.critical_threshold
    into v_sensor
  from public.sensors s where s.id = new.sensor_id;

  select a.name into v_asset from public.assets a where a.id = new.asset_id;

  -- Evita enxurrada: um alerta ativo por sensor/severidade a cada 30 minutos.
  select exists (
    select 1 from public.alerts
    where sensor_id = new.sensor_id
      and status <> 'resolved'
      and severity = (case when new.status = 'critical' then 'critical' else 'warning' end)::public.alert_severity
      and triggered_at > now() - interval '30 minutes'
  ) into v_exists;

  if v_exists then
    return new;
  end if;

  insert into public.alerts (
    asset_id, sensor_id, severity, source, title, message,
    triggered_value, threshold_value, triggered_at
  )
  values (
    new.asset_id,
    new.sensor_id,
    (case when new.status = 'critical' then 'critical' else 'warning' end)::public.alert_severity,
    'rule',
    format('%s fora da faixa em %s', v_sensor.name, coalesce(v_asset.name, 'ativo')),
    format('Leitura de %s registrou %s %s, acima do limite configurado.',
           v_sensor.name, round(new.value::numeric, 2), v_sensor.unit),
    new.value,
    case when new.status = 'critical' then v_sensor.critical_threshold else v_sensor.warning_threshold end,
    new.ts
  );

  return new;
end;
$$;

drop trigger if exists sensor_readings_raise_alert on public.sensor_readings;
create trigger sensor_readings_raise_alert
  after insert on public.sensor_readings
  for each row
  when (new.status <> 'normal')
  execute function public.raise_alert_from_reading();

-- -----------------------------------------------------------------------------
-- maintenance_orders — planejamento de paradas (preventiva/preditiva/corretiva)
-- -----------------------------------------------------------------------------
create table if not exists public.maintenance_orders (
  id                uuid primary key default gen_random_uuid(),
  asset_id          uuid not null references public.assets(id) on delete cascade,
  alert_id          uuid references public.alerts(id) on delete set null,
  order_number      text not null unique default ('OM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  maintenance_type  public.maintenance_type not null default 'preventive',
  status            public.maintenance_status not null default 'scheduled',
  priority          public.criticality_level not null default 'medium',
  title             text not null,
  description       text,
  scheduled_for     timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  assigned_to       uuid references public.profiles(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  estimated_hours   numeric(6,2),
  downtime_minutes  integer,
  cost              numeric(12,2),
  notes             text,
  checklist         jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint maintenance_downtime_check check (downtime_minutes is null or downtime_minutes >= 0),
  constraint maintenance_cost_check     check (cost is null or cost >= 0)
);

create index if not exists maintenance_asset_idx     on public.maintenance_orders (asset_id, scheduled_for desc);
create index if not exists maintenance_status_idx    on public.maintenance_orders (status, scheduled_for);
create index if not exists maintenance_assigned_idx  on public.maintenance_orders (assigned_to) where status <> 'completed';

drop trigger if exists maintenance_set_updated_at on public.maintenance_orders;
create trigger maintenance_set_updated_at
  before update on public.maintenance_orders
  for each row execute function public.set_updated_at();

drop trigger if exists maintenance_audit on public.maintenance_orders;
create trigger maintenance_audit
  after insert or update or delete on public.maintenance_orders
  for each row execute function public.audit_row_change();

-- Ao concluir uma OM, atualiza a data de última manutenção do ativo.
create or replace function public.sync_asset_maintenance_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());

    update public.assets
       set last_maintenance = new.completed_at::date,
           next_maintenance = greatest(next_maintenance, (new.completed_at + interval '90 days')::date)
     where id = new.asset_id;
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_sync_asset on public.maintenance_orders;
create trigger maintenance_sync_asset
  before update on public.maintenance_orders
  for each row execute function public.sync_asset_maintenance_dates();
