-- =============================================================================
-- 0004 — Sensores e base histórica de telemetria (Módulo 1 — ingestão IoT)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sensors — canais de medição de um ativo
-- -----------------------------------------------------------------------------
create table if not exists public.sensors (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references public.assets(id) on delete cascade,
  tag                 text not null,                -- MTR-001.TEMP
  name                text not null,
  sensor_type         public.sensor_type not null,
  unit                text not null,                -- V, A, °C, rpm, mm/s, bar, ...

  -- Faixa de operação em unidade de engenharia
  min_value           double precision not null default 0,
  max_value           double precision not null default 100,
  warning_threshold   double precision,
  critical_threshold  double precision,

  -- Faixa do sinal bruto (4-20 mA, 0-10 V, ...) para conversão na ingestão
  raw_min             double precision,
  raw_max             double precision,
  raw_unit            text,

  opcua_node_id       text,                         -- endereço OPC-UA de origem
  mqtt_topic          text,
  sampling_interval_s integer not null default 5,
  is_active           boolean not null default true,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint sensors_tag_key       unique (asset_id, tag),
  constraint sensors_range_check   check (max_value > min_value),
  constraint sensors_raw_check     check (raw_min is null or raw_max is null or raw_max > raw_min),
  constraint sensors_sampling_check check (sampling_interval_s between 1 and 86400)
);

create index if not exists sensors_asset_idx on public.sensors (asset_id);
create index if not exists sensors_type_idx  on public.sensors (sensor_type);

drop trigger if exists sensors_set_updated_at on public.sensors;
create trigger sensors_set_updated_at
  before update on public.sensors
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- sensor_readings — série temporal particionada por mês
-- -----------------------------------------------------------------------------
create sequence if not exists public.sensor_readings_id_seq as bigint;

create table if not exists public.sensor_readings (
  id         bigint not null default nextval('public.sensor_readings_id_seq'),
  sensor_id  uuid not null references public.sensors(id) on delete cascade,
  asset_id   uuid not null references public.assets(id) on delete cascade,
  ts         timestamptz not null default now(),
  value      double precision,                       -- unidade de engenharia
  raw_value  double precision,                       -- sinal bruto recebido
  quality    public.reading_quality not null default 'good',
  status     public.sensor_status not null default 'normal',
  source     text not null default 'opcua',
  primary key (id, ts)
) partition by range (ts);

alter sequence public.sensor_readings_id_seq owned by public.sensor_readings.id;

comment on table public.sensor_readings is
  'Base histórica bruta+processada da telemetria. Particionada mensalmente por ts.';

create index if not exists sensor_readings_sensor_ts_idx on public.sensor_readings (sensor_id, ts desc);
create index if not exists sensor_readings_asset_ts_idx  on public.sensor_readings (asset_id, ts desc);
create index if not exists sensor_readings_ts_brin_idx   on public.sensor_readings using brin (ts);

-- Cria a partição mensal que cobre a data informada (idempotente).
create or replace function public.ensure_readings_partition(p_when date default current_date)
returns void
language plpgsql
as $$
declare
  v_start date := date_trunc('month', p_when)::date;
  v_end   date := (date_trunc('month', p_when) + interval '1 month')::date;
  v_name  text := format('sensor_readings_%s', to_char(v_start, 'YYYY_MM'));
begin
  if not exists (select 1 from pg_class where relname = v_name) then
    execute format(
      'create table public.%I partition of public.sensor_readings for values from (%L) to (%L)',
      v_name, v_start, v_end
    );
  end if;
end;
$$;

-- Partições de 2025 a 2027 + default para leituras fora do intervalo previsto.
do $$
declare d date := date '2025-01-01';
begin
  while d < date '2028-01-01' loop
    perform public.ensure_readings_partition(d);
    d := (d + interval '1 month')::date;
  end loop;
end $$;

do $$ begin
  create table public.sensor_readings_default partition of public.sensor_readings default;
exception when duplicate_table then null; end $$;

-- Ingestão: converte sinal bruto e classifica contra os limites do sensor.
create or replace function public.process_sensor_reading()
returns trigger
language plpgsql
as $$
declare
  s record;
begin
  select raw_min, raw_max, min_value, max_value, warning_threshold, critical_threshold
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

  -- Validação de qualidade na ingestão (sensor desconectado = abaixo do mínimo do laço).
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

  new.status := public.classify_reading(new.value, s.warning_threshold, s.critical_threshold);
  return new;
end;
$$;

drop trigger if exists sensor_readings_process on public.sensor_readings;
create trigger sensor_readings_process
  before insert on public.sensor_readings
  for each row execute function public.process_sensor_reading();

-- -----------------------------------------------------------------------------
-- Leitura corrente por sensor — alimenta cards e painel de detalhe
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Agregação horária para gráficos de longo período
-- -----------------------------------------------------------------------------
create or replace view public.v_sensor_readings_hourly
with (security_invoker = on) as
select
  sensor_id,
  asset_id,
  date_trunc('hour', ts) as bucket,
  avg(value)   as avg_value,
  min(value)   as min_value,
  max(value)   as max_value,
  count(*)     as sample_count,
  count(*) filter (where status = 'critical') as critical_count,
  count(*) filter (where quality <> 'good')   as bad_quality_count
from public.sensor_readings
where value is not null
group by sensor_id, asset_id, date_trunc('hour', ts);
