-- =============================================================================
-- seed.sql — Conjunto de demonstração do Gêmeo Digital Forzy
--
-- Os ativos, TAGs, áreas, coordenadas de planta, valores nominais e limites de
-- engenharia reproduzem exatamente o que o front já consome (ver
-- src/services/sensorLimits.ts). O banco passa a ser a fonte desses números.
--
-- Re-executável: os dados transacionais da planta FORZY-LAB são recriados a
-- cada execução; usuários (auth) vêm de scripts/create-demo-users.mjs.
-- =============================================================================

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. Limpeza do conjunto de demonstração
-- -----------------------------------------------------------------------------
do $$
declare
  v_plant uuid;
  -- Conjunto sintético de demonstração: é o que este seed recria a cada execução.
  v_demo  text[] := array['MTR-001', 'MTR-002', 'BBA-001', 'CMP-001', 'EXA-001'];
  -- Pontos de medição REAIS, criados pela migração 0014 na MESMA planta.
  -- O seed não os cria e não pode apagá-los: levaria junto a telemetria já
  -- coletada dos endpoints da Forzy, que só se recupera esperando a próxima
  -- janela (seg/ter/qua, 12h-14h). Por isso toda a limpeza abaixo é escopada
  -- aos ativos sintéticos, e não à planta inteira.
  v_real  text[] := array['LAB-S1', 'LAB-S2'];
  v_demo_assets uuid[];
begin
  select id into v_plant from public.plants where code = 'FORZY-LAB';
  if v_plant is null then return; end if;

  select coalesce(array_agg(id), '{}') into v_demo_assets
    from public.assets
   where plant_id = v_plant and tag = any(v_demo);

  delete from public.sensor_readings        where asset_id = any(v_demo_assets);
  delete from public.asset_health_snapshots where asset_id = any(v_demo_assets);
  delete from public.ml_predictions         where asset_id = any(v_demo_assets);
  delete from public.maintenance_orders     where asset_id = any(v_demo_assets);
  delete from public.alerts                 where asset_id = any(v_demo_assets);
  delete from public.document_chunks        where asset_id = any(v_demo_assets);
  delete from public.documents              where asset_id = any(v_demo_assets)
                                               or (plant_id = v_plant and asset_id is null);
  delete from public.asset_nameplates       where asset_id = any(v_demo_assets);
  delete from public.ml_training_runs where model_id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  );

  -- Sensores que saíram do conjunto de um ativo que permanece. O insert da
  -- seção 4 usa `on conflict do update`, que nunca remove: sem este delete os
  -- sensores antigos dos motores (VOLT/CURR/RPM) sobreviveriam ao re-seed.
  delete from public.sensors s
   using public.assets a
   where s.asset_id = a.id
     and a.plant_id = v_plant
     and a.tag in ('MTR-001', 'MTR-002')
     and s.tag !~ '\.(VIB|ACC|TEMP)$';

  -- Ativos de execuções anteriores cujo TAG saiu do conjunto (sensores e
  -- demais dependências caem por cascade). Os pontos reais são preservados.
  delete from public.assets
   where plant_id = v_plant
     and tag <> all(v_demo)
     and tag <> all(v_real);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Planta e áreas
-- -----------------------------------------------------------------------------
insert into public.plants (code, name, description, address, city, state)
values (
  'FORZY-LAB',
  'Forzy Lab — Unidade Industrial A',
  'Laboratório de gêmeo digital com motores instrumentados via OPC-UA.',
  'Av. Lineu Prestes, 2242',
  'São Paulo',
  'SP'
)
on conflict (code) do update
  set name = excluded.name, description = excluded.description;

-- Os nomes são exatamente os que a UI exibe em Asset.area.
insert into public.areas (plant_id, code, name, description, grid_cols, grid_rows, display_order)
select p.id, v.code, v.name, v.description, 3, 3, v.ord
from public.plants p,
  (values
    ('HALL-A',     'Hall A',     'Linha principal de produção.',            1),
    ('HALL-B',     'Hall B',     'Sistema de circulação de refrigeração.',  2),
    ('HALL-C',     'Hall C',     'Geração e distribuição de ar comprimido.', 3),
    ('COBERTURA',  'Cobertura',  'Área técnica de exaustão na cobertura.',   4)
  ) as v(code, name, description, ord)
where p.code = 'FORZY-LAB'
on conflict (plant_id, code) do update
  set name = excluded.name, description = excluded.description;

update public.profiles
   set plant_id = (select id from public.plants where code = 'FORZY-LAB')
 where plant_id is null;

-- -----------------------------------------------------------------------------
-- 3. Ativos
-- -----------------------------------------------------------------------------
insert into public.assets (
  plant_id, area_id, tag, name, asset_type, location, criticality,
  grid_x, grid_y, plant_x, plant_y, commissioned_at,
  last_maintenance, next_maintenance, metadata
)
select
  p.id, ar.id,
  v.tag, v.name, v.asset_type::public.asset_type, v.location,
  v.criticality::public.criticality_level,
  v.gx, v.gy, v.px, v.py,
  current_date - (v.age_days || ' days')::interval,
  v.last_maint::date,
  v.next_maint::date,
  v.metadata::jsonb
