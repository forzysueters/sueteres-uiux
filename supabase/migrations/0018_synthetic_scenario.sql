-- =============================================================================
-- 0018 — Cenário sintético 24/7 (planta simulada, dentro do próprio Postgres)
--
-- POR QUE ISTO EXISTE
--
-- Os endpoints reais do Forzy Lab só respondem segunda a quarta, das 12h às 14h
-- (ver 0014). Fora dessa janela ninguém insere linha em `sensor_readings`, e a
-- consequência é visível na tela: o gráfico não anda, o histórico não cresce e o
-- insight preditivo fica congelado. O tempo real do front nunca esteve quebrado
-- — ele escuta INSERT em `sensor_readings` por Realtime desde a 0010. O que
-- faltava era alguém inserindo.
--
-- Esta migração cria a planta que nunca para: um gerador de telemetria e um
-- avaliador de janela, ambos agendados em pg_cron, rodando dentro do banco. Não
-- depende de máquina ligada nem de navegador aberto — que é a diferença entre
-- "demo que funciona enquanto alguém olha" e série temporal de verdade.
--
--   cron 30s  → synthetic_tick()   pontos na grade de 10s, por sensor
--   cron 5min → synthetic_score()  avalia a janela e publica o diagnóstico
--
-- HONESTIDADE SOBRE O QUE ISTO É
--
-- Os números são gerados, não medidos. O que NÃO é inventado são as regras de
-- decisão: os limiares de severidade (85/65/45), a composição das penalidades
-- por "OR probabilístico", o suavizador exponencial do índice de saúde e o
-- formato do texto do insight vêm do modelo real em `anomaly/Anomaly-Model-main`
-- (src/config.py, src/model/baseline.py, src/model/insight.py). O que fica de
-- fora é a Isolation Forest treinada: floresta não roda em SQL, então a
-- penalidade de anomalia é reproduzida analiticamente a partir da posição do
-- valor entre os limiares do próprio sensor.
--
-- A classificação NÃO é escrita à mão em lugar nenhum: o avaliador lê a janela
-- de 5 minutos que está no banco e calcula. O perfil só decide onde a agulha
-- do gerador fica — quem diz a severidade é a conta.
--
-- Toda linha gerada aqui vai com `source = 'synthetic'`. É o que mantém a
-- coleta real do Forzy Lab separável no mesmo histórico — sem isso, a evidência
-- de ingestão real do Módulo 1 se perderia dentro do dado simulado.
-- =============================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Perfis — qual comportamento cada ativo encena
--
-- As quatro classes são as do modelo (`SEVERITY_*` em baseline.py). Manter isto
-- numa tabela, e não no corpo da função, é o que permite trocar um ativo de
-- perfil com um UPDATE, sem migração nova nem redeploy.
-- -----------------------------------------------------------------------------
create table if not exists public.synthetic_profiles (
  asset_id   uuid primary key references public.assets(id) on delete cascade,
  profile    text not null check (profile in ('ok', 'info', 'alerta', 'critico')),
  enabled    boolean not null default true,
  -- Semente por ativo: dois ativos do mesmo perfil não podem oscilar em
  -- uníssono, senão a planta inteira respira junto e denuncia a simulação.
  seed       double precision not null default random() * 1000,
  updated_at timestamptz not null default now()
);

comment on table public.synthetic_profiles is
  'Cenário simulado: qual das 4 classes do modelo de anomalia cada ativo encena 24/7.';

alter table public.synthetic_profiles enable row level security;

