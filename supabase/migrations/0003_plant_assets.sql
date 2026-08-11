-- =============================================================================
-- 0003 — Planta, áreas, ativos e placa de dados (OCR)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plants — unidades industriais
-- -----------------------------------------------------------------------------
create table if not exists public.plants (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  address     text,
  city        text,
  state       text,
  country     text not null default 'BR',
  timezone    text not null default 'America/Sao_Paulo',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists plants_set_updated_at on public.plants;
create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();

-- FK adiada de 0002 (profiles.plant_id)
do $$ begin
  alter table public.profiles
    add constraint profiles_plant_id_fkey
    foreign key (plant_id) references public.plants(id) on delete set null;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- areas — halls / setores navegáveis da planta baixa
-- -----------------------------------------------------------------------------
create table if not exists public.areas (
  id             uuid primary key default gen_random_uuid(),
  plant_id       uuid not null references public.plants(id) on delete cascade,
  code           text not null,
  name           text not null,
  description    text,
  floor_plan_url text,                              -- SVG/PDF navegável (Módulo 3)
  grid_cols      integer not null default 3,
  grid_rows      integer not null default 3,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint areas_plant_code_key unique (plant_id, code),
  constraint areas_grid_check check (grid_cols between 1 and 50 and grid_rows between 1 and 50)
);

create index if not exists areas_plant_idx on public.areas (plant_id);

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- assets — ativos monitorados (TAG tipo MTR-001)
-- -----------------------------------------------------------------------------
create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  plant_id          uuid not null references public.plants(id) on delete cascade,
  area_id           uuid references public.areas(id) on delete set null,
  tag               text not null,                  -- identificador industrial: MTR-001
  name              text not null,
  asset_type        public.asset_type not null default 'motor',
  location          text not null default '',       -- rótulo legível: "Hall A — Estação 1"
  status            public.asset_status not null default 'normal',
  criticality       public.criticality_level not null default 'medium',
  uptime            numeric(5,2) not null default 100.00,
  anomaly_score     numeric(5,2) not null default 0.00,
  grid_x            integer not null default 1,     -- posição na planta baixa
  grid_y            integer not null default 1,
  image_url         text,
  commissioned_at   date,
  last_maintenance  date,
  next_maintenance  date,
  is_active         boolean not null default true,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint assets_tag_plant_key unique (plant_id, tag),
  constraint assets_uptime_check  check (uptime between 0 and 100),
  constraint assets_anomaly_check check (anomaly_score between 0 and 100),
  constraint assets_grid_check    check (grid_x >= 1 and grid_y >= 1)
);

comment on column public.assets.anomaly_score is 'Score 0-100 produzido pelo modelo de anomalia (Módulo 4).';

create index if not exists assets_plant_idx    on public.assets (plant_id);
create index if not exists assets_area_idx     on public.assets (area_id);
create index if not exists assets_status_idx   on public.assets (status) where is_active;
create index if not exists assets_tag_trgm_idx on public.assets using gin (tag gin_trgm_ops);
create index if not exists assets_grid_idx     on public.assets (area_id, grid_x, grid_y);

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

drop trigger if exists assets_audit on public.assets;
create trigger assets_audit
  after insert or update or delete on public.assets
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- asset_nameplates — dados de placa extraídos por OCR/visão (Módulo 2)
-- -----------------------------------------------------------------------------
create table if not exists public.asset_nameplates (
  id                 uuid primary key default gen_random_uuid(),
  asset_id           uuid references public.assets(id) on delete cascade,
  status             public.nameplate_status not null default 'draft',

  -- Campos técnicos exigidos pela user story 6.3
  serial_number      text,
  manufacturer       text,
  model              text,
  year_manufactured  integer,
  motor_type         text,                          -- ex.: 'Trifásico assíncrono'
  power_kw           numeric(10,3),
  power_hp           numeric(10,3),
  voltage            text,                          -- ex.: '220/440V'
  current_a          numeric(10,3),
  rpm                integer,
  poles              integer,
  frequency_hz       numeric(6,2),
  connection_type    text,                          -- estrela / triângulo
  service_factor     numeric(4,2),
  insulation_class   text,
  ip_rating          text,
  efficiency_class   text,                          -- IE1..IE4
  weight_kg          numeric(10,2),

  -- Rastreabilidade da extração automática
  image_url          text,
  storage_path       text,
  ocr_provider       text,                          -- paddleocr | easyocr | claude-vision | ...
  ocr_confidence     numeric(5,4),
  ocr_raw            jsonb not null default '{}'::jsonb,
  extra              jsonb not null default '{}'::jsonb,

  registered_by      uuid references public.profiles(id) on delete set null,
  confirmed_by       uuid references public.profiles(id) on delete set null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint nameplates_year_check       check (year_manufactured is null or year_manufactured between 1900 and 2100),
  constraint nameplates_poles_check      check (poles is null or poles between 2 and 64),
  constraint nameplates_confidence_check check (ocr_confidence is null or ocr_confidence between 0 and 1)
);

create index if not exists nameplates_asset_idx  on public.asset_nameplates (asset_id);
create index if not exists nameplates_status_idx on public.asset_nameplates (status, created_at desc);
create unique index if not exists nameplates_serial_key
  on public.asset_nameplates (serial_number)
  where serial_number is not null and status = 'confirmed';

drop trigger if exists nameplates_set_updated_at on public.asset_nameplates;
create trigger nameplates_set_updated_at
  before update on public.asset_nameplates
  for each row execute function public.set_updated_at();

drop trigger if exists nameplates_audit on public.asset_nameplates;
create trigger nameplates_audit
  after insert or update or delete on public.asset_nameplates
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- asset_health_snapshots — histórico de saúde para gráficos de tendência
-- -----------------------------------------------------------------------------
create table if not exists public.asset_health_snapshots (
  id             bigint generated always as identity primary key,
  asset_id       uuid not null references public.assets(id) on delete cascade,
  captured_at    timestamptz not null default now(),
  uptime         numeric(5,2) not null,
  anomaly_score  numeric(5,2) not null,
  status         public.asset_status not null,
  active_alerts  integer not null default 0,
  constraint health_uptime_check  check (uptime between 0 and 100),
  constraint health_anomaly_check check (anomaly_score between 0 and 100)
);

create index if not exists health_asset_time_idx on public.asset_health_snapshots (asset_id, captured_at desc);

-- Registra um ponto de histórico sempre que uptime/anomalia/status mudam.
create or replace function public.snapshot_asset_health()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.uptime is distinct from old.uptime
     or new.anomaly_score is distinct from old.anomaly_score
     or new.status is distinct from old.status then
    insert into public.asset_health_snapshots (asset_id, uptime, anomaly_score, status, active_alerts)
    values (
      new.id, new.uptime, new.anomaly_score, new.status,
      (select count(*) from public.alerts a where a.asset_id = new.id and a.status <> 'resolved')
    );
  end if;
  return new;
end;
$$;
-- O trigger é criado em 0005, após a tabela public.alerts existir.