from (values
  ('MTR-001', 'Motor de Produção Principal',          'motor',      'HALL-A',    'Hall A — Posto 1',                    'critical', 1, 1, 20, 25, 1460, '2026-03-15', '2026-06-15', '{"opcua_ns":"ns=2;s=MTR001","phases":3}'),
  ('MTR-002', 'Motor de Reserva',                     'motor',      'HALL-A',    'Hall A — Posto 2',                    'high',     3, 1, 36, 25, 1095, '2026-01-20', '2026-04-20', '{"opcua_ns":"ns=2;s=MTR002","phases":3}'),
  ('BBA-001', 'Bomba de Circulação de Refrigeração',  'pump',       'HALL-B',    'Hall B — Sistema de Refrigeração',    'high',     1, 3, 20, 65, 980,  '2026-02-28', '2026-05-28', '{"opcua_ns":"ns=2;s=BBA001","fluid":"água glicolada"}'),
  ('CMP-001', 'Compressor de Ar',                     'compressor', 'HALL-C',    'Hall C — Pneumática',                 'critical', 3, 3, 70, 65, 2190, '2025-12-10', '2026-03-10', '{"opcua_ns":"ns=2;s=CMP001","reservoir_l":500}'),
  ('EXA-001', 'Exaustor de Ventilação',               'fan',        'COBERTURA', 'Área Técnica — Cobertura Norte',      'medium',   2, 2, 55, 20, 730,  '2026-03-01', '2026-06-01', '{"opcua_ns":"ns=2;s=EXA001"}')
) as v(tag, name, asset_type, area_code, location, criticality, gx, gy, px, py, age_days, last_maint, next_maint, metadata)
cross join public.plants p
join public.areas ar on ar.plant_id = p.id and ar.code = v.area_code
where p.code = 'FORZY-LAB'
on conflict (plant_id, tag) do update
  set name             = excluded.name,
      area_id          = excluded.area_id,
      asset_type       = excluded.asset_type,
      location         = excluded.location,
      criticality      = excluded.criticality,
      grid_x           = excluded.grid_x,
      grid_y           = excluded.grid_y,
      plant_x          = excluded.plant_x,
      plant_y          = excluded.plant_y,
      commissioned_at  = excluded.commissioned_at,
      last_maintenance = excluded.last_maintenance,
      next_maintenance = excluded.next_maintenance,
      metadata         = excluded.metadata;

-- -----------------------------------------------------------------------------
-- 4. Sensores
--    warn/crit/direction/nominal e a justificativa reproduzem sensorLimits.ts.
--    metadata.nominal/.noise/.drift alimentam a geração do histórico.
--    raw_min/raw_max = laço de corrente 4-20 mA (Módulo 1).
-- -----------------------------------------------------------------------------
insert into public.sensors (
  asset_id, tag, name, sensor_type, unit,
  min_value, max_value, warning_threshold, critical_threshold,
  limit_direction, nominal_value, limit_source, display_order,
  raw_min, raw_max, raw_unit, opcua_node_id, mqtt_topic, sampling_interval_s, metadata
)
select
  a.id,
  a.tag || '.' || v.suffix,
  v.name, v.stype::public.sensor_type, v.unit,
  v.vmin, v.vmax, v.warn, v.crit,
  v.direction::public.limit_direction, v.nominal_limit, v.source, v.ord,
  4, 20, 'mA',
  format('ns=2;s=%s.%s', a.tag, v.suffix),
  format('forzy/%s/%s', lower(a.tag), lower(v.suffix)),
  5,
  jsonb_build_object('nominal', v.base, 'noise', v.noise, 'drift', v.drift)
