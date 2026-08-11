-- =============================================================================
-- 0007 — Assistente conversacional, base documental e RAG (Módulo 5)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- documents — manuais, procedimentos e datasheets do ativo
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid references public.assets(id) on delete cascade,
  plant_id      uuid references public.plants(id) on delete cascade,
  title         text not null,
  document_type public.document_type not null default 'manual',
  description   text,
  file_url      text,
  storage_path  text,
  mime_type     text,
  size_bytes    bigint,
  language      text not null default 'pt',
  version       text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  indexed_at    timestamptz,
  chunk_count   integer not null default 0,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists documents_asset_idx on public.documents (asset_id);
create index if not exists documents_type_idx  on public.documents (document_type);
create index if not exists documents_title_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- document_chunks — vetores para busca semântica
-- Dimensão 1536 (OpenAI text-embedding-3-small / compatíveis).
-- -----------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  asset_id     uuid references public.assets(id) on delete cascade,
  chunk_index  integer not null,
  content      text not null,
  token_count  integer,
  page_number  integer,
  embedding    vector(1536),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint document_chunks_unique unique (document_id, chunk_index)
);

create index if not exists document_chunks_doc_idx   on public.document_chunks (document_id);
create index if not exists document_chunks_asset_idx on public.document_chunks (asset_id);

-- HNSW para similaridade por cosseno.
do $$ begin
  create index document_chunks_embedding_idx
    on public.document_chunks
    using hnsw (embedding vector_cosine_ops);
exception when duplicate_table then null; end $$;

-- Busca semântica usada pelo agente conversacional.
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count     integer default 5,
  filter_asset_id uuid    default null,
  similarity_threshold double precision default 0.0
)
returns table (
  id           uuid,
  document_id  uuid,
  document_title text,
  asset_id     uuid,
  content      text,
  page_number  integer,
  similarity   double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.title,
    c.asset_id,
    c.content,
    c.page_number,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_asset_id is null or c.asset_id = filter_asset_id or d.asset_id = filter_asset_id)
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Mantém o contador de chunks do documento coerente.
create or replace function public.sync_document_chunk_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc uuid := coalesce(new.document_id, old.document_id);
begin
  update public.documents
     set chunk_count = (select count(*) from public.document_chunks where document_id = v_doc),
         indexed_at  = now()
   where id = v_doc;
  return coalesce(new, old);
end;
$$;

drop trigger if exists document_chunks_sync_count on public.document_chunks;
create trigger document_chunks_sync_count
  after insert or delete on public.document_chunks
  for each row execute function public.sync_document_chunk_count();

-- -----------------------------------------------------------------------------
-- chat_conversations / chat_messages
-- -----------------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  asset_id    uuid references public.assets(id) on delete set null,
  title       text not null default 'Nova conversa',
  is_archived boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists chat_conv_user_idx on public.chat_conversations (user_id, updated_at desc);

drop trigger if exists chat_conv_set_updated_at on public.chat_conversations;
create trigger chat_conv_set_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role            public.chat_role not null,
  content         text not null,
  asset_context   uuid references public.assets(id) on delete set null,
  citations       jsonb not null default '[]'::jsonb,   -- chunks do RAG usados na resposta
  tool_calls      jsonb not null default '[]'::jsonb,   -- function calling ao banco
  model           text,
  prompt_tokens   integer,
  completion_tokens integer,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);

-- Toda mensagem nova reordena a conversa na listagem.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.chat_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conv on public.chat_messages;
create trigger chat_messages_touch_conv
  after insert on public.chat_messages
  for each row execute function public.touch_conversation();
