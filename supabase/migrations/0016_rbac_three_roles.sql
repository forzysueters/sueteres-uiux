-- =============================================================================
-- 0016 — RBAC de tres papeis: admin, engineer, technician
--
-- Elimina o papel 'viewer' recriando o enum e redesenha a matriz inteira de
-- permissoes no modelo "so o admin destroi":
--
--   OPERAR      (os 3, ativos) ler tudo; reconhecer/resolver alerta; abrir e
--                              concluir OM; registrar placa pelo OCR
--   CONFIGURAR  (admin+eng)    corrigir placa a mao; criar/editar/desativar
--                              ativo; layout; sensores e limites; atribuir OM;
--                              ML; documentos
--   ADMINISTRAR (admin)        TODO delete; usuarios; plantas/areas; auditoria;
--                              coletor IoT
--
-- Reverte a 0015 (assets_delete volta a ser exclusivo do admin).
--
-- ESTE ARQUIVO E A FONTE DA VERDADE DO RBAC. O `db.mjs` reaplica todas as
-- migracoes em ordem a cada `npm run db:migrate`, entao 0002/0009/0010/0014
-- recriam a superficie antiga e 0016, por ser a ultima, a substitui. Nenhuma
-- migracao anterior foi editada: o enum da 0001 nasce com
-- `exception when duplicate_object then null`, logo a reexecucao nao o recria.
-- =============================================================================

set search_path = public, extensions;

-- ─── A. Vassoura ────────────────────────────────────────────────────────────
-- Dropar os helpers com CASCADE derruba TODA policy que os chama (~40). E o
-- comportamento desejado, nao um acidente: a matriz inteira e redesenhada
-- abaixo, e o que este arquivo nao recriar deixa de existir. Tabela com RLS
-- ligada e zero policy NEGA TUDO — o erro possivel e sempre para o lado seguro.
--
-- Sobrevivem (nao citam helper): service_role_all, user_settings_own,
-- chat_conv_own, chat_msg_own, storage_public_read, storage_avatar_own.
drop function if exists public.can_read()  cascade;
drop function if exists public.can_write() cascade;
drop function if exists public.is_admin()  cascade;
drop function if exists public.has_role(public.user_role[]) cascade;
drop function if exists public.current_user_role() cascade;

-- ─── B. Troca do enum ───────────────────────────────────────────────────────
-- O Postgres nao tem ALTER TYPE ... DROP VALUE: o tipo e recriado e a coluna
-- convertida por ::text::. A ordem abaixo nao e negociavel.

-- O default 'viewer' impede o ALTER COLUMN TYPE.
alter table public.profiles alter column role drop default;

-- Comparacao por TEXTO: numa reexecucao o rotulo ja nao existe no enum, e
-- `role = 'viewer'` levantaria "invalid input value for enum". Assim vira no-op.
update public.profiles
   set role = 'technician',
       is_active = false
 where role::text = 'viewer';

do $$
begin
  if exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = 'user_role'
       and e.enumlabel = 'viewer'
  ) then
    alter type public.user_role rename to user_role_legacy;
    create type public.user_role as enum ('admin', 'engineer', 'technician');
    alter table public.profiles
      alter column role type public.user_role
      using role::text::public.user_role;
    drop type public.user_role_legacy;
  end if;
end $$;

alter table public.profiles alter column role set default 'technician';

comment on type public.user_role is
  'admin | engineer | technician. O viewer foi eliminado na 0016: quem so olha entra como technician inativo, liberado por um admin.';

-- ─── C. Helpers ─────────────────────────────────────────────────────────────
-- Nomeados pela CAPACIDADE, nao pelo conjunto de papeis: no dia em que entrar
-- um quarto papel na faixa 2, `is_engineer_or_admin()` viraria mentira em 15
-- policies, enquanto `can_configure()` continua verdade e so o corpo muda.
--
-- can_read()/can_write() foram removidos de proposito: com tres papeis que
-- todos escrevem, os dois viraram sinonimos, e dois nomes para o mesmo teste
-- so servem para o proximo dev escolher o errado.

create or replace function public.has_role(variadic p_roles public.user_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and is_active and role = any(p_roles)
  );
$$;

create or replace function public.can_operate()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin', 'engineer', 'technician');
$$;