from (values
  -- ── MTR-001 · WEG W22 IE3, 1760 rpm de placa ─────────────────────────────
  --    Mesmas três grandezas dos pontos de medição reais (LAB-S1/LAB-S2): é o
  --    mesmo tipo de máquina e o mesmo acelerômetro da Forzy.
  --    Aceleração derivada da vibração pela relação harmônica a = 2πf·v, com
  --    f = 1760/60 = 29,33 Hz ⇒ 2πf = 184,3 s⁻¹. Nominal: 184,3 × 2,3 mm/s.
  -- O `null::float` não é decorativo: `nominal_limit` só é preenchido em limites
  -- de direção 'band', e a Tensão dos motores era a única linha que o usava. Sem
  -- um valor tipado em algum lugar da lista, o Postgres infere text para a coluna
  -- inteira e o insert falha ("nominal_value is of type double precision").
  ('MTR-001', 'VIB',  'Velocidade de Vibração', 'vibration',   'mm/s',   0,   20,   4.5,    7.1,  'above', null::float, 'ISO 10816-3 — zona B/C e C/D',                   1,    2.3,  0.4,  0.3),
  ('MTR-001', 'ACC',  'Aceleração',             'vibration',   'm/s²',   0,    5,   0.83,   1.31, 'above', null, 'ISO 10816-3 convertida a 1760 rpm (a = 2πf·v)',         2,    0.42, 0.07, 0.06),
  ('MTR-001', 'TEMP', 'Temperatura',            'temperature', '°C',     0,  120,  75.0,   90.0,  'above', null, 'Isolamento classe F',                                  3,   62.0,  4.0,  1.5),

  -- ── MTR-002 · Siemens SIMOTICS SD, 1465 rpm ──────────────────────────────
  --    Rolamento em degradação: vibração na zona C e calor no mancal. O drift
  --    da aceleração acompanha o da vibração na mesma proporção (~12%), senão
  --    os dois sensores do mesmo motor contariam histórias diferentes.
  --    f = 1465/60 = 24,42 Hz ⇒ 2πf = 153,4 s⁻¹. Nominal: 153,4 × 4,9 mm/s.
  ('MTR-002', 'VIB',  'Velocidade de Vibração', 'vibration',   'mm/s',   0,   20,   4.5,    7.1,  'above', null, 'ISO 10816-3 — zona B/C e C/D',                          1,    4.9,  0.5,  0.6),
  ('MTR-002', 'ACC',  'Aceleração',             'vibration',   'm/s²',   0,    5,   0.69,   1.09, 'above', null, 'ISO 10816-3 convertida a 1465 rpm (a = 2πf·v)',         2,    0.75, 0.08, 0.09),
  ('MTR-002', 'TEMP', 'Temperatura',            'temperature', '°C',     0,  120,  75.0,   90.0,  'above', null, 'Isolamento classe F',                                  3,   74.0,  4.0,  7.0),

  -- ── BBA-001 · KSB Etanorm 32-200, 5,5 kW ─────────────────────────────────
  ('BBA-001', 'PRES', 'Pressão',           'pressure',    'bar',      0,    6,   3.5,    4.2, 'above', null,  'Pressão de recalque do circuito de refrigeração',          1,    2.5,  0.18, 0.0),
  ('BBA-001', 'FLOW', 'Vazão',             'flow',        'L/min',    0,  250, 120.0,  100.0, 'below', null,  'Vazão mínima de projeto do circuito (145 L/min nominal)',  2,  145.0,  7.0,  0.0),
  ('BBA-001', 'TEMP', 'Temperatura',       'temperature', '°C',       0,   90,  60.0,   75.0, 'above', null,  'Fluido de refrigeração — perda de eficiência térmica',     3,   44.0,  3.0,  0.0),
  ('BBA-001', 'PWR',  'Potência',          'power',       'kW',       0,   10,   5.5,    6.3, 'above', null,  'P = 5,5 kW de placa, fator de serviço 1,15',               4,    5.2,  0.25, 0.0),

  -- ── CMP-001 · Atlas Copco GA 22+, In = 42,0 A ────────────────────────────
  --    Falha mecânica isolada no conjunto rotativo: só a vibração dispara.
  ('CMP-001', 'PRES', 'Pressão de Saída',  'pressure',    'bar',      0,   12,   8.5,    9.5, 'above', null,  'Pressão de trabalho 7 bar, alívio da válvula em 9,5',      1,    7.0,  0.35, 0.0),
  ('CMP-001', 'TIN',  'Temp. Entrada',     'temperature', '°C',       0,   60,  40.0,   50.0, 'above', null,  'Ar de admissão — acima disso a eficiência volumétrica cai',2,   28.0,  2.0,  0.0),
  ('CMP-001', 'TOUT', 'Temp. Saída',       'temperature', '°C',       0,  140,  95.0,  110.0, 'above', null,  'Descarga — degradação do óleo do estágio',                 3,   84.0,  4.0,  6.0),
  ('CMP-001', 'CURR', 'Corrente Motor',    'current',     'A',        0,   60,  42.0,   48.3, 'above', null,  'In = 42,0 A de placa, fator de serviço 1,15',              4,   40.5,  2.0,  0.0),
  ('CMP-001', 'VIB',  'Vibração',          'vibration',   'mm/s',     0,   20,   4.5,    7.1, 'above', null,  'ISO 10816-3 — zona B/C e C/D',                             5,    6.4,  0.5,  2.2),

  -- ── EXA-001 · WEG W21 71 IE2, 0,75 kW → ISO 10816-3 classe I ─────────────
  ('EXA-001', 'SPD',  'Velocidade',        'speed',       '%',        0,  100,  60.0,   40.0, 'below', null,  'Rotação mínima para a renovação de ar do galpão',          1,   84.0,  3.0,  0.0),
  ('EXA-001', 'CURR', 'Corrente Motor',    'current',     'A',        0,   15,   3.2,    3.68,'above', null,  'In = 3,2 A de placa, fator de serviço 1,15',               2,    3.1,  0.2,  0.0),
  ('EXA-001', 'TEMP', 'Temp. Mancal',      'temperature', '°C',       0,  100,  70.0,   85.0, 'above', null,  'Graxa de rolamento, vida útil cai pela metade a cada +15 °C', 3, 54.0, 3.0,  0.0),
  ('EXA-001', 'VIB',  'Vibração',          'vibration',   'mm/s',     0,   10,   2.8,    4.5, 'above', null,  'ISO 10816-3 — classe I, zona B/C e C/D',                   4,    1.1,  0.2,  0.0)
) as v(asset_tag, suffix, name, stype, unit, vmin, vmax, warn, crit, direction, nominal_limit, source, ord, base, noise, drift)
join public.assets a on a.tag = v.asset_tag
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB')
on conflict (asset_id, tag) do update
  set name               = excluded.name,
      sensor_type        = excluded.sensor_type,
      unit               = excluded.unit,
      min_value          = excluded.min_value,
      max_value          = excluded.max_value,
      warning_threshold  = excluded.warning_threshold,
      critical_threshold = excluded.critical_threshold,
      limit_direction    = excluded.limit_direction,
      nominal_value      = excluded.nominal_value,
      limit_source       = excluded.limit_source,
      display_order      = excluded.display_order,
      raw_min            = excluded.raw_min,
      raw_max            = excluded.raw_max,
      raw_unit           = excluded.raw_unit,
      opcua_node_id      = excluded.opcua_node_id,
      mqtt_topic         = excluded.mqtt_topic,
      metadata           = excluded.metadata;

-- -----------------------------------------------------------------------------
-- 5. Placas de dados (MotorNameplate — resultado do OCR, Módulo 2)
-- -----------------------------------------------------------------------------
insert into public.asset_nameplates (
  asset_id, status, serial_number, manufacturer, model, year_manufactured,
  motor_type, power_kw, power_hp, voltage, current_a, rpm, poles, frequency_hz,
  connection_type, service_factor, insulation_class, ip_rating, efficiency_class,
  ocr_provider, ocr_confidence, ocr_raw, confirmed_at, registered_by, confirmed_by
)
select
  a.id, 'confirmed'::public.nameplate_status,
  v.serial, v.manufacturer, v.model, v.year,
  v.motor_type, v.kw, v.cv, v.voltage, v.amps, v.rpm, v.poles, v.hz,
  v.conn, 1.15, v.insul, v.ip, v.eff,
  'easyocr', v.conf,
  jsonb_build_object('engine', 'easyocr', 'pipeline', 'ocr/ WEG W22 FastAPI'),
  v.registered_at::timestamptz,
  (select id from public.profiles where email = 'technician@industrial.com'),
  (select id from public.profiles where email = 'engineer@industrial.com')
