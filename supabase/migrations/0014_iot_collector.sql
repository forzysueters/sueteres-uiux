-- =============================================================================
-- 0014 — Coletor dos endpoints IoT reais do Forzy Lab (Módulo 1 — ingestão)
--
-- A Forzy expõe dois endpoints HTTP com leitura de acelerômetro (velocidade de
-- vibração, aceleração e temperatura). Eles só respondem às segundas, terças e
-- quartas, das 12h às 14h (America/Sao_Paulo) — fora disso o túnel fica fora do
-- ar. Perder uma janela custa uma semana, então a coleta roda dentro do próprio
-- Postgres (pg_cron + pg_net): não depende de nenhuma máquina ligada.
--
-- Desenho:
--
--   cron 30s → iot_collector_tick()
--                ├─ drain()     colhe respostas do pg_net → sensor_raw_captures
--                ├─ ingest()    mapeia captura → ingest_readings() → série
--                └─ dispatch()  dispara o próximo GET (se a janela estiver aberta)
--
-- sensor_raw_captures é a zona de pouso: guarda o corpo exatamente como veio,
-- inclusive as falhas (HTTP 530 do túnel derrubado). É o que permite reprocessar
-- se o mapeamento mudar, e é a evidência de rastreabilidade do Módulo 6.
-- =============================================================================

create extension if not exists pg_net;   -- schema net
create extension if not exists pg_cron;  -- schema pg_catalog (padrão do Supabase)

-- -----------------------------------------------------------------------------
-- Utilitários de cast tolerante — o corpo da resposta é texto não confiável.
-- -----------------------------------------------------------------------------
create or replace function public.safe_jsonb(p_text text)
returns jsonb
language plpgsql
immutable
as $$
begin
  return p_text::jsonb;
exception when others then
  return null;
end;
$$;

comment on function public.safe_jsonb(text) is
  'Converte texto em jsonb devolvendo null em vez de erro (corpo HTTP pode não ser JSON).';

create or replace function public.safe_double(p_text text)
returns double precision
language plpgsql
immutable
as $$
begin
  return p_text::double precision;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- collector_config — janela de coleta. Linha única.
-- -----------------------------------------------------------------------------
create table if not exists public.collector_config (
  id            boolean primary key default true,
  is_enabled    boolean not null default true,
  force_always  boolean not null default false,  -- ignora a janela (testes)
  active_isodow smallint[] not null default '{1,2,3}',  -- 1=seg, 2=ter, 3=qua
  window_start  time not null default '11:00',   -- 1h de margem antes das 12h
  window_end    time not null default '15:00',   -- 1h de margem depois das 14h
  timezone      text not null default 'America/Sao_Paulo',
  updated_at    timestamptz not null default now(),
  constraint collector_config_singleton check (id),
  constraint collector_config_window    check (window_end > window_start)
);

comment on table public.collector_config is
  'Janela de coleta dos endpoints da Forzy. A margem de 1h cobre atraso do time no lab.';

insert into public.collector_config (id) values (true) on conflict (id) do nothing;

drop trigger if exists collector_config_set_updated_at on public.collector_config;
create trigger collector_config_set_updated_at
  before update on public.collector_config
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- collector_sources — os endpoints. A URL vive AQUI, nunca no código.
--
-- O túnel é um quick tunnel do trycloudflare: o subdomínio é sorteado a cada
-- reinício do cloudflared. Quando a Forzy reiniciar, basta um UPDATE nesta
-- tabela — sem migração, sem deploy.
-- -----------------------------------------------------------------------------
create table if not exists public.collector_sources (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- s1 | s2
  name        text not null,
  url         text not null,
  payload_key text not null,                 -- chave que embrulha os campos: dados1
  is_enabled  boolean not null default true,
  timeout_ms  integer not null default 8000,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint collector_sources_timeout_check check (timeout_ms between 1000 and 60000)
);

