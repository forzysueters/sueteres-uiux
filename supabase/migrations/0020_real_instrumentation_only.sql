-- =============================================================================
-- 0020 — A planta passa a medir só o que o instrumento mede
--
-- O PROBLEMA
--
-- O hardware do Forzy Lab é um acelerômetro. O `collector_field_map` da 0014
-- diz exatamente o que chega do túnel HTTP, e são três campos:
--
--     Velocidade | Aceleração | Temperatura
--
-- Mesmo assim a planta exibia "Pressão de Saída", "Vazão", "Potência",
-- "Corrente Motor" e "Velocidade" (rotação em %). Nenhum desses tem transdutor
-- por trás — nem no Lab, nem em lugar nenhum do projeto. Na apresentação, a
-- primeira pergunta que isso convida é "como vocês medem a vazão?", e não há
-- resposta: não medimos.
--
-- A DECISÃO
--
-- Todo ativo passa a ter o MESMO trio dos pontos reais, com limites de norma:
--
--   Velocidade de Vibração  mm/s   ISO 10816-3, pela classe de potência
--   Aceleração              m/s²   derivada da anterior por a = 2πf·v
--   Temperatura             °C     no ponto onde o sensor é fixado (mancal)
--
-- A aceleração não tem limite universal: para um harmônico a = 2πf·v, então o
-- mesmo corte da ISO vale um número diferente em cada rotação. Derivar da placa
-- de cada máquina é o que mantém os dois canais de vibração contando a mesma
-- história — e é uma conta que se defende na arguição, com a rotação de placa
-- em cima da mesa.
--
-- ISO 10816-3 por classe: classe I (< 15 kW) 2,8 / 4,5 mm/s;
--                         classe II (15-75 kW) 4,5 / 7,1 mm/s.
--
-- O que o instrumento não alcança é DESATIVADO, não apagado: a linha do sensor
-- e todo o histórico continuam no banco. Se algum dia entrar um CLP com pressão
-- e vazão de verdade, é um UPDATE para trazer de volta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Os canais que faltavam
--
-- BBA-001 (KSB Etanorm, 5,5 kW, 1450 rpm) não tinha vibração nenhuma — o ativo
-- monitorado por um kit de vibração sem medir vibração. CMP-001 e EXA-001
-- tinham só a velocidade, sem a aceleração que a acompanha.
-- -----------------------------------------------------------------------------
insert into public.sensors (
  asset_id, tag, name, sensor_type, unit,
  min_value, max_value, warning_threshold, critical_threshold,
  limit_direction, limit_source, display_order, is_active
)
select a.id, v.stag, v.nome, v.tipo::public.sensor_type, v.unidade,
       v.mn, v.mx, v.warn, v.crit, 'above'::public.limit_direction, v.fonte, v.ordem, true
from public.assets a
join (values
  -- BBA-001 · 5,5 kW ⇒ classe I (2,8 / 4,5 mm/s). 1450 rpm ⇒ 24,17 Hz ⇒ 2πf = 151,8 s⁻¹.
  ('BBA-001', 'BBA-001.VIB', 'Velocidade de Vibração', 'vibration', 'mm/s', 0.0, 10.0, 2.8,  4.5,
   'ISO 10816-3 — classe I, zona B/C e C/D', 1),
  ('BBA-001', 'BBA-001.ACC', 'Aceleração',             'vibration', 'm/s²', 0.0,  3.0, 0.43, 0.68,
   'ISO 10816-3 convertida a 1450 rpm (a = 2πf·v)', 2),
  -- CMP-001 · 22 kW ⇒ classe II (4,5 / 7,1). 2950 rpm ⇒ 49,17 Hz ⇒ 2πf = 308,9 s⁻¹.
  ('CMP-001', 'CMP-001.ACC', 'Aceleração',             'vibration', 'm/s²', 0.0,  8.0, 1.39, 2.19,
   'ISO 10816-3 convertida a 2950 rpm (a = 2πf·v)', 2),
  -- Compressor: o acelerômetro fica no corpo da máquina, então a temperatura
  -- útil é a do mancal — não a do ar de admissão nem a da descarga.
  ('CMP-001', 'CMP-001.TEMP', 'Temperatura',           'temperature', '°C', 0.0, 120.0, 75.0, 90.0,
   'Mancal — isolamento classe F, dano cumulativo antes do limite do verniz', 3),
  -- EXA-001 · 0,75 kW ⇒ classe I. 1710 rpm ⇒ 28,5 Hz ⇒ 2πf = 179,1 s⁻¹.
  ('EXA-001', 'EXA-001.ACC', 'Aceleração',             'vibration', 'm/s²', 0.0,  3.0, 0.50, 0.81,
   'ISO 10816-3 convertida a 1710 rpm (a = 2πf·v)', 2)
) as v(atag, stag, nome, tipo, unidade, mn, mx, warn, crit, fonte, ordem) on v.atag = a.tag
where not exists (select 1 from public.sensors s where s.tag = v.stag);