from (values
  ('MTR-001', 'WEG2024-MTR001',   'WEG',         'W22 IE3',        2021, 'Trifásico assíncrono de indução', 22.000, 30.000, '380/660V', 41.8, 1760, 4, 60, 'Delta/Star', 'F', 'IP55', 'IE3', 0.9700, '2026-03-16T08:00:00Z'),
  ('MTR-002', 'SIE2023-MTR002',   'Siemens',     'SIMOTICS SD',    2022, 'Trifásico assíncrono de indução', 37.000, 50.000, '380/660V', 68.5, 1475, 4, 60, 'Delta/Star', 'F', 'IP55', 'IE3', 0.9400, '2026-01-21T10:30:00Z'),
  ('BBA-001', 'SN-KSB-20220615',  'KSB',         'Etanorm 32-200', 2022, 'Motobomba centrífuga',             5.500,  7.500, '380V',     11.2, 1450, 4, 60, 'Star',       'B', 'IP54', 'IE3', 0.9100, '2026-03-01T09:00:00Z'),
  ('CMP-001', 'SN-AC-20211210',   'Atlas Copco', 'GA 22+',         2020, 'Compressor de parafuso rotativo', 22.000, 30.000, '380V',     42.0, 2950, 2, 60, 'Delta',      'F', 'IP55', 'IE4', 0.8800, '2025-12-11T14:00:00Z'),
  ('EXA-001', 'SN-WEG-20230301',  'WEG',         'W21 71 IE2',     2023, 'Ventilador axial',                 0.750,  1.000, '220/380V',  3.2, 1710, 4, 60, 'Delta/Star', 'F', 'IP55', 'IE2', 0.9900, '2026-03-02T11:00:00Z')
) as v(asset_tag, serial, manufacturer, model, year, motor_type, kw, cv, voltage, amps, rpm, poles, hz, conn, insul, ip, eff, conf, registered_at)
join public.assets a on a.tag = v.asset_tag
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB')
on conflict (serial_number) where serial_number is not null and status = 'confirmed'
do update set
  asset_id       = excluded.asset_id,
  manufacturer   = excluded.manufacturer,
  model          = excluded.model,
  power_kw       = excluded.power_kw,
  ocr_confidence = excluded.ocr_confidence;

-- -----------------------------------------------------------------------------
-- 6. Histórico de telemetria — 48 h a cada 5 min
--    O trigger de alerta automático fica suspenso para não duplicar os alertas
--    curados da seção 7; a classificação de status continua ativa.
-- -----------------------------------------------------------------------------
alter table public.sensor_readings disable trigger sensor_readings_raise_alert;

insert into public.sensor_readings (sensor_id, asset_id, ts, value, raw_value, source)
select
  s.id,
  s.asset_id,
  t.ts,
  v.val,
  round((4 + (least(greatest(v.val, s.min_value), s.max_value) - s.min_value)
             * 16.0 / (s.max_value - s.min_value))::numeric, 3),
  'opcua'
from public.sensors s
join public.assets a on a.id = s.asset_id
cross join generate_series(
  date_trunc('minute', now()) - interval '48 hours',
  date_trunc('minute', now()),
  interval '5 minutes'
) as t(ts)
cross join lateral (
  select least(
    greatest(
      (s.metadata ->> 'nominal')::double precision
        -- ciclo de carga diário
        + 0.35 * (s.metadata ->> 'noise')::double precision
              * sin(2 * pi() * extract(epoch from t.ts) / 86400.0)
        -- ruído de medição
        + (s.metadata ->> 'noise')::double precision * (random() - 0.5) * 2
        -- degradação progressiva ao longo da janela
        + (s.metadata ->> 'drift')::double precision
              * power(extract(epoch from (t.ts - (date_trunc('minute', now()) - interval '48 hours')))
                      / 172800.0, 1.2),
      s.min_value
    ),
    s.max_value
  ) as val
) v
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB')
  and s.is_active
  -- NUNCA gerar histórico sintético para os pontos de medição reais: a série
  -- deles vem dos endpoints da Forzy (migração 0014) e misturar dado fabricado
  -- aqui destruiria justamente a distinção entre real e demonstração. O filtro
  -- por metadata é o mesmo critério: só tem perfil sintético quem declara
  -- 'nominal'/'noise'/'drift' na seção 4.
  and a.tag <> all(array['LAB-S1', 'LAB-S2'])
  and s.metadata ? 'nominal';

alter table public.sensor_readings enable trigger sensor_readings_raise_alert;

-- -----------------------------------------------------------------------------
-- 7. Alertas curados
--    Só existe alerta onde há sensor fora de faixa — a mesma regra que o front
--    aplica em deriveAlerts. Os números saem dos limites da seção 4.
-- -----------------------------------------------------------------------------
insert into public.alerts (
  asset_id, sensor_id, severity, status, source, title, message, ml_insight,
  triggered_value, threshold_value, triggered_at,
  acknowledged_at, acknowledged_by, metadata
)
select
  a.id, s.id,
  v.severity::public.alert_severity,
  v.status::public.alert_status,
  v.source::public.alert_source,
  v.title, v.message, v.insight,
  v.value, v.threshold,
  now() - (v.age_minutes || ' minutes')::interval,
  case when v.status = 'acknowledged' then now() - interval '4 hours' end,
  case when v.status = 'acknowledged'
       then (select id from public.profiles where email = 'technician@industrial.com') end,
  '{"seed": true}'::jsonb
from (values
  ('CMP-001', 'VIB',  'critical', 'active', 'ml',
    'Vibração acima do limite crítico',
    'A vibração do compressor ultrapassou 7,1 mm/s — zona D da ISO 10816-3, severidade inaceitável em regime.',
    'Assinatura espectral compatível com desgaste da pista externa do rolamento do lado acoplado. O modelo prevê falha em até 7 dias com 89% de confiança. Pressão, temperaturas e corrente seguem em faixa: o problema é mecânico e está isolado no conjunto rotativo.',
    8.1, 7.1, 5),
  ('MTR-002', 'VIB',  'warning', 'active', 'ml',
    'Vibração na zona C da ISO 10816-3',
    'A vibração do motor de reserva está acima de 4,5 mm/s de forma sustentada.',
    'O atrito do rolamento em degradação eleva a vibração primeiro; o calor gerado no mancal aparece depois na temperatura da carcaça. Os sensores elétricos seguem nominais — é falha mecânica, não de carga.',
    5.2, 4.5, 95),
  ('MTR-002', 'TEMP', 'warning', 'acknowledged', 'rule',
    'Temperatura da carcaça acima da faixa',
    'A temperatura do motor de reserva ultrapassou 75 °C, limite de atenção do isolamento classe F.',
    'Elevação térmica consistente com a degradação do mancal já sinalizada pela vibração. Recomenda-se antecipar a inspeção mecânica.',
    79.0, 75.0, 150)
) as v(asset_tag, sensor_suffix, severity, status, source, title, message, insight, value, threshold, age_minutes)
join public.assets a on a.tag = v.asset_tag
join public.sensors s on s.asset_id = a.id and s.tag = a.tag || '.' || v.sensor_suffix
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB');

