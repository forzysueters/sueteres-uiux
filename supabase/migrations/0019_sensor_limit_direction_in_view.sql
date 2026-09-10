-- =============================================================================
-- 0019 — `limit_direction` volta a chegar ao front
--
-- O BUG
--
-- Nem toda grandeza piora subindo. Vazão que CAI indica cavitação ou obstrução;
-- rotação que CAI significa que o exaustor parou de renovar o ar. O banco sabe
-- disso desde a 0012, na coluna `sensors.limit_direction`, e classifica a
-- leitura corretamente na ingestão.
--
-- Só que o JSON de sensores de `v_assets_full` carregava `warning_threshold` e
-- `critical_threshold` e NÃO carregava a direção. O front registra esses
-- limites em runtime (`registerSensorLimits`) e, sem a direção, assumia
-- 'above'. Pior: o limite vindo do banco tem precedência sobre o override
-- estático — que estava correto —, então a suposição errada vencia o valor
-- certo.
--
-- O efeito na tela, com dois sensores:
--
--   BBA-001 · Vazão      110 L/min   mínimo 120, crítico 100  → lido como
--                                    "≥ 100, logo CRÍTICO"  (é ALERTA)
--   EXA-001 · Velocidade  70 %       mínimo 60, crítico 40    → lido como
--                                    "≥ 40, logo CRÍTICO"   (é NORMAL)
--
-- A escala inteira invertia: quanto MAIS vazão, mais grave a leitura parecia, e
-- valor nenhum conseguia ser normal. Como `assetStatusFromSensors` deriva o
-- status do ativo do pior sensor, os dois ativos ficavam permanentemente
-- vermelhos na régua de triagem, no contador do topo e no anel da planta 3D —
-- sem erro em lugar nenhum.
--
-- O bug é anterior ao cenário sintético; ele só ficou visível quando a
-- telemetria passou a andar e alguém olhou os números de perto.
--
-- A view é recriada inteira (a lista de colunas não muda) só para acrescentar
-- as três chaves que faltavam ao objeto de cada sensor.
-- =============================================================================

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
             -- As três que faltavam. Sem a direção, um limite de mínimo é lido
             -- como limite de máximo e o significado se inverte.
             'limit_direction',    v.limit_direction,
             'nominal_value',      v.nominal_value,
             'limit_source',       v.limit_source,
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
