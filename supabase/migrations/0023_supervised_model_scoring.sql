-- =============================================================================
-- 0023 — O classificador supervisionado passa a diagnosticar a planta
--
-- Até aqui o diagnóstico que a tela mostrava vinha de `synthetic_score()` (0018):
-- a regra do modelo reproduzida em SQL, sem o modelo. O serviço Python só era
-- chamado pelo navegador quando o servidor não tinha diagnóstico recente — ou
-- seja, quase nunca.
--
-- Agora o worker `services/anomaly/src/worker.py` lê a janela de 5 minutos de
-- cada ativo, classifica com `models/classifier.joblib` e publica por
-- `publish_model_score`. O avaliador em SQL continua agendado, mas cede o ativo
-- enquanto houver predição do classificador com menos de 7 minutos: com o
-- worker parado, a planta nunca fica sem diagnóstico.
--
-- A telemetria do cenário continua vindo de `synthetic_tick()`. O que muda é
-- quem a lê: os perfis encenam a condição, o modelo treinado diz a severidade.
-- =============================================================================

insert into public.ml_models (
  id, name, version, model_type, algorithm, description,
  feature_names, hyperparameters, metrics, model_card, training_rows, trained_at, is_active
) values (
  '44444444-4444-4444-8444-444444444444',
  'Classificador de Severidade de Ativos', '2.0.0', 'anomaly',
  'HistGradientBoostingClassifier + HistGradientBoostingRegressor',
  'Classifica ok/info/alerta/crítico e estima o Índice de Saúde pela janela de 5 min de '
  'velocidade de vibração, aceleração e temperatura na escala normativa. Servido por services/anomaly.',
  array[]::text[],
  '{"max_iter": 400, "learning_rate": 0.08, "max_leaf_nodes": 31}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, 0, now(), true
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- register_model_version — o worker grava o model card real ao subir
-- -----------------------------------------------------------------------------
create or replace function public.register_model_version(p_card jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id constant uuid := '44444444-4444-4444-8444-444444444444';
  v_trained timestamptz := coalesce((p_card->>'trained_at')::timestamptz, now());
begin
  update public.ml_models set
    version        = coalesce(p_card->>'version', version),
    algorithm      = coalesce(p_card->>'algorithm', algorithm),
    feature_names  = coalesce(array(select jsonb_array_elements_text(p_card->'feature_names')), feature_names),
    metrics        = coalesce(p_card->'metrics', metrics),
    model_card     = coalesce(p_card->'model_card', model_card),
    training_rows  = coalesce((p_card->>'training_rows')::bigint, training_rows),
    trained_at     = v_trained,
    is_active      = true
  where id = v_id;

  insert into public.ml_training_runs (model_id, started_at, finished_at, status, row_count, metrics, log)
  select v_id, v_trained, v_trained, 'succeeded', (p_card->>'training_rows')::bigint, p_card->'metrics',
         'train_classifier.py — data augmentation do log IO-Link'
  where not exists (
    select 1 from public.ml_training_runs where model_id = v_id and finished_at = v_trained
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- model_scoring_window — a janela que o classificador lê
-- -----------------------------------------------------------------------------
create or replace function public.model_scoring_window(p_minutes integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_id', a.id,
    'tag', a.tag,
    'sensors', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sensor_id', s.id, 'name', s.name, 'sensor_type', s.sensor_type, 'unit', s.unit,
        'warn', s.warning_threshold, 'crit', s.critical_threshold, 'direction', s.limit_direction,
        'readings', (
          select coalesce(jsonb_agg(jsonb_build_array(r.ts, r.value) order by r.ts), '[]'::jsonb)
          from public.sensor_readings r
          where r.sensor_id = s.id
            and r.ts >= now() - make_interval(mins => p_minutes)
            and r.value is not null
        )
      ) order by s.display_order), '[]'::jsonb)
      from public.sensors s
      where s.asset_id = a.id and s.is_active
        and s.warning_threshold is not null and s.critical_threshold is not null
    )
  ) order by a.tag), '[]'::jsonb)
  from public.assets a
  where a.is_active;
$$;