-- -----------------------------------------------------------------------------
-- 8. Ordens de manutenção
-- -----------------------------------------------------------------------------
insert into public.maintenance_orders (
  asset_id, maintenance_type, status, priority, title, description,
  scheduled_for, started_at, completed_at, assigned_to, created_by,
  estimated_hours, downtime_minutes, cost, checklist
)
select
  a.id,
  v.mtype::public.maintenance_type,
  v.mstatus::public.maintenance_status,
  v.priority::public.criticality_level,
  v.title, v.description,
  now() + (v.days_ahead || ' days')::interval,
  case when v.mstatus in ('in_progress', 'completed') then now() + (v.days_ahead || ' days')::interval end,
  case when v.mstatus = 'completed' then now() + ((v.days_ahead + 1) || ' days')::interval end,
  (select id from public.profiles where email = v.assignee),
  (select id from public.profiles where email = 'engineer@industrial.com'),
  v.hours, v.downtime, v.cost, v.checklist::jsonb
from (values
  ('CMP-001', 'predictive',  'in_progress', 'critical',
    'Substituição de rolamento — compressor GA 22+',
    'Troca do rolamento do lado acoplado com base na predição de RUL. Inclui análise espectral pós-intervenção.',
    0, 'technician@industrial.com', 6.0, null, null,
    '[{"item":"Bloqueio e etiquetagem (LOTO)","done":true},{"item":"Análise de vibração pré-intervenção","done":true},{"item":"Substituição do rolamento","done":false},{"item":"Alinhamento a laser","done":false},{"item":"Teste em vazio","done":false}]'),
  ('MTR-002', 'corrective',  'pending',     'high',
    'Inspeção de mancal — motor de reserva',
    'Investigar vibração na zona C e elevação térmica da carcaça: folga do rolamento, lubrificação e alinhamento do acoplamento.',
    3, 'technician@industrial.com', 4.0, null, null,
    '[{"item":"Análise espectral de vibração","done":false},{"item":"Inspeção do rolamento","done":false},{"item":"Alinhamento a laser","done":false}]'),
  ('MTR-001', 'preventive',  'scheduled',   'medium',
    'Lubrificação preventiva — motor principal',
    'Lubrificação dos rolamentos e inspeção termográfica conforme plano de 90 dias.',
    31, 'technician@industrial.com', 3.0, null, null,
    '[{"item":"Inspeção termográfica","done":false},{"item":"Lubrificação dos rolamentos","done":false},{"item":"Reaperto de conexões elétricas","done":false}]'),
  ('EXA-001', 'calibration', 'scheduled',   'low',
    'Calibração de sensores — exaustor',
    'Calibração dos transmissores de vibração e temperatura do mancal.',
    51, 'engineer@industrial.com', 2.0, null, null,
    '[{"item":"Calibrar transmissor de vibração","done":false},{"item":"Calibrar RTD do mancal","done":false}]'),
  ('BBA-001', 'preventive',  'completed',   'medium',
    'Inspeção de selo mecânico — bomba de refrigeração',
    'Inspeção e substituição preventiva do selo mecânico.',
    -45, 'technician@industrial.com', 3.5, 210, 2480.00,
    '[{"item":"Drenagem do circuito","done":true},{"item":"Substituição do selo","done":true},{"item":"Teste de estanqueidade","done":true}]')
) as v(asset_tag, mtype, mstatus, priority, title, description, days_ahead, assignee, hours, downtime, cost, checklist)
join public.assets a on a.tag = v.asset_tag
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB');