drop policy if exists synthetic_profiles_read on public.synthetic_profiles;
create policy synthetic_profiles_read on public.synthetic_profiles
  for select using (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- A escala comum: posição do valor entre os limiares do sensor
--
-- Cada sensor tem limiares em unidades que não se comparam (°C, mm/s, bar,
-- L/min). Em vez de constantes por tipo de sensor — tabela enorme e frágil —,
-- tudo trabalha numa coordenada única:
--
--   t = 0   no limiar de alerta
--   t = 1   no limiar crítico
--   t < 0   lado saudável
--
-- É o mesmo raciocínio que o gauge da tela usa, então o número gerado e a cor
-- exibida nunca podem se contradizer. Sensor invertido (`crit < warn`: vazão e
-- velocidade, onde cair é que é ruim) usa a mesma coordenada com o span
-- espelhado, e some do resto do código.
-- -----------------------------------------------------------------------------
create or replace function public.threshold_position(
  p_value     double precision,
  p_warn      double precision,
  p_crit      double precision,
  p_direction public.limit_direction default 'above'
)
returns double precision
language sql
immutable
as $$
  select case
    when p_value is null or p_warn is null or p_crit is null or p_warn = p_crit then null
    when p_direction = 'below' then (p_warn - p_value) / (p_warn - p_crit)
    when p_direction = 'above' then (p_value - p_warn) / (p_crit - p_warn)
    else null   -- 'band' precisa do nominal; nenhum sensor usa hoje.
  end;
$$;

comment on function public.threshold_position(double precision, double precision, double precision, public.limit_direction) is
  'Posição do valor na escala de limiares do sensor: 0 = alerta, 1 = crítico, <0 = saudável.';

/** Valor absoluto correspondente a uma posição `t` na escala do sensor. */
create or replace function public.threshold_value(
  p_t         double precision,
  p_warn      double precision,
  p_crit      double precision,
  p_direction public.limit_direction default 'above'
)
returns double precision
language sql
immutable
as $$
  select case
    when p_warn is null or p_crit is null then null
    when p_direction = 'below' then p_warn - p_t * (p_warn - p_crit)
    when p_direction = 'above' then p_warn + p_t * (p_crit - p_warn)
    else null
  end;
$$;

-- -----------------------------------------------------------------------------
-- Onde a agulha de cada perfil fica, na escala `t`
--
-- Os valores foram resolvidos de trás para frente: partindo do índice de saúde
-- que se quer em cada classe (~93 / ~75 / ~55 / ~29) e invertendo a conta do
-- avaliador, chega-se nestas quatro posições. É por isso que o gerador e o
-- avaliador concordam sem que ninguém escreva a severidade à mão.
--
-- A respiração (±0.10) foi verificada contra as fronteiras das quatro faixas:
-- nenhum perfil encosta na classe vizinha no pior canto da oscilação.
-- -----------------------------------------------------------------------------
create or replace function public.synthetic_position(p_profile text)
returns double precision
language sql
immutable
as $$
  select case p_profile
    when 'ok'      then -0.45   -- bem abaixo do limiar de alerta
    when 'info'    then -0.12   -- encostando no limiar, ainda saudável
    when 'alerta'  then  0.45   -- entre alerta e crítico
    when 'critico' then  1.08   -- passou do limiar crítico
    else -0.30
  end;
$$;

-- -----------------------------------------------------------------------------
-- synthetic_tick() — o motor que nunca para
--
-- Preenche a grade de 10s desde a última leitura sintética de cada sensor até
-- agora. Recuperar o atraso, em vez de inserir um ponto por execução, é o que
-- mantém o histórico íntegro se o cron falhar por alguns minutos (ou se o
-- projeto for pausado e retomado). O teto de 30 pontos evita que uma parada
-- longa dispare um backfill de horas numa única transação.
-- -----------------------------------------------------------------------------
create or replace function public.synthetic_tick()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sensor      record;
  v_last        timestamptz;
  v_ts          timestamptz;
  v_t           double precision;
  v_value       double precision;
  v_phase       double precision;
  v_inserted    integer := 0;
  v_points      integer;
  c_step        constant interval := interval '10 seconds';
  c_max_points  constant integer := 30;
begin
  for v_sensor in
    select s.id, s.asset_id, s.warning_threshold as warn, s.critical_threshold as crit,
           s.limit_direction as dir, p.profile, p.seed
    from public.sensors s
    join public.assets a on a.id = s.asset_id
    join public.synthetic_profiles p on p.asset_id = s.asset_id
    -- `a.is_active` não é detalhe: ativo desativado que continua publicando
    -- telemetria ao vivo é contradição visível (some da planta, mas o histórico
    -- cresce). O perfil dele fica cadastrado e volta sozinho na reativação.
    where s.is_active and a.is_active and p.enabled
      and s.warning_threshold is not null and s.critical_threshold is not null
  loop
    select max(ts) into v_last
    from public.sensor_readings
    where sensor_id = v_sensor.id and source = 'synthetic';

    -- Sensor novo no cenário: começa 6 minutos atrás, para a primeira janela do
    -- avaliador já ter o que ler em vez de esperar o ciclo seguinte.
    if v_last is null then
      v_last := now() - interval '6 minutes';
    end if;

    v_points := 0;
    v_ts := v_last + c_step;

    while v_ts <= now() and v_points < c_max_points loop
      -- Fase derivada do relógio: contínua entre execuções e deslocada pela
      -- semente do ativo, então nada oscila em uníssono.
      v_phase := extract(epoch from v_ts) / 160.0 + v_sensor.seed;
      v_t := public.synthetic_position(v_sensor.profile)
             + 0.070 * sin(v_phase)
             + 0.030 * sin(v_phase * 4.7 + 1.3);
      v_value := public.threshold_value(v_t, v_sensor.warn, v_sensor.crit, v_sensor.dir);

      -- `status` e `quality` NÃO são preenchidos aqui de propósito: o trigger
      -- `process_sensor_reading` (0012) classifica toda leitura na entrada,
      -- respeitando direção do limite e faixa do sensor. Duplicar essa regra
      -- seria criar uma segunda fonte de verdade que cedo ou tarde diverge.
      if v_value is not null then
        insert into public.sensor_readings (sensor_id, asset_id, ts, value, raw_value, source)
        values (
          v_sensor.id, v_sensor.asset_id, v_ts,
          round(v_value::numeric, 3), round(v_value::numeric, 3),
          'synthetic'
        );
        v_inserted := v_inserted + 1;
      end if;

      v_ts := v_ts + c_step;
      v_points := v_points + 1;
    end loop;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.synthetic_tick() is
  'Gera a telemetria sintética na grade de 10s, recuperando o atraso desde a última leitura.';

-- -----------------------------------------------------------------------------
-- synthetic_score() — o diagnóstico da janela de 5 minutos
--
-- Reproduz a cadeia de `score_health` (baseline.py) sobre o que está no banco:
--
--   penalidade de anomalia  ← pior sensor não-térmico da janela
--   penalidade térmica      ← sensor de temperatura da janela
--   penalty = 1 - (1-s)(1-r)                      ("OR probabilístico")
--   health  = 100 * (1 - penalty), suavizado por EWM contra o tick anterior
--   severidade por 85 / 65 / 45                   (config.py)
--
-- O alpha do EWM é 0.4, não os 0.03 do config: lá o suavizador corre sobre
-- amostras de 10s, aqui sobre ticks de 5 minutos. Manter 0.03 numa cadência 30x
-- mais lenta faria o índice levar dias para refletir uma mudança de estado.
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
    -- Penalidade de anomalia: o pior sensor não-térmico da janela. `p` é a
    -- posição na escala de limiares convertida em penalidade 0..1 pela mesma
    -- reta que o gerador inverte.
    select
      max(greatest(0, least(1, 0.55 * (0.5 + 0.5 * public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) - 0.21))))
    into v_s_pen
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id
      and r.ts >= now() - c_window
      and s.sensor_type <> 'temperature';

    -- Penalidade térmica: o resíduo do modelo é substituído aqui pela posição
    -- da temperatura entre os próprios limiares — mesma faixa 0..1, mesma
    -- combinação a seguir.
    select
      max(greatest(0, least(1, 0.55 * (0.5 + 0.5 * public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) - 0.21))))
    into v_r_pen
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id
      and r.ts >= now() - c_window
      and s.sensor_type = 'temperature';

    -- Janela vazia (ativo sem sensor com limiar, ou cron ainda não rodou):
    -- não inventa diagnóstico, apenas pula.
    if v_s_pen is null and v_r_pen is null then
      continue;
    end if;

    v_s_pen := coalesce(v_s_pen, 0);
    v_r_pen := coalesce(v_r_pen, 0);

    v_penalty := 1 - (1 - v_s_pen) * (1 - v_r_pen);
    v_health_raw := 100 * (1 - v_penalty);

    -- Estado do suavizador: vem do ÚLTIMO diagnóstico deste avaliador, não da
    -- coluna `assets.health_index`. A coluna carrega o valor semeado e é
    -- escrita por outros caminhos; usá-la como memória do EWM fazia o primeiro
    -- ciclo herdar um número que nada tem a ver com a janela — um ativo em
    -- alerta aparecia como "info" até a média arrastar, várias execuções depois.
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

    -- Severidade pelos cortes de config.py.
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

    -- Disponibilidade, vida útil e confiança derivam do índice de saúde: uma
    -- máquina em degradação crítica não pode aparecer com 100% de uptime e 240
    -- dias de vida restante, que é o tipo de incoerência que a banca cobra.
    v_uptime := round((78 + (v_health / 100.0) * 22)::numeric, 2);
    -- Vida útil restante: lei de potência calibrada para dar ~6 dias em
    -- degradação crítica, ~45 em alerta, ~170 em desvio leve e ~355 em operação
    -- normal. Uma relação linear com a saúde daria 27 dias para um ativo em
    -- colapso — número que a própria tela desmente ao lado, no alerta crítico.
    v_rul    := least(400, greatest(1, round(power(v_health, 3.5) / 19317.0)::integer));
    v_conf   := round((0.72 + (abs(v_health - 65) / 100.0) * 0.25)::numeric, 3);

    -- Sensor que puxou o diagnóstico — é o que o texto do insight cita.
    select r.sensor_id, r.value into v_worst_sensor, v_worst_value
    from public.sensor_readings r
    join public.sensors s on s.id = r.sensor_id
    where r.asset_id = v_asset.id and r.ts >= now() - c_window
    order by public.threshold_position(r.value, s.warning_threshold, s.critical_threshold, s.limit_direction) desc nulls last
    limit 1;

    -- Texto no mesmo formato de insight.py: prefixo por severidade, motivo,
    -- ação. Sem LLM — determinístico e auditável.
    -- O piso para CITAR um motivo (0.08) não é o mesmo que o piso para
    -- penalizar. Em insight.py o resíduo térmico já chega zerado abaixo de 3σ,
    -- então "há motivo" e "há penalidade" coincidem lá. Aqui a rampa é
    -- contínua e um ativo saudável carrega uma penalidade residual pequena —
    -- sem este piso, o texto dizia "resíduo térmico acima do esperado" e
    -- "nenhuma ação necessária" na mesma frase. Calibrado entre o pior canto
    -- de 'ok' (0.063) e o melhor canto de 'info' (0.099).
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

    -- ─── Publica o diagnóstico ────────────────────────────────────────────
    insert into public.ml_predictions (
      model_id, asset_id, sensor_id, prediction_type, predicted_at,
      value, confidence, horizon_days, rul_days, recommended_action, explanation, features
    ) values (
      '22222222-2222-4222-8222-222222222222',    -- Detector de Anomalias
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

    -- `severity`, `insight`, `thermal_residual` e `scored_at` são gravados pela
    -- RPC que já existe desde a 0012 — é a mesma porta que o front usava para
    -- persistir o diagnóstico, e `v_assets_full` lê desses campos. Reusá-la, em
    -- vez de repetir o UPDATE aqui, evita que os dois caminhos divirjam.
    perform public.apply_anomaly_score(
      v_asset.id,
      v_health,
      v_penalty * 100,
      v_severity,
      v_insight,
      round((v_r_pen * 12)::numeric, 2)::double precision   -- °C aproximados de resíduo
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

comment on function public.synthetic_score() is
  'Avalia a janela de 5 min de cada ativo do cenário e publica predição, snapshot e estado.';

-- -----------------------------------------------------------------------------
-- Retenção — a planta simulada não pode crescer para sempre
--
-- 8 ativos x ~3 sensores x 6 pontos/min = ~150 mil linhas/dia. Sem poda, o
-- banco do projeto estoura em semanas. Guardamos 72h de telemetria sintética —
-- cobre com folga o histórico que a tela mostra. O dado REAL do Forzy Lab nunca
-- é tocado: a cláusula filtra por source.
-- -----------------------------------------------------------------------------
create or replace function public.synthetic_prune(p_keep interval default interval '72 hours')
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_deleted integer;
begin
  delete from public.sensor_readings
  where source = 'synthetic' and ts < now() - p_keep;
  get diagnostics v_deleted = row_count;

  delete from public.ml_predictions
  where features->>'source' = 'synthetic' and predicted_at < now() - p_keep;

  delete from public.asset_health_snapshots
  where captured_at < now() - p_keep;

  return v_deleted;
end;
$$;

comment on function public.synthetic_prune(interval) is
  'Poda a telemetria sintética antiga. Nunca remove leitura de origem real.';

-- -----------------------------------------------------------------------------
-- Realtime — o front já escuta sensor_readings; falta ouvir o diagnóstico
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ml_predictions', 'asset_health_snapshots'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;

alter table public.ml_predictions          replica identity full;
alter table public.asset_health_snapshots  replica identity full;

-- -----------------------------------------------------------------------------
-- Agendamento
--
-- O gerador roda a 30s (mesma cadência do coletor real da 0014) e preenche a
-- grade de 10s por dentro. O avaliador roda a cada 5 minutos, no minuto cheio —
-- é isso que deixa a contagem regressiva da tela previsível.
-- -----------------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job
where jobname in ('forzy-synthetic-readings', 'forzy-synthetic-scoring', 'forzy-synthetic-prune');

select cron.schedule('forzy-synthetic-readings', '30 seconds', $$select public.synthetic_tick()$$);
select cron.schedule('forzy-synthetic-scoring',  '*/5 * * * *', $$select public.synthetic_score()$$);
select cron.schedule('forzy-synthetic-prune',    '17 4 * * *',  $$select public.synthetic_prune()$$);

-- -----------------------------------------------------------------------------
-- MTR-100 não tinha sensor nenhum
--
-- Um ativo sem sensor não tem janela para o avaliador ler, e apareceria como o
-- único motor parado numa planta que respira. Recebe o mesmo trio de canais que
-- o modelo usa (velocidade de vibração, aceleração e temperatura), com os
-- limiares dos outros motores da planta.
-- -----------------------------------------------------------------------------
insert into public.sensors (
  asset_id, tag, name, sensor_type, unit,
  min_value, max_value, warning_threshold, critical_threshold,
  limit_direction, display_order, is_active
)
select a.id, 'MTR-100.' || v.sufixo, v.nome, v.tipo::public.sensor_type, v.unidade,
       v.mn, v.mx, v.warn, v.crit, 'above'::public.limit_direction, v.ordem, true
from public.assets a
cross join (values
  ('VIB',  'Vibração — Velocidade', 'vibration',   'mm/s', 0.0, 20.0,  4.5,  7.1,  1),
  ('ACC',  'Vibração — Aceleração', 'vibration',   'm/s²', 0.0,  5.0,  0.83, 1.31, 2),
  ('TEMP', 'Temperatura',           'temperature', '°C',   0.0, 120.0, 75.0, 90.0, 3)
) as v(sufixo, nome, tipo, unidade, mn, mx, warn, crit, ordem)
where a.tag = 'MTR-100'
  and not exists (select 1 from public.sensors s where s.tag = 'MTR-100.' || v.sufixo);

-- -----------------------------------------------------------------------------
-- Os perfis do cenário — duas encenações por classe
--
-- Escolhidos para não contradizer o que o banco já dizia (CMP-001 já estava
-- crítico, MTR-002 em alerta, MTR-001 normal), de modo que o histórico anterior
-- e as respostas que o Órion já dava continuam de pé.
-- -----------------------------------------------------------------------------
insert into public.synthetic_profiles (asset_id, profile)
select a.id, v.perfil
from public.assets a
join (values
  ('CMP-001', 'critico'),   -- Compressor de Ar
  ('MTR-002', 'critico'),   -- Motor de Reserva
  ('BBA-001', 'alerta'),    -- Bomba de Circulação
  ('LAB-S2',  'alerta'),    -- Forzy Lab — Ponto 2
  ('MTR-100', 'info'),      -- Motor e envase (desativado hoje; entra se reativarem)
  ('LAB-S1',  'info'),      -- Forzy Lab — Ponto 1
  ('MTR-001', 'ok'),        -- Motor de Produção Principal
  ('EXA-001', 'ok')         -- Exaustor de Ventilação
) as v(tag, perfil) on v.tag = a.tag
on conflict (asset_id) do update set profile = excluded.profile, updated_at = now();