-- -----------------------------------------------------------------------------
-- publish_model_score — mesma publicação do avaliador SQL, com a saída do modelo
--
-- Disponibilidade e vida útil usam as mesmas fórmulas da 0018, para o cockpit
-- não mudar de escala quando a origem do diagnóstico alterna.
-- -----------------------------------------------------------------------------
create or replace function public.publish_model_score(
  p_asset_id     uuid,
  p_health       double precision,
  p_severity     text,
  p_confidence   double precision,
  p_insight      text,
  p_features     jsonb default '{}'::jsonb,
  p_worst_sensor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_health  double precision := greatest(0, least(100, p_health));
  v_status  public.asset_status;
  v_uptime  double precision;
  v_rul     integer;
  v_action  text;
begin
  if p_severity not in ('ok', 'info', 'alerta', 'critico') then
    raise exception 'severidade inválida: %', p_severity using errcode = '22023';
  end if;

  v_status := case p_severity
    when 'alerta'  then 'warning'::public.asset_status
    when 'critico' then 'critical'::public.asset_status
    else                'normal'::public.asset_status
  end;
  v_uptime := round((78 + (v_health / 100.0) * 22)::numeric, 2);
  v_rul    := least(400, greatest(1, round(power(v_health, 3.5) / 19317.0)::integer));
  v_action := case p_severity
    when 'ok'     then 'Nenhuma ação necessária.'
    when 'info'   then 'Acompanhar nas próximas leituras.'
    when 'alerta' then 'Agendar inspeção preventiva.'
    else               'Acionar a manutenção com prioridade.'
  end;

  insert into public.ml_predictions (
    model_id, asset_id, sensor_id, prediction_type, predicted_at,
    value, confidence, horizon_days, rul_days, recommended_action, explanation,
    features, feature_importance
  ) values (
    '44444444-4444-4444-8444-444444444444', p_asset_id, p_worst_sensor, 'anomaly_score', now(),
    round((100 - v_health)::numeric, 2), p_confidence, 30, v_rul, v_action, p_insight,
    coalesce(p_features, '{}'::jsonb) || jsonb_build_object(
      'health_index', round(v_health::numeric, 2),
      'severity', p_severity,
      'window_minutes', 5,
      'source', 'model'
    ),
    p_features->'channel_penalty'
  );

  insert into public.asset_health_snapshots (asset_id, captured_at, uptime, anomaly_score, status, active_alerts)
  select p_asset_id, now(), v_uptime, round((100 - v_health)::numeric, 2), v_status,
         (select count(*) from public.alerts where asset_id = p_asset_id and status <> 'resolved');

  perform public.apply_anomaly_score(p_asset_id, v_health, 100 - v_health, p_severity, p_insight, null);

  update public.assets
  set status = v_status, uptime = v_uptime, updated_at = now()
  where id = p_asset_id;
end;
$$;

revoke all on function public.register_model_version(jsonb) from public, anon, authenticated;
revoke all on function public.model_scoring_window(integer) from public, anon, authenticated;
revoke all on function public.publish_model_score(uuid, double precision, text, double precision, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.register_model_version(jsonb) to service_role;
grant execute on function public.model_scoring_window(integer) to service_role;
grant execute on function public.publish_model_score(uuid, double precision, text, double precision, text, jsonb, uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- synthetic_score() cede o ativo ao classificador
--
-- Corpo idêntico ao da 0018, com a guarda no início do laço.
-- -----------------------------------------------------------------------------
create or replace function public.synthetic_score()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_asset        record;
  v_s_pen        double precision;
  v_r_pen        double precision;
  v_penalty      double precision;
  v_health_raw   double precision;
  v_health_prev  double precision;
  v_health       double precision;
  v_severity     text;
  v_status       public.asset_status;
  v_uptime       double precision;
  v_rul          integer;
  v_conf         double precision;
  v_insight      text;
  v_reasons      text;
  v_action       text;
  v_scored       integer := 0;
  v_worst_sensor uuid;
  v_worst_value  double precision;
  c_window       constant interval := interval '5 minutes';
  c_alpha        constant double precision := 0.4;
begin
  for v_asset in
    select a.id, a.tag from public.assets a
    join public.synthetic_profiles p on p.asset_id = a.id
    where p.enabled and a.is_active
  loop
    if exists (
      select 1 from public.ml_predictions
      where asset_id = v_asset.id
        and model_id = '44444444-4444-4444-8444-444444444444'
        and predicted_at > now() - interval '7 minutes'
    ) then
      continue;
    end if;

    select
      max(greatest(0, least(1, 0.55 * (0.5 + 0.5 * public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) - 0.21))))
    into v_s_pen
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id
      and r.ts >= now() - c_window
      and s.sensor_type <> 'temperature';

    select
      max(greatest(0, least(1, 0.55 * (0.5 + 0.5 * public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) - 0.21))))
    into v_r_pen
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id
      and r.ts >= now() - c_window
      and s.sensor_type = 'temperature';

    if v_s_pen is null and v_r_pen is null then
      continue;
    end if;

    v_s_pen := coalesce(v_s_pen, 0);
    v_r_pen := coalesce(v_r_pen, 0);

    v_penalty := 1 - (1 - v_s_pen) * (1 - v_r_pen);
    v_health_raw := 100 * (1 - v_penalty);

    select (features->>'health_index')::double precision into v_health_prev
    from public.ml_predictions
    where asset_id = v_asset.id and features->>'source' = 'synthetic'
      and predicted_at > now() - interval '30 minutes'
    order by predicted_at desc
    limit 1;

    if v_health_prev is null then
      v_health := v_health_raw;
    else
      v_health := c_alpha * v_health_raw + (1 - c_alpha) * v_health_prev;
    end if;

    v_severity := case
      when v_health >= 85 then 'ok'
      when v_health >= 65 then 'info'
      when v_health >= 45 then 'alerta'
      else 'critico'
    end;

    v_status := case v_severity
      when 'ok'      then 'normal'::public.asset_status
      when 'info'    then 'normal'::public.asset_status
      when 'alerta'  then 'warning'::public.asset_status
      else                'critical'::public.asset_status
    end;

    v_uptime := round((78 + (v_health / 100.0) * 22)::numeric, 2);
    v_rul    := least(400, greatest(1, round(power(v_health, 3.5) / 19317.0)::integer));
    v_conf   := round((0.72 + (abs(v_health - 65) / 100.0) * 0.25)::numeric, 3);

    select r.sensor_id, r.value into v_worst_sensor, v_worst_value
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id and r.ts >= now() - c_window
    order by public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) desc nulls last
    limit 1;

    v_reasons := (
      select string_agg(txt, '; ') from (
        select case when v_r_pen > 0.08
               then 'resíduo térmico acima do esperado para a carga (aquecimento não explicado)' end as txt
        union all
        select case when v_s_pen > 0.08
               then 'padrão de operação atípico frente à linha de base saudável' end
      ) x where txt is not null
    );

    v_action := case v_severity
      when 'ok'      then 'Nenhuma ação necessária.'
      when 'info'    then 'Acompanhar nas próximas leituras.'
      when 'alerta'  then 'Agendar inspeção preventiva.'
      else                'Acionar a manutenção com prioridade.'
    end;

    if v_severity = 'ok' and v_reasons is null then
      v_insight := format('Operação dentro do padrão (saúde %s/100). Nenhum desvio relevante detectado.',
                          round(v_health));
    else
      v_insight := format('%s (saúde %s/100): %s. %s',
        case v_severity
          when 'critico' then 'Degradação crítica'
          when 'alerta'  then 'Desvio relevante'
          when 'info'    then 'Desvio leve'
          else                'Desvio pontual'
        end,
        round(v_health),
        coalesce(v_reasons, 'leve desvio em relação à linha de base'),
        v_action);
    end if;

    insert into public.ml_predictions (
      model_id, asset_id, sensor_id, prediction_type, predicted_at,
      value, confidence, horizon_days, rul_days, recommended_action, explanation, features
    ) values (
      '22222222-2222-4222-8222-222222222222',
      v_asset.id, v_worst_sensor, 'anomaly_score', now(),
      round((v_penalty * 100)::numeric, 2), v_conf, 30, v_rul, v_action, v_insight,
      jsonb_build_object(
        'health_index', round(v_health::numeric, 2),
        'health_raw', round(v_health_raw::numeric, 2),
        'anomaly_penalty', round(v_s_pen::numeric, 4),
        'thermal_penalty', round(v_r_pen::numeric, 4),
        'severity', v_severity,
        'window_minutes', 5,
        'source', 'synthetic'
      )
    );

    insert into public.asset_health_snapshots (asset_id, captured_at, uptime, anomaly_score, status, active_alerts)
    select v_asset.id, now(), v_uptime, round((v_penalty * 100)::numeric, 2), v_status,
           (select count(*) from public.alerts where asset_id = v_asset.id and status <> 'resolved');

    perform public.apply_anomaly_score(
      v_asset.id,
      v_health,
      v_penalty * 100,
      v_severity,
      v_insight,
      round((v_r_pen * 12)::numeric, 2)::double precision
    );

    update public.assets
    set status     = v_status,
        uptime     = v_uptime,
        updated_at = now()
    where id = v_asset.id;

    v_scored := v_scored + 1;
  end loop;

  return v_scored;
end;
$$;

-- A poda da 0018 só apaga predição 'synthetic'; a do modelo cresce ~2 mil
-- linhas/dia e segue a mesma retenção de 72 h.
create or replace function public.model_predictions_prune(p_keep interval default interval '72 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.ml_predictions
  where model_id = '44444444-4444-4444-8444-444444444444' and predicted_at < now() - p_keep;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'forzy-model-prune';
select cron.schedule('forzy-model-prune', '23 4 * * *', $$select public.model_predictions_prune()$$);
