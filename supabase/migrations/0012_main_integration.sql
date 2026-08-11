-- =============================================================================
-- 0012 — Campos exigidos pelo front (planta 3D/SVG e modelo de anomalia)
--
-- Alinha o schema ao contrato que as telas já consomem:
--  · posição percentual no mapa da planta (plantX/plantY)
--  · diagnóstico do serviço de anomalia persistido no ativo
--  · direção do limite por grandeza — nem todo desvio é "alto demais"
-- =============================================================================

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Severidade produzida pelo serviço de anomalia (anomaly/, FastAPI)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.anomaly_severity as enum ('ok', 'info', 'alerta', 'critico');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Sentido em que a grandeza vira problema.
-- 'above'  → alto demais (vibração, temperatura)
-- 'below'  → baixo demais (vazão caindo = cavitação; rotação = escorregamento)
-- 'band'   → desvio em torno do nominal nos dois sentidos (tensão)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.limit_direction as enum ('above', 'below', 'band');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- assets
-- -----------------------------------------------------------------------------
alter table public.assets
  add column if not exists plant_x         numeric(5,2),
  add column if not exists plant_y         numeric(5,2),
  add column if not exists health_index    numeric(5,2),
  add column if not exists severity        public.anomaly_severity,
  add column if not exists insight         text,
  add column if not exists thermal_residual numeric(8,3),
  add column if not exists scored_at       timestamptz;

comment on column public.assets.plant_x is 'Posição horizontal em % no mapa da planta (0-100).';
comment on column public.assets.health_index is 'Saída do modelo de anomalia: 0-100, maior = mais saudável.';
comment on column public.assets.scored_at is 'Momento da última pontuação pelo serviço de anomalia.';

do $$ begin
  alter table public.assets
    add constraint assets_plant_pos_check
    check ((plant_x is null or plant_x between 0 and 100)
       and (plant_y is null or plant_y between 0 and 100));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.assets
    add constraint assets_health_index_check
    check (health_index is null or health_index between 0 and 100);
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- sensors — limites com direção e justificativa de engenharia
-- -----------------------------------------------------------------------------
alter table public.sensors
  add column if not exists limit_direction public.limit_direction not null default 'above',
  add column if not exists nominal_value   double precision,
  add column if not exists limit_source    text,
  -- Ordem de exibição dos sensores no painel do ativo.
  add column if not exists display_order   integer not null default 0;

comment on column public.sensors.limit_source is
  'De onde vem o limite (norma, placa do motor, projeto do circuito). Aparece na justificativa do alerta.';

-- -----------------------------------------------------------------------------
-- Classificação passa a considerar a direção do limite.
-- A versão de 3 argumentos some: só `process_sensor_reading` a chamava.
-- -----------------------------------------------------------------------------
drop function if exists public.classify_reading(double precision, double precision, double precision);

create or replace function public.classify_reading(
  p_value     double precision,
  p_warning   double precision,
  p_critical  double precision,
  p_direction public.limit_direction default 'above',
  p_nominal   double precision default null
)
returns public.sensor_status
language sql
immutable
as $$
  -- Todos os ramos devolvem texto; o cast para o enum acontece uma vez, no fim.
  select case
    when p_value is null then 'normal'

    when p_direction = 'above' then case
      when p_critical is not null and p_value >= p_critical then 'critical'
      when p_warning  is not null and p_value >= p_warning  then 'warning'
      else 'normal' end

    when p_direction = 'below' then case
      when p_critical is not null and p_value <= p_critical then 'critical'
      when p_warning  is not null and p_value <= p_warning  then 'warning'
      else 'normal' end

    -- 'band': o desvio absoluto em torno do nominal é que conta.
    else case
      when p_nominal is null then 'normal'
      when p_critical is not null and abs(p_value - p_nominal) >= p_critical then 'critical'
      when p_warning  is not null and abs(p_value - p_nominal) >= p_warning  then 'warning'
      else 'normal' end
  end::public.sensor_status;
$$;

create or replace function public.process_sensor_reading()
returns trigger
language plpgsql
as $$
declare
  s record;
