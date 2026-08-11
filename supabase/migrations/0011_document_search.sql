-- =============================================================================
-- 0011 — Busca lexical na base documental
--
-- Recuperação por texto completo em português, disponível de imediato. É a
-- linha de base do RAG enquanto os embeddings (0007) não são gerados por um
-- provedor externo; as duas rotas convivem e podem ser combinadas.
-- =============================================================================

alter table public.document_chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('portuguese', content)) stored;

create index if not exists document_chunks_tsv_idx
  on public.document_chunks using gin (content_tsv);

create index if not exists document_chunks_content_trgm_idx
  on public.document_chunks using gin (content gin_trgm_ops);

create or replace function public.search_document_chunks(
  p_query    text,
  p_asset_id uuid    default null,
  p_limit    integer default 5
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  document_type  public.document_type,
  asset_id       uuid,
  content        text,
  page_number    integer,
  rank           real
)
language sql
stable
set search_path = public, extensions
as $$
  -- Recuperação usa OR com prefixo e ordena por relevância: exigir todos os
  -- termos (comportamento de websearch_to_tsquery) devolveria vazio na maioria
  -- das perguntas em linguagem natural.
  with q as (
    select nullif(
      (select string_agg(quote_literal(lexeme) || ':*', ' | ')
         from unnest(to_tsvector('portuguese', coalesce(p_query, '')))),
      ''
    ) as raw
  ),
  parsed as (
    select case when q.raw is null then null else to_tsquery('portuguese', q.raw) end as tsq
    from q
  )
  select
    c.id,
    c.document_id,
    d.title,
    d.document_type,
    coalesce(c.asset_id, d.asset_id),
    c.content,
    c.page_number,
    ts_rank(c.content_tsv, parsed.tsq) as rank
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  cross join parsed
  where parsed.tsq is not null
    and c.content_tsv @@ parsed.tsq
    and (p_asset_id is null or c.asset_id = p_asset_id or d.asset_id = p_asset_id)
  order by rank desc
  limit greatest(p_limit, 1);
$$;

-- -----------------------------------------------------------------------------
-- Contexto operacional consolidado de um ativo.
-- O assistente usa esta função para responder ancorado em dados reais.
-- -----------------------------------------------------------------------------
create or replace function public.get_asset_context(p_asset_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'asset', (
      select jsonb_build_object(
        'tag', a.tag, 'name', a.name, 'status', a.status, 'location', a.location,
        'uptime', a.uptime, 'anomaly_score', a.anomaly_score,
        'last_maintenance', a.last_maintenance, 'next_maintenance', a.next_maintenance
      )
      from public.assets a where a.id = p_asset_id
    ),
    'sensors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', v.name, 'unit', v.unit, 'value', round(v.current_value::numeric, 2),
        'status', v.current_status, 'warning', v.warning_threshold, 'critical', v.critical_threshold
      ) order by v.name)
      from public.v_sensor_current v where v.asset_id = p_asset_id and v.is_active
    ), '[]'::jsonb),
    'active_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'severity', al.severity, 'title', al.title, 'message', al.message,
        'ml_insight', al.ml_insight, 'triggered_at', al.triggered_at
      ) order by al.triggered_at desc)
      from public.alerts al where al.asset_id = p_asset_id and al.status <> 'resolved'
    ), '[]'::jsonb),
    'predictions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', p.prediction_type, 'value', p.value, 'confidence', p.confidence,
        'rul_days', p.rul_days, 'recommended_action', p.recommended_action,
        'explanation', p.explanation, 'model', p.model_name || ' v' || p.model_version
      ))
      from public.v_asset_latest_prediction p where p.asset_id = p_asset_id
    ), '[]'::jsonb),
    'open_maintenance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_number', m.order_number, 'type', m.maintenance_type, 'status', m.status,
        'title', m.title, 'scheduled_for', m.scheduled_for
      ) order by m.scheduled_for)
      from public.maintenance_orders m
      where m.asset_id = p_asset_id and m.status <> 'completed' and m.status <> 'cancelled'
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.search_document_chunks(text, uuid, integer) to authenticated;
grant execute on function public.get_asset_context(uuid) to authenticated;
