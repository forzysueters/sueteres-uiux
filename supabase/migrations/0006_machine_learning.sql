-- =============================================================================
-- 0006 — Modelos de ML encadeados e predições (Módulo 4 + governança de IA)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ml_models — registro versionado, com Model Card exigido pela governança de IA
-- -----------------------------------------------------------------------------
create table if not exists public.ml_models (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  version           text not null default '1.0.0',
  model_type        public.ml_model_type not null,
  algorithm         text,                              -- RandomForest, IsolationForest, LSTM...
  description       text,
  target_asset_type public.asset_type,
  feature_names     text[] not null default '{}',
  hyperparameters   jsonb not null default '{}'::jsonb,
  metrics           jsonb not null default '{}'::jsonb, -- {"rmse":..,"f1":..,"auc":..}

  -- Model Card (propósito, dados, limitações, vieses) — requisito do Módulo 6
  model_card        jsonb not null default jsonb_build_object(
                      'purpose', null, 'training_data', null, 'limitations', null,
                      'biases', null, 'intended_use', null, 'out_of_scope', null
                    ),

  -- Encadeamento baseline -> anomalia -> predição
  parent_model_id   uuid references public.ml_models(id) on delete set null,

  artifact_url      text,
  training_rows     bigint,
  trained_at        timestamptz,
  is_active         boolean not null default false,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint ml_models_version_key unique (name, version)
);

create index if not exists ml_models_type_idx   on public.ml_models (model_type, is_active);
create index if not exists ml_models_parent_idx on public.ml_models (parent_model_id);

drop trigger if exists ml_models_set_updated_at on public.ml_models;
create trigger ml_models_set_updated_at
  before update on public.ml_models
  for each row execute function public.set_updated_at();

drop trigger if exists ml_models_audit on public.ml_models;
create trigger ml_models_audit
  after insert or update or delete on public.ml_models
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- ml_predictions — saídas dos modelos, com explicabilidade
-- -----------------------------------------------------------------------------
create table if not exists public.ml_predictions (
  id               bigint generated always as identity primary key,
  model_id         uuid not null references public.ml_models(id) on delete cascade,
  asset_id         uuid not null references public.assets(id) on delete cascade,
  sensor_id        uuid references public.sensors(id) on delete set null,
  prediction_type  public.prediction_type not null,
  predicted_at     timestamptz not null default now(),

  value            double precision,                   -- score / dias / probabilidade
  confidence       double precision,
  horizon_days     integer,
  rul_days         integer,                            -- Remaining Useful Life
  recommended_action text,
  explanation      text,
  features         jsonb not null default '{}'::jsonb,
  feature_importance jsonb not null default '{}'::jsonb, -- SHAP / LIME
  alert_id         uuid references public.alerts(id) on delete set null,

  constraint ml_pred_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint ml_pred_rul_check        check (rul_days is null or rul_days >= 0)
);

create index if not exists ml_pred_asset_idx  on public.ml_predictions (asset_id, predicted_at desc);
create index if not exists ml_pred_model_idx  on public.ml_predictions (model_id, predicted_at desc);
create index if not exists ml_pred_type_idx   on public.ml_predictions (prediction_type, predicted_at desc);

-- -----------------------------------------------------------------------------
-- ml_training_runs — rastreabilidade de treinos
-- -----------------------------------------------------------------------------
create table if not exists public.ml_training_runs (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null references public.ml_models(id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running',
  dataset_from   timestamptz,
  dataset_to     timestamptz,
  row_count      bigint,
  metrics        jsonb not null default '{}'::jsonb,
  log            text,
  triggered_by   uuid references public.profiles(id) on delete set null,
  constraint ml_runs_status_check check (status in ('running', 'succeeded', 'failed', 'cancelled'))
);

create index if not exists ml_runs_model_idx on public.ml_training_runs (model_id, started_at desc);

-- -----------------------------------------------------------------------------
-- Predição mais recente por ativo — alimenta o painel de insights
-- -----------------------------------------------------------------------------
create or replace view public.v_asset_latest_prediction
with (security_invoker = on) as
select distinct on (p.asset_id, p.prediction_type)
  p.asset_id,
  p.prediction_type,
  p.value,
  p.confidence,
  p.rul_days,
  p.recommended_action,
  p.explanation,
  p.feature_importance,
  p.predicted_at,
  m.name    as model_name,
  m.version as model_version
from public.ml_predictions p
join public.ml_models m on m.id = p.model_id
order by p.asset_id, p.prediction_type, p.predicted_at desc;