-- -----------------------------------------------------------------------------
-- 9. Modelos de ML encadeados (baseline → anomalia → predição)
-- -----------------------------------------------------------------------------
insert into public.ml_models (
  id, name, version, model_type, algorithm, description, target_asset_type,
  feature_names, hyperparameters, metrics, model_card, parent_model_id,
  training_rows, trained_at, is_active, created_by
) values
(
  '11111111-1111-4111-8111-111111111111',
  'Baseline de Operação de Motor', '1.2.0', 'baseline', 'XGBoost Regressor',
  'Aprende o comportamento esperado de tensão, corrente, temperatura, rotação e vibração em regime normal.',
  'motor',
  array['voltage', 'current', 'temperature', 'rpm', 'vibration', 'hour_of_day', 'load_factor'],
  '{"n_estimators": 400, "max_depth": 6, "learning_rate": 0.05, "subsample": 0.9}'::jsonb,
  '{"rmse": 1.84, "mae": 1.21, "r2": 0.962}'::jsonb,
  jsonb_build_object(
    'purpose',       'Estabelecer a assinatura de operação normal por ativo para servir de referência ao detector de anomalias.',
    'training_data', '90 dias de telemetria OPC-UA a 5 s dos motores instrumentados do Forzy Lab, excluídas janelas de manutenção.',
    'limitations',   'Não generaliza para regimes de carga não observados no treino nem para ativos sem histórico mínimo de 30 dias.',
    'biases',        'Sobre-representação de operação em carga nominal; regimes de partida e parada estão sub-representados.',
    'intended_use',  'Referência interna de engenharia de confiabilidade.',
    'out_of_scope',  'Decisão autônoma de parada de produção sem revisão humana.'
  ),
  null, 2332800, now() - interval '9 days', true,
  (select id from public.profiles where email = 'engineer@industrial.com')
),
(
  '22222222-2222-4222-8222-222222222222',
  'Detector de Anomalias', '1.3.1', 'anomaly', 'Isolation Forest + Z-score dinâmico',
  'Mede o desvio entre a leitura observada e o baseline previsto. É o modelo servido pelo FastAPI em anomaly/.',
  'motor',
  array['residual_voltage', 'residual_current', 'residual_temperature', 'residual_vibration', 'rolling_std_24h'],
  '{"n_estimators": 250, "contamination": 0.03, "zscore_window_h": 24}'::jsonb,
  '{"f1": 0.914, "recall": 0.938, "precision": 0.891, "false_positive_rate": 0.027}'::jsonb,
  jsonb_build_object(
    'purpose',       'Sinalizar desvios do comportamento esperado antes de o limite absoluto ser violado.',
    'training_data', 'Resíduos do modelo de baseline sobre 90 dias, com 61 eventos de anomalia rotulados pela equipe de manutenção.',
    'limitations',   'Sensível a troca de sensor sem recalibração; exige rejanelamento após intervenção mecânica.',
    'biases',        'Eventos rotulados concentram-se em falhas de rolamento — outros modos de falha têm menos suporte.',
    'intended_use',  'Geração de alertas de vibração e temperatura para triagem humana.',
    'out_of_scope',  'Diagnóstico de causa raiz isolado.'
  ),
  '11111111-1111-4111-8111-111111111111', 2332800, now() - interval '7 days', true,
  (select id from public.profiles where email = 'engineer@industrial.com')
),
(
  '33333333-3333-4333-8333-333333333333',
  'Predição de Parada para Manutenção', '0.9.4', 'prediction', 'Gradient Boosting Survival Analysis',
  'Estima vida útil remanescente (RUL) e probabilidade de falha cruzando histórico de anomalias com dados de placa.',
  'motor',
  array['anomaly_score_trend_7d', 'vibration_slope', 'temperature_slope', 'operating_hours', 'hours_since_maintenance', 'nameplate_power_kw'],
  '{"n_estimators": 300, "max_depth": 4, "learning_rate": 0.08, "loss": "coxph"}'::jsonb,
  '{"auc": 0.883, "concordance_index": 0.871, "mean_lead_time_days": 11.4}'::jsonb,
  jsonb_build_object(
    'purpose',       'Apoiar o planejamento de paradas estratégicas indicando a janela recomendada de intervenção.',
    'training_data', '18 meses de histórico de manutenção de 42 ativos equivalentes, mais curvas de vida do fabricante.',
    'limitations',   'Intervalo de confiança largo abaixo de 30 dias de histórico; não modela falhas por causa externa.',
    'biases',        'Treinado majoritariamente em motores WEG e Siemens de 4 polos; extrapolação para outros fabricantes é menos confiável.',
    'intended_use',  'Insumo para o plano de manutenção, sempre com validação do engenheiro responsável.',
    'out_of_scope',  'Garantia contratual de disponibilidade ou substituição de inspeção normativa.'
  ),
  '22222222-2222-4222-8222-222222222222', 1180000, now() - interval '5 days', true,
  (select id from public.profiles where email = 'engineer@industrial.com')
)
on conflict (id) do update
  set version = excluded.version, metrics = excluded.metrics,
      model_card = excluded.model_card, description = excluded.description,
      trained_at = excluded.trained_at, is_active = excluded.is_active;

insert into public.ml_training_runs (model_id, started_at, finished_at, status, dataset_from, dataset_to, row_count, metrics, triggered_by)
select m.id, m.trained_at - interval '52 minutes', m.trained_at, 'succeeded',
       m.trained_at - interval '90 days', m.trained_at, m.training_rows, m.metrics, m.created_by
from public.ml_models m
where m.id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- -----------------------------------------------------------------------------
-- 10. Predições por ativo
-- -----------------------------------------------------------------------------
insert into public.ml_predictions (
  model_id, asset_id, prediction_type, predicted_at, value, confidence,
  horizon_days, rul_days, recommended_action, explanation, feature_importance
)
select
  v.model_id::uuid, a.id, v.ptype::public.prediction_type,
  now() - (v.age_minutes || ' minutes')::interval,
  v.value, v.confidence, v.horizon, v.rul,
  v.action, v.explanation, v.importance::jsonb
