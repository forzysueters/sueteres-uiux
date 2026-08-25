-- =============================================================================
-- 0015 — Troca do túnel da Forzy: trycloudflare → ngrok
--
-- O quick tunnel do trycloudflare saiu do ar e a Forzy publicou os mesmos dois
-- endpoints atrás de um túnel ngrok. O coletor de 0014 seguiu batendo no host
-- morto por 2013 ciclos ("Couldn't resolve host name") — o desenho aguentou a
-- queda sem perder nada, mas nenhuma leitura chegou à série temporal.
--
-- Três coisas mudam aqui:
--
--   1. A URL, só onde ainda aponta para o túnel morto. Reaplicar as migrações
--      não pode desfazer uma troca feita depois por `npm run collector -- url`.
--
--   2. Os cabeçalhos passam a ser dado (collector_sources.headers). O ngrok
--      responde com uma página HTML de aviso quando o User-Agent parece de
--      navegador; `ngrok-skip-browser-warning` desliga isso. Hoje o pg_net se
--      identifica como pg_net/x.y e passa direto, mas depender do User-Agent de
--      uma dependência é apostar que ela nunca vai mudar de nome.
--
--   3. dispatch() isola cada origem: um GET que estoura (URL inválida colada na
--      pressa entre uma banca e outra) derrubava o tick inteiro, e com ele a
--      coleta da outra origem, que estava saudável.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cabeçalhos por origem
-- -----------------------------------------------------------------------------
alter table public.collector_sources
  add column if not exists headers jsonb not null default '{"accept": "application/json"}'::jsonb;

comment on column public.collector_sources.headers is
  'Cabeçalhos do GET. Trocar de provedor de túnel é um UPDATE aqui, não um deploy.';

-- -----------------------------------------------------------------------------
-- A URL nova — apenas onde o host morto ainda está gravado.
-- -----------------------------------------------------------------------------
update public.collector_sources
   set url     = 'https://charred-buzz-tannery.ngrok-free.dev/get_' || code,
       headers = '{"accept": "application/json", "ngrok-skip-browser-warning": "true"}'::jsonb,
       notes   = 'Túnel ngrok (ngrok-free.dev): o subdomínio muda quando a Forzy reinicia o agente. Trocar com: npm run collector -- url both <base>'
 where url like '%trycloudflare.com%';

-- -----------------------------------------------------------------------------
-- dispatch() — agora com cabeçalhos da tabela e falha isolada por origem.
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
    select id, code, url, headers, timeout_ms
      from public.collector_sources
     where is_enabled
     order by code
  loop
    begin
      v_request_id := net.http_get(
        url                  => v_source.url,
        headers              => v_source.headers,
        timeout_milliseconds => v_source.timeout_ms
      );

      insert into public.collector_requests (request_id, source_id)
      values (v_request_id, v_source.id)
      on conflict (request_id) do nothing;

      v_count := v_count + 1;

    exception when others then
      -- Falha na hora de enfileirar (URL malformada, extensão fora do ar). Vira
      -- captura como qualquer outra falha: a origem irmã segue coletando.
      insert into public.sensor_raw_captures (
        source_id, requested_at, responded_at, http_status, error
      )
      values (v_source.id, now(), now(), null, 'dispatch: ' || sqlerrm);
    end;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- collector_health — "pendentes" contava as falhas permanentes.
--
-- Uma captura sem HTTP 200 nunca vira série temporal (ingest() só olha 200), e
-- ingested_at fica null para sempre. Com o túnel morto, o painel mostrava 2013
-- pendentes que nada iria processar. Pendente é o que ainda vai ser ingerido.
-- -----------------------------------------------------------------------------
drop view if exists public.collector_health;

create view public.collector_health as
select
  s.code,
  s.name,
  s.url,
  s.is_enabled,
  count(c.id)                                                   as capturas,
  count(c.id) filter (where c.http_status = 200)                as ok,
  count(c.id) filter (where c.http_status is distinct from 200) as falhas,
  count(c.id) filter (where c.http_status = 200
                        and c.ingested_at is null)              as pendentes,
  coalesce(sum(c.ingested_rows), 0)                             as leituras_gravadas,
  max(c.responded_at)                                           as ultima_captura,
  max(c.responded_at) filter (where c.http_status = 200)        as ultimo_sucesso,
  (array_agg(coalesce(c.error, 'HTTP ' || c.http_status)
             order by c.responded_at desc)
     filter (where c.http_status is distinct from 200))[1]      as ultimo_erro
from public.collector_sources s
left join public.sensor_raw_captures c on c.source_id = s.id
group by s.id, s.code, s.name, s.url, s.is_enabled;

comment on view public.collector_health is
  'Saúde do coletor por endpoint — use para conferir se a janela rendeu dados.';
