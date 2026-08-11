-- =============================================================================
-- 0008 — Views agregadas e RPCs consumidas pela aplicação
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_assets_full — ativo + sensores com leitura corrente, em um único round-trip
-- -----------------------------------------------------------------------------
drop view if exists public.v_assets_full cascade;

create or replace view public.v_assets_full
with (security_invoker = on) as
select
  a.id,
  a.plant_id,
  a.area_id,
  a.tag,
  a.name,
  a.asset_type,
  a.location,
  a.status,
  a.criticality,
  a.uptime,
  a.anomaly_score,
  a.grid_x,
  a.grid_y,
  a.image_url,
  a.last_maintenance,
  a.next_maintenance,
  a.is_active,
  ar.name as area_name,
  p.name  as plant_name,
  coalesce(s.sensors, '[]'::jsonb) as sensors,
  coalesce(al.active_alert_count, 0) as active_alert_count
from public.assets a
left join public.areas  ar on ar.id = a.area_id
left join public.plants p  on p.id  = a.plant_id
left join lateral (
  select jsonb_agg(
           jsonb_build_object(
             'id',                 v.sensor_id,
             'tag',                v.tag,
             'name',               v.name,
             'sensor_type',        v.sensor_type,
             'unit',               v.unit,
             'value',              v.current_value,
             'raw_value',          v.current_raw_value,
             'quality',            v.current_quality,
             'status',             v.current_status,
             'min_value',          v.min_value,
             'max_value',          v.max_value,
             'warning_threshold',  v.warning_threshold,
             'critical_threshold', v.critical_threshold,
             'last_reading_at',    v.last_reading_at
           )
           order by v.name
         ) as sensors
  from public.v_sensor_current v
  where v.asset_id = a.id and v.is_active
) s on true
left join lateral (
  select count(*) as active_alert_count
  from public.alerts al2
  where al2.asset_id = a.id and al2.status <> 'resolved'
) al on true
where a.is_active;

-- -----------------------------------------------------------------------------
-- v_alerts_full — alerta já acompanhado do nome do ativo
-- -----------------------------------------------------------------------------
drop view if exists public.v_alerts_full cascade;

create or replace view public.v_alerts_full
with (security_invoker = on) as
select
  al.id,
  al.asset_id,
  a.name as asset_name,
  a.tag  as asset_tag,
  al.sensor_id,
  s.name as sensor_name,
  al.severity,
  al.status,
  al.source,
  al.title,
  al.message,
  al.ml_insight,
  al.triggered_value,
  al.threshold_value,
  al.triggered_at,
  al.acknowledged_at,
  al.resolved_at,
  al.resolution_notes,
  al.resolved,
  al.created_at
from public.alerts al
join public.assets a on a.id = al.asset_id
left join public.sensors s on s.id = al.sensor_id;

-- -----------------------------------------------------------------------------
-- v_kpi_metrics — indicadores do dashboard
-- -----------------------------------------------------------------------------
drop view if exists public.v_kpi_metrics cascade;

create or replace view public.v_kpi_metrics
with (security_invoker = on) as
select
  coalesce(round(avg(a.uptime), 2), 0)::numeric                            as total_uptime,
  (select count(*) from public.alerts where status <> 'resolved')::integer as active_alerts,
  -- anomaly_score é a fração de leituras fora do esperado nas últimas 24 h.
  -- A partir de 25% o ativo é considerado sob anomalia sustentada.
  count(*) filter (where a.anomaly_score >= 25)::integer                   as anomalies_detected,
  count(*) filter (where a.status <> 'offline')::integer                   as assets_online,
  count(*)::integer                                                        as total_assets,
  (
    select count(distinct p.asset_id)::integer
    from public.v_asset_latest_prediction p
    where p.prediction_type = 'remaining_useful_life'
      and p.rul_days is not null
      and p.rul_days <= 30
  )                                                                        as predicted_failures,
  (select count(*) from public.alerts
    where status <> 'resolved' and severity = 'critical')::integer         as critical_alerts,
  (select count(*) from public.maintenance_orders
    where status in ('scheduled', 'pending', 'in_progress'))::integer      as open_maintenance_orders
from public.assets a
where a.is_active;

-- -----------------------------------------------------------------------------
-- Séries temporais com bucket configurável (gráficos históricos)
-- -----------------------------------------------------------------------------
create or replace function public.get_sensor_series(
  p_sensor_id       uuid,
  p_from            timestamptz default now() - interval '24 hours',
  p_to              timestamptz default now(),
  p_bucket_minutes  integer     default 5
)
returns table (
  bucket     timestamptz,
  avg_value  double precision,
  min_value  double precision,
  max_value  double precision,
  samples    bigint
)
language sql
stable
set search_path = public
as $$
  select
    to_timestamp(
      floor(extract(epoch from r.ts) / (greatest(p_bucket_minutes, 1) * 60))
      * (greatest(p_bucket_minutes, 1) * 60)
    ) as bucket,
    avg(r.value),
    min(r.value),
    max(r.value),
    count(*)
  from public.sensor_readings r
  where r.sensor_id = p_sensor_id
    and r.ts >= p_from
    and r.ts <= p_to
    and r.value is not null
  group by 1
  order by 1;