drop trigger if exists collector_sources_set_updated_at on public.collector_sources;
create trigger collector_sources_set_updated_at
  before update on public.collector_sources
  for each row execute function public.set_updated_at();

insert into public.collector_sources (code, name, url, payload_key, is_enabled, notes)
values
  ('s1', 'Forzy Lab — ponto de medição 1',
   'https://example.invalid/get_s1', 'dados1', false,
   'Configure a URL ativa fora do Git antes de habilitar a fonte.'),
  ('s2', 'Forzy Lab — ponto de medição 2',
   'https://example.invalid/get_s2', 'dados2', false,
   'Configure a URL ativa fora do Git antes de habilitar a fonte.')
on conflict (code) do update
  set name = excluded.name, payload_key = excluded.payload_key, notes = excluded.notes;

-- -----------------------------------------------------------------------------
-- collector_requests — correlaciona o id assíncrono do pg_net com a origem.
-- O pg_net devolve um request_id e entrega a resposta depois, em net._http_response.
-- -----------------------------------------------------------------------------
create table if not exists public.collector_requests (
  request_id   bigint primary key,
  source_id    uuid not null references public.collector_sources(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists collector_requests_requested_idx
  on public.collector_requests (requested_at);

-- -----------------------------------------------------------------------------
-- sensor_raw_captures — zona de pouso. Nada é descartado, nem as falhas.
-- -----------------------------------------------------------------------------
create table if not exists public.sensor_raw_captures (
  id            bigserial primary key,
  source_id     uuid not null references public.collector_sources(id) on delete cascade,
  request_id    bigint unique,
  requested_at  timestamptz not null,
  responded_at  timestamptz not null default now(),
  http_status   integer,
  payload       jsonb,          -- corpo já parseado, quando é JSON válido
  raw_body      text,           -- corpo cru, sempre
  error         text,           -- timeout / erro de transporte
  ingested_at   timestamptz,    -- null = ainda não virou série temporal
  ingested_rows integer
);

comment on table public.sensor_raw_captures is
  'Toda resposta dos endpoints da Forzy, íntegra. Reprocessável e auditável (Módulo 6).';
comment on column public.sensor_raw_captures.ingested_at is
  'Zerar esta coluna reprocessa a captura na próxima passagem do coletor.';

create index if not exists raw_captures_source_idx  on public.sensor_raw_captures (source_id, responded_at desc);
create index if not exists raw_captures_pending_idx on public.sensor_raw_captures (responded_at) where ingested_at is null;
create index if not exists raw_captures_status_idx  on public.sensor_raw_captures (http_status, responded_at desc);

-- -----------------------------------------------------------------------------
-- collector_field_map — "Velocidade" do get_s1 é o sensor LAB-S1.VIB.
-- Mapeamento é dado, não código: corrigir é um UPDATE.
-- -----------------------------------------------------------------------------
create table if not exists public.collector_field_map (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references public.collector_sources(id) on delete cascade,
  json_field   text not null,                 -- Velocidade | Aceleração | Temperatura
  sensor_tag   text not null,                 -- LAB-S1.VIB
  scale        double precision not null default 1,
  offset_value double precision not null default 0,
  created_at   timestamptz not null default now(),
  constraint collector_field_map_key unique (source_id, json_field)
);

comment on table public.collector_field_map is
  'valor_em_engenharia = valor_do_json * scale + offset_value';

-- =============================================================================
-- Ativos que representam os pontos de medição REAIS do Forzy Lab.
-- Ficam separados dos 5 ativos sintéticos do seed de propósito: na banca é
-- preciso poder apontar o que é telemetria real e o que é demonstração.
-- =============================================================================
-- Ficam no Hall A, não numa área própria: o mapa 2D desenha quatro halls fixos
-- (PlantFloorMap.tsx) e o layout 3D lista os mesmos quatro (plantLayout.ts).
-- Uma quinta área não teria hall desenhado e os ativos flutuariam sobre o Hall B.
-- A separação entre real e sintético é carregada pela TAG e por metadata
-- .is_real_telemetry, que é o que importa — não pela geografia.
--
-- Coordenadas escolhidas em espaço livre do Hall A (SVG 1000×562, hall A ocupa
-- x 30-450 / y 30-290): abaixo dos dois motores, sem sobrepor ninguém.
insert into public.assets (
  plant_id, area_id, tag, name, asset_type, location, criticality,
  grid_x, grid_y, plant_x, plant_y, metadata
)
select
  p.id, ar.id, v.tag, v.name, 'motor'::public.asset_type, v.location,
  'medium'::public.criticality_level, v.gx, 2, v.px, 45,
  jsonb_build_object(
    'data_source',      'forzy-lab-http',
    'is_real_telemetry', true,
    'endpoint',          v.endpoint
  )
from (values
  ('LAB-S1', 'Forzy Lab — Ponto de Medição 1', 'Bancada Forzy Lab — Sensor 1', 1, 22, 'get_s1'),
  ('LAB-S2', 'Forzy Lab — Ponto de Medição 2', 'Bancada Forzy Lab — Sensor 2', 3, 38, 'get_s2')
) as v(tag, name, location, gx, px, endpoint)
cross join public.plants p
join public.areas ar on ar.plant_id = p.id and ar.code = 'HALL-A'
where p.code = 'FORZY-LAB'
on conflict (plant_id, tag) do update
  set name     = excluded.name,
      area_id  = excluded.area_id,
      location = excluded.location,
      grid_x   = excluded.grid_x,
      grid_y   = excluded.grid_y,
      plant_x  = excluded.plant_x,
      plant_y  = excluded.plant_y,
      metadata = excluded.metadata;

-- Sensores. Os limites de vibração seguem a ISO 10816-3, iguais aos do seed.
-- Os de aceleração são provisórios: só dá para calibrá-los com dado real na mão.
insert into public.sensors (
  asset_id, tag, name, sensor_type, unit,
  min_value, max_value, warning_threshold, critical_threshold,
  sampling_interval_s, metadata
)
select
  a.id, a.tag || '.' || v.suffix, v.name, v.stype::public.sensor_type, v.unit,
  v.vmin, v.vmax, v.warn, v.crit, 30,
  jsonb_build_object('limit_basis', v.basis, 'provisional', v.provisional)
from public.assets a
cross join (values
  ('VIB',  'Velocidade de Vibração', 'vibration',   'mm/s',   0::float,  20::float, 4.5::float,  7.1::float, 'ISO 10816-3 — zona B/C e C/D',          false),
  ('ACC',  'Aceleração',             'vibration',   'm/s²',   0::float,  50::float, 10.0::float, 20.0::float,'Provisório — recalibrar com dado real', true),
  ('TEMP', 'Temperatura',            'temperature', '°C',     0::float, 120::float, 75.0::float, 90.0::float,'Isolamento classe F',                   false)
) as v(suffix, name, stype, unit, vmin, vmax, warn, crit, basis, provisional)
where a.tag in ('LAB-S1', 'LAB-S2')
  and a.plant_id = (select id from public.plants where code = 'FORZY-LAB')
on conflict (asset_id, tag) do update
  set name               = excluded.name,
      unit               = excluded.unit,
      warning_threshold  = excluded.warning_threshold,
      critical_threshold = excluded.critical_threshold,
      metadata           = excluded.metadata;

-- O mapeamento propriamente dito.
insert into public.collector_field_map (source_id, json_field, sensor_tag)
select s.id, v.json_field, v.sensor_tag
from public.collector_sources s
join (values
  ('s1', 'Velocidade',  'LAB-S1.VIB'),
  ('s1', 'Aceleração',  'LAB-S1.ACC'),
  ('s1', 'Temperatura', 'LAB-S1.TEMP'),
  ('s2', 'Velocidade',  'LAB-S2.VIB'),
  ('s2', 'Aceleração',  'LAB-S2.ACC'),
  ('s2', 'Temperatura', 'LAB-S2.TEMP')
) as v(code, json_field, sensor_tag) on v.code = s.code
on conflict (source_id, json_field) do update
  set sensor_tag = excluded.sensor_tag;

-- =============================================================================
-- Funções do coletor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A janela está aberta agora?
-- -----------------------------------------------------------------------------
create or replace function public.iot_collector_window_open(p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(bool_or(
    c.is_enabled and (
      c.force_always
      or (
        extract(isodow from (p_at at time zone c.timezone))::smallint = any (c.active_isodow)
        and (p_at at time zone c.timezone)::time >= c.window_start
        and (p_at at time zone c.timezone)::time <  c.window_end
      )
    )
  ), false)
  from public.collector_config c;
$$;

-- -----------------------------------------------------------------------------
-- Dispara um GET por origem habilitada (assíncrono — a resposta vem depois).
-- -----------------------------------------------------------------------------
create or replace function public.iot_collector_dispatch()
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_source     record;
  v_request_id bigint;
  v_count      integer := 0;
begin
  if not public.iot_collector_window_open() then
    return 0;
  end if;

  for v_source in
    select id, url, timeout_ms from public.collector_sources where is_enabled order by code
  loop
    v_request_id := net.http_get(
      url                  => v_source.url,
      headers              => jsonb_build_object('accept', 'application/json'),
      timeout_milliseconds => v_source.timeout_ms
    );

    insert into public.collector_requests (request_id, source_id)
    values (v_request_id, v_source.id)
    on conflict (request_id) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Colhe o que o pg_net já respondeu e grava na zona de pouso.
-- O pg_net apaga net._http_response depois de algumas horas: colher é urgente,
-- gravar é definitivo.
-- -----------------------------------------------------------------------------
create or replace function public.iot_collector_drain()
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with stored as (
    insert into public.sensor_raw_captures (
      source_id, request_id, requested_at, responded_at, http_status, payload, raw_body, error
    )
    select
      cr.source_id,
      cr.request_id,
      cr.requested_at,
      coalesce(r.created, now()),
      r.status_code,
      public.safe_jsonb(r.content),
      r.content,
      nullif(
        concat_ws(' | ', r.error_msg, case when r.timed_out then 'timeout' end),
        ''
      )
    from public.collector_requests cr
    join net._http_response r on r.id = cr.request_id
    on conflict (request_id) do nothing
    returning 1
  )
  select count(*) into v_count from stored;

  -- Já colhido (ou já registrado antes): solta a correlação.
  delete from public.collector_requests cr
   where exists (select 1 from net._http_response r where r.id = cr.request_id)
      or exists (select 1 from public.sensor_raw_captures c where c.request_id = cr.request_id);

  -- Órfãos: a resposta expirou no TTL do pg_net antes de ser colhida.
  delete from public.collector_requests
   where requested_at < now() - interval '2 hours';

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Traduz capturas cruas em série temporal, via o mapeamento e a RPC existente.
-- Só toca no que ainda não foi ingerido; zerar ingested_at reprocessa.
-- -----------------------------------------------------------------------------
create or replace function public.iot_collector_ingest(p_limit integer default 500)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  v_capture  record;
  v_readings jsonb;
  v_rows     integer;
  v_total    integer := 0;
begin
  for v_capture in
    select c.id, c.source_id, c.responded_at, c.payload, s.payload_key
      from public.sensor_raw_captures c
      join public.collector_sources s on s.id = c.source_id
     where c.ingested_at is null
       and c.http_status = 200
       and c.payload is not null
     order by c.responded_at
     limit p_limit
  loop
    select coalesce(
             jsonb_agg(jsonb_build_object(
               'sensor_tag', m.sensor_tag,
               'ts',         v_capture.responded_at,
               'value',      n.num * m.scale + m.offset_value,
               'raw_value',  n.num,
               'source',     'http'
             )),
             '[]'::jsonb
           )
      into v_readings
      from public.collector_field_map m
      cross join lateral (
        select public.safe_double(
                 v_capture.payload -> v_capture.payload_key ->> m.json_field
               ) as num
      ) n
     where m.source_id = v_capture.source_id
       and n.num is not null;

    v_rows := 0;
    if jsonb_array_length(v_readings) > 0 then
      v_rows := public.ingest_readings(v_readings);
    end if;

    update public.sensor_raw_captures
       set ingested_at = now(), ingested_rows = v_rows
     where id = v_capture.id;

    v_total := v_total + coalesce(v_rows, 0);
  end loop;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ponto de entrada do cron. Colhe o ciclo anterior, ingere, dispara o próximo.
-- -----------------------------------------------------------------------------
create or replace function public.iot_collector_tick()
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_drained    integer;
  v_ingested   integer;
  v_dispatched integer;
begin
  v_drained    := public.iot_collector_drain();
  v_ingested   := public.iot_collector_ingest();
  v_dispatched := public.iot_collector_dispatch();

  return jsonb_build_object(
    'at',          now(),
    'window_open', public.iot_collector_window_open(),
    'drained',     v_drained,
    'ingested',    v_ingested,
    'dispatched',  v_dispatched
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Visão de operação: a janela passada, endpoint por endpoint.
-- -----------------------------------------------------------------------------
create or replace view public.collector_health as
select
  s.code,
  s.name,
  s.url,
  s.is_enabled,
  -- count(c.id) e não count(*): o LEFT JOIN sem captura ainda produz uma linha,
  -- e count(*) filter contaria essa linha fantasma como falha.
  count(c.id)                                                   as capturas,
  count(c.id) filter (where c.http_status = 200)                as ok,
  count(c.id) filter (where c.http_status is distinct from 200) as falhas,
  count(c.id) filter (where c.ingested_at is null)              as pendentes,
  coalesce(sum(c.ingested_rows), 0)                        as leituras_gravadas,
  max(c.responded_at)                                      as ultima_captura,
  max(c.responded_at) filter (where c.http_status = 200)   as ultimo_sucesso
from public.collector_sources s
left join public.sensor_raw_captures c on c.source_id = s.id
group by s.id, s.code, s.name, s.url, s.is_enabled;

comment on view public.collector_health is
  'Saúde do coletor por endpoint — use para conferir se a janela de segunda rendeu dados.';

-- =============================================================================
-- RLS — mesmo padrão das demais tabelas do projeto
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'collector_config', 'collector_sources', 'collector_requests',
    'sensor_raw_captures', 'collector_field_map'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists service_role_all on public.%I', t);
    execute format(
      'create policy service_role_all on public.%I as permissive for all to service_role using (true) with check (true)',
      t
    );

    execute format('drop policy if exists collector_select on public.%I', t);
    execute format(
      'create policy collector_select on public.%I for select to authenticated using (public.can_read())',
      t
    );

    execute format('drop policy if exists collector_write on public.%I', t);
    execute format(
      'create policy collector_write on public.%I for all to authenticated '
      'using (public.has_role(''admin'', ''engineer'')) '
      'with check (public.has_role(''admin'', ''engineer''))',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- Agendamento
--
-- 30 em 30 segundos, o ano inteiro: a função decide sozinha se a janela está
-- aberta. Guardar a janela no banco (e não no cron) evita o erro clássico de
-- agendar 12h-14h num servidor que roda em UTC.
-- =============================================================================
do $$ begin
  perform cron.unschedule('forzy-iot-collector');
exception when others then null; end $$;

select cron.schedule(
  'forzy-iot-collector',
  '30 seconds',
  $job$select public.iot_collector_tick()$job$
);