from (values
  ('CMP-001', '33333333-3333-4333-8333-333333333333', 'remaining_useful_life', 7.0,   0.8900, 30,  7,
    'Executar a ordem de manutenção preditiva em aberto nas próximas 48 h.',
    'Inclinação da vibração de +2,1 mm/s em 48 h combinada à elevação da temperatura de saída indica desgaste avançado do rolamento do lado acoplado.',
    '{"vibration_slope": 0.46, "temperature_slope": 0.23, "anomaly_score_trend_7d": 0.19, "hours_since_maintenance": 0.12}', 20),
  ('CMP-001', '22222222-2222-4222-8222-222222222222', 'anomaly_score',         85.0,  0.9300, null, null,
    'Manter o ativo sob monitoramento contínuo até a intervenção.',
    'Resíduo de vibração 4,2 desvios-padrão acima do baseline de forma sustentada.',
    '{"residual_vibration": 0.61, "residual_temperature": 0.24, "rolling_std_24h": 0.15}', 12),
  ('CMP-001', '33333333-3333-4333-8333-333333333333', 'failure_probability',   0.7400, 0.8600, 30, null,
    'Planejar parada estratégica dentro da janela de 7 dias.',
    'Probabilidade acumulada de falha em 30 dias considerando o histórico de ativos equivalentes.',
    '{"vibration_slope": 0.52, "operating_hours": 0.21, "nameplate_power_kw": 0.09}', 22),
  ('MTR-002', '33333333-3333-4333-8333-333333333333', 'remaining_useful_life', 62.0,  0.7700, 90,  62,
    'Antecipar a inspeção de mancal antes da próxima parada programada.',
    'Vibração na zona C com tendência térmica ascendente reduz a vida útil estimada do rolamento.',
    '{"vibration_slope": 0.44, "temperature_slope": 0.31, "anomaly_score_trend_7d": 0.14}', 35),
  ('MTR-002', '22222222-2222-4222-8222-222222222222', 'anomaly_score',         58.0,  0.8800, null, null,
    'Verificar folga e lubrificação do rolamento na próxima janela.',
    'Resíduos de vibração e temperatura simultaneamente elevados, com sensores elétricos nominais.',
    '{"residual_vibration": 0.48, "residual_temperature": 0.33, "rolling_std_24h": 0.11}', 18),
  ('MTR-001', '33333333-3333-4333-8333-333333333333', 'remaining_useful_life', 240.0, 0.9400, 365, 240,
    'Seguir o plano preventivo de 90 dias sem alteração.',
    'Assinatura de operação aderente ao baseline; desgaste de rolamento estimado em 12%.',
    '{"operating_hours": 0.41, "hours_since_maintenance": 0.26, "vibration_slope": 0.11}', 44),
  ('MTR-001', '22222222-2222-4222-8222-222222222222', 'anomaly_score',         12.0,  0.9600, null, null,
    'Nenhuma ação necessária.',
    'Resíduos dentro da faixa de tolerância do baseline.',
    '{"residual_current": 0.29, "residual_temperature": 0.22, "rolling_std_24h": 0.10}', 10),
  ('BBA-001', '33333333-3333-4333-8333-333333333333', 'remaining_useful_life', 310.0, 0.9100, 365, 310,
    'Nenhuma ação necessária.',
    'Selo mecânico substituído recentemente; vazão e pressão estáveis.',
    '{"hours_since_maintenance": 0.38, "operating_hours": 0.30}', 52),
  ('BBA-001', '22222222-2222-4222-8222-222222222222', 'anomaly_score',          8.0,  0.9700, null, null,
    'Nenhuma ação necessária.',
    'Operação aderente ao baseline em toda a janela avaliada.',
    '{"residual_pressure": 0.31, "rolling_std_24h": 0.09}', 11),
  ('EXA-001', '33333333-3333-4333-8333-333333333333', 'remaining_useful_life', 180.0, 0.8500, 365, 180,
    'Manter a calibração programada dos transmissores.',
    'Rolamento com desgaste compatível com as horas de operação acumuladas.',
    '{"operating_hours": 0.44, "temperature_slope": 0.18}', 60),
  ('EXA-001', '22222222-2222-4222-8222-222222222222', 'anomaly_score',         15.0,  0.9200, null, null,
    'Nenhuma ação necessária.',
    'Leve elevação do desvio-padrão de vibração, ainda dentro da tolerância da classe I.',
    '{"residual_vibration": 0.35, "rolling_std_24h": 0.16}', 14)
) as v(asset_tag, model_id, ptype, value, confidence, horizon, rul, action, explanation, importance, age_minutes)
join public.assets a on a.tag = v.asset_tag
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB');

-- -----------------------------------------------------------------------------
-- 11. Base documental para RAG
--     Os chunks ficam sem embedding: a vetorização depende de um provedor
--     externo e é feita pelo pipeline de indexação, não pelo seed.
-- -----------------------------------------------------------------------------
insert into public.documents (asset_id, plant_id, title, document_type, description, language, version, uploaded_by, metadata)
select a.id, a.plant_id, v.title, v.dtype::public.document_type, v.description, 'pt', v.version,
       (select id from public.profiles where email = 'engineer@industrial.com'),
       jsonb_build_object('source', 'fabricante', 'pages', v.pages)
from (values
  ('MTR-001', 'Manual de Instalação e Manutenção — WEG W22 IE3',  'manual',    'Torques, folgas, plano de lubrificação e limites de vibração.',        '2021-06', 84),
  ('MTR-001', 'Procedimento de Alinhamento a Laser',              'procedure', 'Procedimento interno de alinhamento de acoplamento com tolerâncias.',  'REV-04',  12),
  ('MTR-002', 'Manual Técnico — Siemens SIMOTICS SD',             'manual',    'Especificações elétricas, curvas de carga e diagnóstico de falhas.',   '2022-11', 96),
  ('CMP-001', 'Manual de Serviço — Atlas Copco GA 22+',           'manual',    'Plano de manutenção, códigos de falha e substituição de rolamentos.',  '2020-03', 132),
  ('CMP-001', 'ISO 10816-3 — Limites de Vibração para Máquinas',  'procedure', 'Zonas A a D de severidade de vibração para máquinas industriais.',     '2009',    28),
  ('BBA-001', 'Manual da Motobomba KSB Etanorm',                  'manual',    'Curvas de desempenho, NPSH e troca de selo mecânico.',                 '2022-01', 74),
  ('EXA-001', 'Datasheet — WEG W21 71 IE2',                       'datasheet', 'Curva de vazão, potência sonora e dados do rolamento.',                '2023-02',  8)
) as v(asset_tag, title, dtype, description, version, pages)
join public.assets a on a.tag = v.asset_tag
where a.plant_id = (select id from public.plants where code = 'FORZY-LAB');