create or replace function public.can_configure()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin', 'engineer');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- Passa a exigir is_active, corrigindo a assimetria da 0002: papel de conta
-- desativada nao e papel. Serve a diagnostico e ao front, nunca a policy.
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

comment on function public.can_operate()   is 'Faixa 1 da matriz: qualquer papel ATIVO.';
comment on function public.can_configure() is 'Faixa 2: admin ou engineer ativos.';
comment on function public.is_admin()      is 'Faixa 3: admin ativo. O unico que destroi.';

-- ─── D. Grants base ─────────────────────────────────────────────────────────
-- Reafirmados porque a 0009 os reaplica antes deste arquivo. Quem filtra e a
-- RLS; o grant amplo e so a porta de entrada.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables   in schema public to authenticated;
grant usage, select                 on all sequences in schema public to authenticated;
grant execute                       on all functions in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- ─── E. profiles ────────────────────────────────────────────────────────────
-- NOTA: `or public.can_operate()` mantem o comportamento atual — qualquer
-- usuario ativo le o perfil alheio. Nao e o ideal (expoe e-mail e telefone),
-- mas fechar isso quebraria `getTechnicians()` (seletor de responsavel pela OM)
-- e a Edge Function send-maintenance-email, que resolve destinatarios daqui.
-- Corrigir exige uma view de diretorio sem PII: registrado como pendencia.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_operate());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- ─── F. Governanca ──────────────────────────────────────────────────────────
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (public.is_admin() or actor_id = auth.uid());

drop policy if exists lgpd_own on public.lgpd_consents;
create policy lgpd_own on public.lgpd_consents
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ─── G. Catalogo da planta — escrita so do admin ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['plants', 'areas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_operate())',
      t || '_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_write', t
    );
  end loop;
end $$;

-- ─── H. assets — configura o engenheiro, destroi o admin ────────────────────
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select to authenticated using (public.can_operate());

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert to authenticated with check (public.can_configure());

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update to authenticated
  using (public.can_configure())
  with check (public.can_configure());

-- Reverte a 0015: apagar ativo leva junto sensores, leituras, alertas e OMs
-- por cascade. Desativar (is_active = false) continua sendo faixa 2.
drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete to authenticated using (public.is_admin());

-- ─── I. asset_nameplates ────────────────────────────────────────────────────
-- INSERT e faixa 1 (o tecnico registra a placa que fotografou em campo), mas
-- UPDATE e faixa 2 — e confirmar a placa E um update. Sem a RPC
-- `confirm_nameplate` (bloco S) o wizard de OCR do tecnico quebraria no ultimo
-- passo.
drop policy if exists nameplates_select on public.asset_nameplates;
create policy nameplates_select on public.asset_nameplates
  for select to authenticated using (public.can_operate());

drop policy if exists nameplates_insert on public.asset_nameplates;
create policy nameplates_insert on public.asset_nameplates
  for insert to authenticated with check (public.can_operate());

drop policy if exists nameplates_update on public.asset_nameplates;
create policy nameplates_update on public.asset_nameplates
  for update to authenticated
  using (public.can_configure())
  with check (public.can_configure());

drop policy if exists nameplates_delete on public.asset_nameplates;
create policy nameplates_delete on public.asset_nameplates
  for delete to authenticated using (public.is_admin());

-- ─── J. Telemetria ──────────────────────────────────────────────────────────
drop policy if exists health_select on public.asset_health_snapshots;
create policy health_select on public.asset_health_snapshots
  for select to authenticated using (public.can_operate());

drop policy if exists sensors_select on public.sensors;
create policy sensors_select on public.sensors
  for select to authenticated using (public.can_operate());

drop policy if exists sensors_write on public.sensors;
create policy sensors_write on public.sensors
  for insert to authenticated with check (public.can_configure());

drop policy if exists sensors_update on public.sensors;
create policy sensors_update on public.sensors
  for update to authenticated
  using (public.can_configure()) with check (public.can_configure());

drop policy if exists sensors_delete on public.sensors;
create policy sensors_delete on public.sensors
  for delete to authenticated using (public.is_admin());

drop policy if exists readings_select on public.sensor_readings;
create policy readings_select on public.sensor_readings
  for select to authenticated using (public.can_operate());