begin
  select raw_min, raw_max, min_value, max_value,
         warning_threshold, critical_threshold,
         limit_direction, nominal_value
    into s
  from public.sensors
  where id = new.sensor_id;

  if not found then
    return new;
  end if;

  -- Valor ausente mas sinal bruto presente: converte via regra de 3 com range.
  if new.value is null and new.raw_value is not null and s.raw_min is not null and s.raw_max is not null then
    new.value := public.scale_raw_signal(new.raw_value, s.raw_min, s.raw_max, s.min_value, s.max_value);
  end if;

  -- Validação de qualidade na ingestão (0 mA = sensor desconectado).
  if new.raw_value is not null and s.raw_min is not null then
    if new.raw_value <= 0 then
      new.quality := 'disconnected';
    elsif new.raw_value < s.raw_min or new.raw_value > coalesce(s.raw_max, new.raw_value) then
      new.quality := 'bad';
    end if;
  end if;

  if new.value is null then
    new.quality := case when new.quality = 'good' then 'bad' else new.quality end;
  elsif new.value < s.min_value or new.value > s.max_value then
    new.quality := case when new.quality = 'good' then 'uncertain' else new.quality end;
  end if;

  new.status := public.classify_reading(
    new.value, s.warning_threshold, s.critical_threshold, s.limit_direction, s.nominal_value
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Views passam a expor os novos campos.
-- CREATE OR REPLACE não aceita colunas novas no meio da lista, então as views
-- são recriadas — v_assets_full primeiro, por depender de v_sensor_current.
-- -----------------------------------------------------------------------------
drop view if exists public.v_assets_full;
drop view if exists public.v_sensor_current cascade;

create or replace view public.v_sensor_current
with (security_invoker = on) as
select
  s.id            as sensor_id,
  s.asset_id,
  s.tag,
  s.name,
  s.sensor_type,
  s.unit,
  s.min_value,
  s.max_value,
  s.warning_threshold,
  s.critical_threshold,
  s.limit_direction,
  s.nominal_value,
  s.limit_source,
  s.display_order,
  s.is_active,
  r.value         as current_value,
  r.raw_value     as current_raw_value,
  r.quality       as current_quality,
  coalesce(r.status, 'normal'::public.sensor_status) as current_status,
  r.ts            as last_reading_at
from public.sensors s
left join lateral (
  select value, raw_value, quality, status, ts
  from public.sensor_readings sr
  where sr.sensor_id = s.id
  order by sr.ts desc
  limit 1
) r on true;

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
  a.plant_x,
  a.plant_y,
  a.health_index,
  a.severity,
  a.insight,
  a.thermal_residual,
  a.scored_at,
  a.image_url,
  a.last_maintenance,
  a.next_maintenance,
  a.is_active,
  ar.name as area_name,
  p.name  as plant_name,
  coalesce(s.sensors, '[]'::jsonb) as sensors,
  coalesce(n.nameplate, 'null'::jsonb) as nameplate,
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
           order by v.display_order, v.name
         ) as sensors
  from public.v_sensor_current v
  where v.asset_id = a.id and v.is_active
) s on true
left join lateral (
  select to_jsonb(np) - 'ocr_raw' - 'extra' as nameplate
  from public.asset_nameplates np
  where np.asset_id = a.id and np.status = 'confirmed'
  order by np.confirmed_at desc nulls last, np.created_at desc
  limit 1
) n on true
left join lateral (
  select count(*) as active_alert_count
  from public.alerts al2
  where al2.asset_id = a.id and al2.status <> 'resolved'
) al on true
where a.is_active;

-- -----------------------------------------------------------------------------
-- Registra a pontuação do serviço de anomalia no ativo
-- -----------------------------------------------------------------------------
create or replace function public.apply_anomaly_score(
  p_asset_id         uuid,
  p_health_index     double precision,
  p_anomaly_score    double precision,
  p_severity         text,
  p_insight          text default null,
  p_thermal_residual double precision default null
)
returns void
language sql
volatile
set search_path = public
as $$
  update public.assets
     set health_index     = round(p_health_index::numeric, 2),
         anomaly_score    = round(greatest(least(p_anomaly_score, 100), 0)::numeric, 2),
         severity         = p_severity::public.anomaly_severity,
         insight          = coalesce(p_insight, insight),
         thermal_residual = p_thermal_residual,
         scored_at        = now()
   where id = p_asset_id;
$$;

grant execute on function public.apply_anomaly_score(uuid, double precision, double precision, text, text, double precision) to authenticated;