$$;

-- Todas as séries de um ativo de uma vez (painel de detalhe).
create or replace function public.get_asset_series(
  p_asset_id        uuid,
  p_hours           integer default 24,
  p_bucket_minutes  integer default 15
)
returns table (
  sensor_id   uuid,
  sensor_name text,
  unit        text,
  bucket      timestamptz,
  avg_value   double precision
)
language sql
stable
set search_path = public
as $$
  select
    r.sensor_id,
    s.name,
    s.unit,
    to_timestamp(
      floor(extract(epoch from r.ts) / (greatest(p_bucket_minutes, 1) * 60))
      * (greatest(p_bucket_minutes, 1) * 60)
    ) as bucket,
    avg(r.value)
  from public.sensor_readings r
  join public.sensors s on s.id = r.sensor_id
  where r.asset_id = p_asset_id
    and r.ts >= now() - make_interval(hours => greatest(p_hours, 1))
    and r.value is not null
  group by r.sensor_id, s.name, s.unit, 4
  order by s.name, 4;
$$;

-- -----------------------------------------------------------------------------
-- Transições de alerta (a RLS ainda se aplica: são SECURITY INVOKER)
-- -----------------------------------------------------------------------------
create or replace function public.resolve_alert(p_alert_id uuid, p_notes text default null)
returns public.alerts
language sql
volatile
set search_path = public
as $$
  update public.alerts
     set status = 'resolved',
         resolution_notes = coalesce(p_notes, resolution_notes)
   where id = p_alert_id
  returning *;
$$;

create or replace function public.acknowledge_alert(p_alert_id uuid)
returns public.alerts
language sql
volatile
set search_path = public
as $$
  update public.alerts
     set status = 'acknowledged'
   where id = p_alert_id and status = 'active'
  returning *;
$$;

-- -----------------------------------------------------------------------------
-- Auditoria disparada pela aplicação (login, exportação, consulta sensível)
-- -----------------------------------------------------------------------------
create or replace function public.log_audit_event(
  p_action      text,
  p_entity_type text,
  p_entity_id   text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, after_data)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_action,
    p_entity_type,
    p_entity_id,
    p_metadata
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Ingestão em lote — usada pelo consumidor OPC-UA/MQTT
-- Formato: [{"sensor_tag":"MTR-001.TEMP","ts":"...","raw_value":12.5}, ...]
-- -----------------------------------------------------------------------------
create or replace function public.ingest_readings(p_readings jsonb)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  perform public.ensure_readings_partition(current_date);
  perform public.ensure_readings_partition((current_date + interval '1 month')::date);

  with payload as (
    select
      (item ->> 'sensor_tag')  as sensor_tag,
      coalesce((item ->> 'ts')::timestamptz, now()) as ts,
      nullif(item ->> 'value', '')::double precision     as value,
      nullif(item ->> 'raw_value', '')::double precision as raw_value,
      coalesce(item ->> 'source', 'opcua') as source
    from jsonb_array_elements(p_readings) as item
  ),
  inserted as (
    insert into public.sensor_readings (sensor_id, asset_id, ts, value, raw_value, source)
    select s.id, s.asset_id, p.ts, p.value, p.raw_value, p.source
    from payload p
    join public.sensors s on s.tag = p.sensor_tag and s.is_active
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recalcula uptime e anomalia a partir da telemetria recente
-- -----------------------------------------------------------------------------
create or replace function public.recompute_asset_health(p_asset_id uuid default null)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  with stats as (
    select
      r.asset_id,
      count(*)                                          as total,
      count(*) filter (where r.quality = 'good')        as good,
      count(*) filter (where r.status  = 'critical')    as critical,
      count(*) filter (where r.status <> 'normal')      as abnormal,
      -- Disponibilidade: fração do tempo com sinal confiável e fora do estado crítico.
      count(*) filter (where r.quality = 'good' and r.status <> 'critical') as healthy,
      -- Estado atual = última leitura de cada sensor, não a janela inteira.
      count(*) filter (where r.ts >= now() - interval '15 minutes' and r.status = 'critical') as critical_now,
      count(*) filter (where r.ts >= now() - interval '15 minutes' and r.status <> 'normal')  as abnormal_now,
      count(*) filter (where r.ts >= now() - interval '15 minutes')                           as recent
    from public.sensor_readings r
    where r.ts >= now() - interval '24 hours'
      and (p_asset_id is null or r.asset_id = p_asset_id)
    group by r.asset_id
  ),
  upd as (
    update public.assets a
       set uptime        = round((100.0 * s.healthy  / nullif(s.total, 0))::numeric, 2),
           anomaly_score = round((100.0 * s.abnormal / nullif(s.total, 0))::numeric, 2),
           status = case
                      when s.recent = 0 or s.good = 0                  then 'offline'
                      when s.critical_now > 0                          then 'critical'
                      when s.abnormal_now > 0                          then 'warning'
                      else 'normal'
                    end::public.asset_status
      from stats s
     where a.id = s.asset_id
    returning 1
  )
  select count(*) into v_updated from upd;

  return v_updated;
end;
$$;
