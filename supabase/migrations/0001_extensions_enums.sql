-- =============================================================================
-- 0001 — Extensões, tipos enumerados e utilitários compartilhados
-- Projeto: Forzy / Promon — Gêmeo Digital Industrial
-- =============================================================================

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pg_trgm"   with schema extensions;
create extension if not exists "vector"    with schema extensions;

-- -----------------------------------------------------------------------------
-- Governança / acesso
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'engineer', 'technician', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consent_type as enum ('data_processing', 'telemetry', 'marketing', 'ai_processing');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Ativos
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.asset_type as enum ('motor', 'pump', 'compressor', 'fan', 'panel', 'gearbox', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_status as enum ('normal', 'warning', 'critical', 'offline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.criticality_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Sensores e telemetria
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.sensor_type as enum (
    'voltage', 'current', 'temperature', 'rpm', 'vibration',
    'pressure', 'flow', 'power', 'speed', 'humidity', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sensor_status as enum ('normal', 'warning', 'critical');
exception when duplicate_object then null; end $$;

-- Qualidade do sinal na ingestão (4-20 mA: 0 mA = sensor desconectado)
do $$ begin
  create type public.reading_quality as enum ('good', 'uncertain', 'bad', 'disconnected');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Alertas e manutenção
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.alert_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_status as enum ('active', 'acknowledged', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_source as enum ('rule', 'ml', 'manual', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.maintenance_type as enum ('preventive', 'corrective', 'predictive', 'calibration', 'inspection');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.maintenance_status as enum ('scheduled', 'pending', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Machine Learning
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.ml_model_type as enum ('baseline', 'anomaly', 'prediction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.prediction_type as enum ('baseline_deviation', 'anomaly_score', 'remaining_useful_life', 'failure_probability');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Assistente conversacional / RAG
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.chat_role as enum ('user', 'assistant', 'system', 'tool');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('manual', 'datasheet', 'procedure', 'report', 'certificate', 'floor_plan', 'other');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- OCR de placa de dados
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.nameplate_status as enum ('draft', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- Utilitários
-- =============================================================================

-- Mantém `updated_at` sempre coerente sem depender da aplicação.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Converte sinal analógico industrial (ex.: 4-20 mA) para unidade de engenharia.
-- Fora da faixa de entrada o retorno é NULL — o chamador decide o que fazer.
create or replace function public.scale_raw_signal(
  p_raw        double precision,
  p_raw_min    double precision,
  p_raw_max    double precision,
  p_value_min  double precision,
  p_value_max  double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when p_raw is null or p_raw_min is null or p_raw_max is null then null
    when p_raw_max = p_raw_min then null
    when p_raw < p_raw_min or p_raw > p_raw_max then null
    else p_value_min + (p_raw - p_raw_min) * (p_value_max - p_value_min) / (p_raw_max - p_raw_min)
  end;
$$;

-- Classifica uma leitura contra os limites configurados no sensor.
create or replace function public.classify_reading(
  p_value    double precision,
  p_warning  double precision,
  p_critical double precision
)
returns public.sensor_status
language sql
immutable
as $$
  select case
    when p_value is null then 'normal'::public.sensor_status
    when p_critical is not null and p_value >= p_critical then 'critical'::public.sensor_status
    when p_warning  is not null and p_value >= p_warning  then 'warning'::public.sensor_status
    else 'normal'::public.sensor_status
  end;
$$;