drop policy if exists readings_insert on public.sensor_readings;
create policy readings_insert on public.sensor_readings
  for insert to authenticated with check (public.can_configure());

-- Historico e imutavel: sem UPDATE/DELETE para usuarios autenticados.

-- ─── K. alerts — tratar e faixa 1, apagar e faixa 3 ─────────────────────────
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select to authenticated using (public.can_operate());

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
  for insert to authenticated with check (public.can_operate());

drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts
  for update to authenticated
  using (public.can_operate()) with check (public.can_operate());

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts
  for delete to authenticated using (public.is_admin());

-- ─── L. maintenance_orders ──────────────────────────────────────────────────
-- Abrir e concluir e faixa 1; ATRIBUIR a outra pessoa e faixa 2 (bloco M).
drop policy if exists maintenance_select on public.maintenance_orders;
create policy maintenance_select on public.maintenance_orders
  for select to authenticated using (public.can_operate());

drop policy if exists maintenance_insert on public.maintenance_orders;
create policy maintenance_insert on public.maintenance_orders
  for insert to authenticated with check (public.can_operate());

drop policy if exists maintenance_update on public.maintenance_orders;
create policy maintenance_update on public.maintenance_orders
  for update to authenticated
  using (public.can_operate()) with check (public.can_operate());

drop policy if exists maintenance_delete on public.maintenance_orders;
create policy maintenance_delete on public.maintenance_orders
  for delete to authenticated using (public.is_admin());

-- ─── M. Atribuicao de ordem de manutencao ───────────────────────────────────
-- O tecnico abre ordem, mas so para si mesmo: designar trabalho a outra pessoa
-- e decisao de quem planeja. A UI esconde o passo de responsavel para ele; este
-- trigger e a garantia de que esconder nao e a unica defesa.
create or replace function public.guard_maintenance_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.can_configure() then
    return new;
  end if;
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid() then
    raise exception 'Atribuir ordem de manutencao a outra pessoa exige engenheiro ou administrador'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists maintenance_guard_assignment on public.maintenance_orders;
create trigger maintenance_guard_assignment
  before insert or update on public.maintenance_orders
  for each row execute function public.guard_maintenance_assignment();

-- ─── N. Machine Learning ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ml_models', 'ml_predictions', 'ml_training_runs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_operate())',
      t || '_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_configure())',
      t || '_write', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_configure()) with check (public.can_configure())',
      t || '_update', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      t || '_delete', t
    );
  end loop;
end $$;

-- ─── O. Base documental / RAG ───────────────────────────────────────────────
-- `chunks_select`/`chunks_write` da 0009 cairam no CASCADE e sao substituidas
-- pelos nomes deste laco (document_chunks_*).
do $$
declare t text;
begin
  foreach t in array array['documents', 'document_chunks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_operate())',
      t || '_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_configure())',
      t || '_write', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_configure()) with check (public.can_configure())',
      t || '_update', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin())',
      t || '_delete', t
    );
  end loop;
end $$;

-- ─── P. Coletor IoT — passa a ser exclusivo do admin ────────────────────────
do $$
declare t text;
begin
  foreach t in array array['collector_config', 'collector_sources', 'collector_requests',
                           'collector_field_map', 'sensor_raw_captures'] loop
    execute format('drop policy if exists collector_select on public.%I', t);
    execute format(
      'create policy collector_select on public.%I for select to authenticated using (public.can_operate())',
      t
    );
    execute format('drop policy if exists collector_write on public.%I', t);
    execute format(
      'create policy collector_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;

-- ─── Q. Storage ─────────────────────────────────────────────────────────────
-- `storage_public_read` e `storage_avatar_own` nao citam helper: sobreviveram
-- ao CASCADE e continuam valendo.
drop policy if exists storage_equipment_write on storage.objects;
create policy storage_equipment_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'equipment-images' and public.can_operate());

drop policy if exists storage_equipment_update on storage.objects;
create policy storage_equipment_update on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment-images' and public.can_configure())
  with check (bucket_id = 'equipment-images' and public.can_configure());

drop policy if exists storage_equipment_delete on storage.objects;
create policy storage_equipment_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment-images' and public.is_admin());