insert into public.document_chunks (document_id, asset_id, chunk_index, content, page_number, token_count)
select d.id, d.asset_id, v.idx, v.content, v.page, length(v.content) / 4
from (values
  ('Manual de Serviço — Atlas Copco GA 22+', 0,
   'Substituição do rolamento do lado acoplado: bloquear e etiquetar a alimentação (LOTO), despressurizar o reservatório e aguardar a queda de temperatura abaixo de 40 °C. Utilizar extrator hidráulico; nunca aplicar impacto direto no eixo. Torque de reaperto da tampa: 42 N·m.', 87),
  ('Manual de Serviço — Atlas Copco GA 22+', 1,
   'Vibração acima de 7,1 mm/s RMS indica desgaste avançado do rolamento ou desbalanceamento do conjunto rotativo. Recomenda-se parada para inspeção em até 48 horas. Operação continuada nessa faixa reduz a vida útil do conjunto em até 60%.', 91),
  ('Manual de Serviço — Atlas Copco GA 22+', 2,
   'Temperatura de descarga acima de 95 °C com corrente do motor elevada sugere restrição no circuito de refrigeração ou elemento separador saturado. Verificar o radiador de óleo e substituir o elemento conforme o plano de 4.000 horas.', 64),
  ('ISO 10816-3 — Limites de Vibração para Máquinas', 0,
   'Para máquinas do grupo 1 com base rígida, a zona A (máquina nova) vai até 2,3 mm/s RMS; a zona B (operação aceitável sem restrição) até 4,5 mm/s; a zona C (aceitável apenas por tempo limitado) até 7,1 mm/s; e a zona D (dano em progressão) acima de 7,1 mm/s.', 14),
  ('Manual de Instalação e Manutenção — WEG W22 IE3', 0,
   'Plano de lubrificação: rolamentos blindados devem ser relubrificados a cada 90 dias em regime contínuo, com 18 g de graxa Polyrex EM por mancal. Não misturar graxas de bases diferentes.', 41),
  ('Manual de Instalação e Manutenção — WEG W22 IE3', 1,
   'A temperatura do enrolamento não deve exceder o limite da classe de isolamento F (155 °C). Elevação sustentada acima de 75 °C na carcaça indica sobrecarga, desbalanceamento de fases ou ventilação obstruída.', 52),
  ('Manual Técnico — Siemens SIMOTICS SD', 0,
   'Desalinhamento de acoplamento produz componente espectral predominante em 2× a frequência de rotação. Tolerância radial admissível: 0,05 mm; angular: 0,04 mm por 100 mm de diâmetro.', 58),
  ('Manual Técnico — Siemens SIMOTICS SD', 1,
   'Vibração com pico em torno da frequência de passagem das esferas indica degradação da pista do rolamento. A elevação da temperatura do mancal costuma seguir a da vibração com atraso de dias.', 61),
  ('Procedimento de Alinhamento a Laser', 0,
   'Executar o alinhamento sempre com a máquina em temperatura de operação. Registrar as leituras antes e depois no formulário FRM-ALN-02 e anexar à ordem de manutenção correspondente.', 5),
  ('Manual da Motobomba KSB Etanorm', 0,
   'A substituição do selo mecânico exige drenagem completa do circuito e teste de estanqueidade a 1,5× a pressão de operação por 10 minutos antes do retorno à produção.', 45),
  ('Manual da Motobomba KSB Etanorm', 1,
   'Queda de vazão com pressão estável indica obstrução na sucção ou desgaste do rotor. Vazão abaixo de 120 L/min compromete a troca térmica do circuito de refrigeração.', 52),
  ('Datasheet — WEG W21 71 IE2', 0,
   'Rolamento 6205-2RS com vida útil nominal L10 de 40.000 horas a 1710 rpm. Temperatura máxima admissível do mancal: 85 °C.', 6)
) as v(doc_title, idx, content, page)
join public.documents d on d.title = v.doc_title
where d.plant_id = (select id from public.plants where code = 'FORZY-LAB')
on conflict (document_id, chunk_index) do update
  set content = excluded.content, page_number = excluded.page_number;

-- -----------------------------------------------------------------------------
-- 12. Consentimento LGPD das contas de demonstração
-- -----------------------------------------------------------------------------
insert into public.lgpd_consents (user_id, consent_type, granted, policy_version, granted_at)
select p.id, c.ctype::public.consent_type, true, '1.0', now() - interval '30 days'
from public.profiles p
cross join (values ('data_processing'), ('telemetry'), ('ai_processing')) as c(ctype)
on conflict (user_id, consent_type, policy_version) do nothing;

-- -----------------------------------------------------------------------------
-- 13. Deriva disponibilidade, anomalia e status da telemetria recém-inserida
-- -----------------------------------------------------------------------------
select public.recompute_asset_health();

-- Diagnóstico do modelo de anomalia (o serviço em anomaly/ sobrescreve ao rodar).
update public.assets a
   set health_index = round((100 - a.anomaly_score)::numeric, 2),
       severity = case
                    when a.status = 'critical' then 'critico'
                    when a.status = 'warning'  then 'alerta'
                    when a.anomaly_score > 10  then 'info'
                    else 'ok'
                  end::public.anomaly_severity,
       insight = p.explanation,
       scored_at = now()
  from (
    select asset_id, explanation
    from public.v_asset_latest_prediction
    where prediction_type = 'anomaly_score'
  ) p
 where p.asset_id = a.id;

-- -----------------------------------------------------------------------------
-- 14. Histórico de saúde para o gráfico de tendência
-- -----------------------------------------------------------------------------
insert into public.asset_health_snapshots (asset_id, captured_at, uptime, anomaly_score, status, active_alerts)
select h.asset_id, h.bucket, round(h.uptime::numeric, 2), round(h.anomaly::numeric, 2), h.status, 0
from (
  select
    r.asset_id,
    date_trunc('hour', r.ts) as bucket,
    100.0 * count(*) filter (where r.quality = 'good' and r.status <> 'critical') / count(*) as uptime,
    100.0 * count(*) filter (where r.status <> 'normal') / count(*)                          as anomaly,
    (case
       when count(*) filter (where r.status = 'critical') > 0 then 'critical'
       when count(*) filter (where r.status <> 'normal')  > 0 then 'warning'
       else 'normal'
     end)::public.asset_status as status
  from public.sensor_readings r
  join public.assets a on a.id = r.asset_id
  where a.plant_id = (select id from public.plants where code = 'FORZY-LAB')
    and r.ts >= now() - interval '48 hours'
    -- Idem: os pontos reais ganham snapshot pelo trigger de 0003, alimentado
    -- pela ingestão do coletor. Incluí-los aqui acumularia uma cópia a cada
    -- re-seed (não há unique em asset_id+captured_at, só índice) e a curva de
    -- tendência deles iria mentindo um pouco mais a cada execução.
    and a.tag <> all(array['LAB-S1', 'LAB-S2'])
  group by r.asset_id, date_trunc('hour', r.ts)
) h;