-- -----------------------------------------------------------------------------
-- 2. Nomes iguais para a mesma grandeza
--
-- 'Vibração' e 'Velocidade de Vibração' eram a mesma coisa com dois nomes, o
-- que obrigava `ROLE_ALIASES` no front a manter uma lista de apelidos. Pior:
-- EXA-001 tinha um sensor chamado 'Velocidade' que era ROTAÇÃO em %, grandeza
-- diferente — uma armadilha documentada em sensorLimits.ts justamente porque
-- confundir os dois quebra o modelo de anomalia.
-- -----------------------------------------------------------------------------
update public.sensors set name = 'Velocidade de Vibração', display_order = 1
where tag in ('CMP-001.VIB', 'EXA-001.VIB');

update public.sensors set name = 'Temperatura', display_order = 3
where tag in ('EXA-001.TEMP', 'BBA-001.TEMP');

-- A temperatura passa a ser sempre a do ponto de fixação do sensor. Na bomba
-- ela era do fluido de refrigeração (60/75) — grandeza de processo, que este
-- instrumento não lê.
update public.sensors
set warning_threshold = 70, critical_threshold = 85,
    limit_source = 'Mancal — graxa de rolamento, vida útil cai pela metade a cada +15 °C'
where tag in ('BBA-001.TEMP', 'EXA-001.TEMP');

-- -----------------------------------------------------------------------------
-- 3. O que não temos como medir sai de cena
--
-- Desativados, não apagados: histórico preservado e reversível com um UPDATE.
-- -----------------------------------------------------------------------------
update public.sensors
set is_active = false,
    limit_source = coalesce(limit_source, '') ||
      ' [desativado na 0020: sem transdutor — o kit do Forzy Lab mede apenas vibração e temperatura]'
where tag in (
  'BBA-001.PRES',   -- pressão de recalque
  'BBA-001.FLOW',   -- vazão
  'BBA-001.PWR',    -- potência elétrica
  'CMP-001.PRES',   -- pressão de saída
  'CMP-001.TIN',    -- temperatura do ar de admissão
  'CMP-001.TOUT',   -- temperatura de descarga
  'CMP-001.CURR',   -- corrente do motor
  'EXA-001.SPD',    -- rotação em %
  'EXA-001.CURR'    -- corrente do motor
);

-- -----------------------------------------------------------------------------
-- 4. Leituras órfãs
--
-- A telemetria sintética dos sensores desativados para de ser gerada sozinha
-- (`synthetic_tick` filtra por `is_active`), mas o que já entrou continuaria
-- aparecendo no histórico de um sensor que a tela não mostra mais.
-- -----------------------------------------------------------------------------
delete from public.sensor_readings r
using public.sensors s
where s.id = r.sensor_id and not s.is_active and r.source = 'synthetic';