drop policy if exists storage_floorplan_write on storage.objects;
create policy storage_floorplan_write on storage.objects
  for all to authenticated
  using (bucket_id = 'floor-plans' and public.can_configure())
  with check (bucket_id = 'floor-plans' and public.can_configure());

drop policy if exists storage_documents_read on storage.objects;
create policy storage_documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.can_operate());

drop policy if exists storage_documents_write on storage.objects;
create policy storage_documents_write on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.can_configure())
  with check (bucket_id = 'documents' and public.can_configure());

-- ─── R. Colunas de saida do modelo em `assets` ──────────────────────────────
-- Privilegio POR COLUNA, nao trigger com flag de sessao. E declarativo, o erro
-- e explicito ("permission denied for column health_index") e nao ha nada a
-- falsificar. As RPCs que legitimamente escrevem essas colunas passam a ser
-- SECURITY DEFINER (bloco seguinte) e rodam como o dono, que tem tudo.
--
-- Derivadas, nunca digitadas: status, uptime, anomaly_score (0003/0008),
-- health_index, severity, insight, thermal_residual, scored_at (0012).
--
-- ATENCAO A ORDEM: a 0009 reexecuta `grant ... on all tables to authenticated`,
-- que restaura o privilegio de tabela inteira — e REVOKE UPDATE ON TABLE
-- tambem apaga os privilegios de coluna. E 0016 rodar por ULTIMO que sustenta
-- esta trava. Migracao 0017+ que repita um grant amplo tem de reaplicar isto.
--
-- ATENCAO A COLUNAS NOVAS: o grant e uma lista fixa. Coluna adicionada a
-- `assets` depois desta migracao nasce SEM update para `authenticated`, e o
-- sintoma e "permission denied for column <nova>". A correcao e acrescenta-la
-- as duas listas abaixo. Falha na direcao segura, mas confunde quem nao souber.
revoke update on public.assets from authenticated;
grant update (
  plant_id, area_id, tag, name, asset_type, location, criticality,
  grid_x, grid_y, plant_x, plant_y, image_url,
  commissioned_at, last_maintenance, next_maintenance, is_active, metadata
) on public.assets to authenticated;

-- Mesma lista no INSERT: sem isso, `createAsset` poderia nascer com
-- health_index = 100 escrito a mao. Coluna omitida no INSERT usa o DEFAULT e
-- nao exige privilegio, entao `status` e `uptime` continuam funcionando.
revoke insert on public.assets from authenticated;
grant insert (
  plant_id, area_id, tag, name, asset_type, location, criticality,
  grid_x, grid_y, plant_x, plant_y, image_url,
  commissioned_at, last_maintenance, next_maintenance, is_active, metadata
) on public.assets to authenticated;
-- `updated_at` fica de fora: quem escreve e o trigger set_updated_at, e
-- atribuicao a NEW dentro de trigger nao passa por checagem de privilegio.

-- ─── S. RPCs que escrevem as colunas do modelo ──────────────────────────────
create or replace function public.apply_anomaly_score(
  p_asset_id         uuid,
  p_health_index     double precision,
  p_anomaly_score    double precision,
  p_severity         text,
  p_insight          text default null,
  p_thermal_residual double precision default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- DEFINER passa por cima da RLS: a checagem que a policy fazia vem para ca.
  if auth.uid() is not null and not public.can_operate() then
    raise exception 'Conta inativa ou sem permissao para pontuar ativos'
      using errcode = '42501';
  end if;

  update public.assets
     set health_index     = round(p_health_index::numeric, 2),
         anomaly_score    = round(greatest(least(p_anomaly_score, 100), 0)::numeric, 2),
         severity         = p_severity::public.anomaly_severity,
         insight          = coalesce(p_insight, insight),
         thermal_residual = p_thermal_residual,
         scored_at        = now()
   where id = p_asset_id;
end $$;

revoke all on function public.apply_anomaly_score(uuid, double precision, double precision, text, text, double precision) from public, anon;
grant execute on function public.apply_anomaly_score(uuid, double precision, double precision, text, text, double precision) to authenticated;

-- ─── T. Registro de placa pelo tecnico ──────────────────────────────────────
-- Confirmar uma placa e um UPDATE, e update de placa e faixa 2 — sem esta RPC
-- o wizard de OCR do tecnico morreria no ultimo passo. Ela distingue REGISTRAR
-- (faixa 1) de CORRIGIR A MAO (faixa 2) pelo `ocr_provider = 'manual'`, que e
-- exatamente a marca que `saveNameplateRevision` grava.
--
-- De brinde, encapsula os tres round-trips do front numa chamada atomica e
-- fecha a janela em que a placa anterior ja foi rebaixada e a nova ainda nao
-- foi confirmada.
create or replace function public.confirm_nameplate(p_nameplate_id uuid, p_asset_id uuid)
returns public.asset_nameplates
language plpgsql security definer set search_path = public as $$
declare
  v_row   public.asset_nameplates;
  v_clash text;
begin
  if not public.can_operate() then
    raise exception 'Conta inativa ou sem permissao para registrar placa'
      using errcode = '42501';
  end if;

  select * into v_row from public.asset_nameplates where id = p_nameplate_id;
  if not found then
    raise exception 'Placa % nao encontrada', p_nameplate_id using errcode = 'P0002';
  end if;

  -- Correcao manual e faixa 2, mesmo que quem a tenha criado seja o tecnico.
  if (coalesce(v_row.ocr_provider, '') = 'manual' or v_row.ocr_raw ? 'edited_from')
     and not public.can_configure() then
    raise exception 'Corrigir placa a mao exige engenheiro ou administrador'
      using errcode = '42501';
  end if;

  -- O tecnico so confirma a placa que ele mesmo registrou.
  if not public.can_configure() and v_row.registered_by is distinct from auth.uid() then
    raise exception 'Voce so confirma a placa que voce mesmo registrou'
      using errcode = '42501';
  end if;

  if p_asset_id is not null then
    -- Checagem de serie ANTES de rebaixar a anterior: se o conflito so
    -- aparecesse no update final, o ativo teria perdido a placa que tinha sem
    -- ganhar a nova.
    if v_row.serial_number is not null then
      select a.tag into v_clash
        from public.asset_nameplates n
        join public.assets a on a.id = n.asset_id
       where n.serial_number = v_row.serial_number
         and n.status = 'confirmed'
         and n.asset_id is distinct from p_asset_id
       limit 1;
      if v_clash is not null then
        raise exception 'O numero de serie "%" ja pertence a placa confirmada do ativo %',
          v_row.serial_number, v_clash using errcode = '23505';
      end if;
    end if;

    update public.asset_nameplates set status = 'rejected'
     where asset_id = p_asset_id and status = 'confirmed' and id <> p_nameplate_id;
  end if;

  update public.asset_nameplates
     set asset_id     = p_asset_id,
         status       = 'confirmed',
         confirmed_by = auth.uid(),
         confirmed_at = now()
   where id = p_nameplate_id
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.confirm_nameplate(uuid, uuid) from public, anon;
grant execute on function public.confirm_nameplate(uuid, uuid) to authenticated;

-- Autoria carimbada na origem, para a regra acima ter em que se apoiar.
create or replace function public.stamp_nameplate_author()
returns trigger language plpgsql as $$
begin
  new.registered_by := coalesce(new.registered_by, auth.uid());
  return new;
end $$;

drop trigger if exists nameplates_stamp_author on public.asset_nameplates;
create trigger nameplates_stamp_author
  before insert on public.asset_nameplates
  for each row execute function public.stamp_nameplate_author();

-- ─── U. Alertas: falhar alto em vez de em silencio ──────────────────────────
-- Continuam SECURITY INVOKER de proposito — a RLS TEM de valer. O defeito era
-- outro: `update ... returning` que casa ZERO linhas devolvia NULL sem erro, o
-- cliente so olhava `error`, e a interface dizia "resolvido" para uma escrita
-- que nunca aconteceu. Some ao recarregar a pagina.
create or replace function public.resolve_alert(p_alert_id uuid, p_notes text default null)
returns public.alerts
language plpgsql volatile set search_path = public as $$
declare v_row public.alerts;
begin
  update public.alerts
     set status = 'resolved',
         resolution_notes = coalesce(p_notes, resolution_notes)
   where id = p_alert_id
  returning * into v_row;

  if not found then
    raise exception 'Alerta % nao encontrado ou fora do seu alcance de permissao', p_alert_id
      using errcode = '42501';
  end if;
  return v_row;
end $$;

create or replace function public.acknowledge_alert(p_alert_id uuid)
returns public.alerts
language plpgsql volatile set search_path = public as $$
declare v_row public.alerts;
begin
  update public.alerts
     set status = 'acknowledged'
   where id = p_alert_id
  returning * into v_row;

  if not found then
    raise exception 'Alerta % nao encontrado ou fora do seu alcance de permissao', p_alert_id
      using errcode = '42501';
  end if;
  return v_row;
end $$;

-- ─── V. Provisionamento de conta ────────────────────────────────────────────
-- Cadastro espontaneo nasce technician INATIVO: sem `is_active`, has_role()
-- recusa tudo, entao a conta nao enxerga nada ate um admin liberar na tela de
-- usuarios. O papel continua vindo de `raw_app_meta_data` (so a Auth Admin API
-- escreve la); `raw_user_meta_data` e do cliente e nunca concede privilegio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app_meta  jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_role      public.user_role;
  v_is_active boolean;
begin
  begin
    v_role := (v_app_meta ->> 'role')::public.user_role;
  exception when invalid_text_representation then
    v_role := null;   -- 'viewer' de um provisionamento antigo cai aqui
  end;

  v_is_active := v_role is not null;
  v_role := coalesce(v_role, 'technician');

  insert into public.profiles (id, email, full_name, role, is_active, job_title, department)
  values (
    new.id,
    new.email,
    coalesce(v_meta ->> 'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_is_active,
    v_meta ->> 'job_title',
    v_meta ->> 'department'
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

-- ─── W. Guarda de privilegio ────────────────────────────────────────────────
-- Alem das tres colunas ja protegidas, duas regras que impedem o admin de se
-- trancar para fora do proprio sistema.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;   -- migracao, seed ou job: ja privilegiado
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Apenas administradores alteram o papel de um usuario' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Apenas administradores ativam ou desativam usuarios' using errcode = '42501';
    end if;
    if new.plant_id is distinct from old.plant_id then
      raise exception 'Apenas administradores movem um usuario de planta' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Admin, mas nem tudo e permitido:
  if new.id = auth.uid()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'Um administrador nao rebaixa nem desativa a si mesmo' using errcode = '42501';
  end if;

  if (old.role = 'admin' and old.is_active)
     and (new.role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles
        where role = 'admin' and is_active and id <> new.id
     ) then
    raise exception 'O sistema ficaria sem nenhum administrador ativo' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- Conceder privilegio e evento de seguranca e passa a ter trilha, como `assets`
-- e `alerts` ja tinham.
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

-- ─── X. profiles.role x app_metadata.role ───────────────────────────────────
-- `profiles.role` e a FONTE DA VERDADE da autorizacao (toda policy le de la);
-- `app_metadata.role` e a semente do provisionamento, lida so no INSERT de
-- auth.users. As duas ja divergiam em silencio: mudar uma nao mexia na outra.
-- Sem laco: `on_auth_user_updated` so escreve em profiles quando o e-mail muda.
create or replace function public.sync_profile_role_to_auth()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op = 'UPDATE'
     and new.role = old.role
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', new.role::text, 'active', new.is_active)
   where id = new.id;
  return new;
end $$;

drop trigger if exists profiles_sync_role_to_auth on public.profiles;
create trigger profiles_sync_role_to_auth
  after insert or update on public.profiles
  for each row execute function public.sync_profile_role_to_auth();

-- ─── Y. View da tela de administracao ───────────────────────────────────────
-- Sem `security_invoker`: roda como o dono para poder ler `auth.users`. O
-- filtro de autorizacao vai no WHERE, e nao ha RLS em view.
create or replace view public.v_admin_users as
select p.id, p.email, p.full_name, p.role, p.is_active,
       p.job_title, p.department, p.plant_id,
       p.last_login_at, p.created_at,
       (u.raw_app_meta_data ->> 'role') as provisioned_role,
       (u.raw_app_meta_data ->> 'role') is distinct from p.role::text as role_out_of_sync,
       u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
 where public.is_admin();

revoke all on public.v_admin_users from public, anon;
grant select on public.v_admin_users to authenticated;

-- ─── Z. Higiene ─────────────────────────────────────────────────────────────
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

notify pgrst, 'reload schema';
