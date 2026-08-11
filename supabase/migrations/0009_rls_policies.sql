-- =============================================================================
-- 0009 — Row Level Security e políticas por papel
--
-- Modelo de acesso:
--   admin      → controle total, inclusive papéis de usuários e configuração
--   engineer   → escreve ativos, sensores, modelos de ML e documentos
--   technician → opera alertas, manutenção e cadastro de equipamento
--   viewer     → somente leitura do acervo operacional
--   anon       → nenhum acesso
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Grants base — a RLS é quem realmente filtra as linhas
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                 on all sequences  in schema public to authenticated;
grant execute                       on all functions  in schema public to authenticated;
grant all                           on all tables     in schema public to service_role;
grant all                           on all sequences  in schema public to service_role;
grant all                           on all functions  in schema public to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- -----------------------------------------------------------------------------
-- Habilita RLS em todo o schema de aplicação
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'audit_logs', 'lgpd_consents',
    'plants', 'areas', 'assets', 'asset_nameplates', 'asset_health_snapshots',
    'sensors', 'sensor_readings',
    'alerts', 'maintenance_orders',
    'ml_models', 'ml_predictions', 'ml_training_runs',
    'documents', 'document_chunks', 'chat_conversations', 'chat_messages'
  ] loop
    -- Sem FORCE: o dono (postgres) precisa passar por cima da RLS para que os
    -- triggers SECURITY DEFINER (auditoria, alertas automáticos) funcionem.
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- A conta de serviço (ingestão IoT, jobs de ML) não é filtrada.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'audit_logs', 'lgpd_consents',
    'plants', 'areas', 'assets', 'asset_nameplates', 'asset_health_snapshots',
    'sensors', 'sensor_readings',
    'alerts', 'maintenance_orders',
    'ml_models', 'ml_predictions', 'ml_training_runs',
    'documents', 'document_chunks', 'chat_conversations', 'chat_messages'
  ] loop
    execute format('drop policy if exists service_role_all on public.%I', t);
    execute format(
      'create policy service_role_all on public.%I as permissive for all to service_role using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- profiles
-- =============================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_read());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- Escalada de privilégio é bloqueada no dado, não só na policy.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem sessão autenticada (service_role, migrações, jobs) o acesso já é
  -- privilegiado por outro meio — a guarda vale para usuários finais.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Apenas administradores podem alterar o papel de um usuário';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Apenas administradores podem ativar ou desativar usuários';
    end if;
    if new.plant_id is distinct from old.plant_id then
      raise exception 'Apenas administradores podem mover um usuário de planta';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- =============================================================================
-- user_settings — estritamente pessoal
-- =============================================================================
drop policy if exists user_settings_own on public.user_settings;
create policy user_settings_own on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- audit_logs — leitura restrita; escrita só por triggers SECURITY DEFINER
-- =============================================================================
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin() or actor_id = auth.uid());

-- =============================================================================
-- lgpd_consents
-- =============================================================================
drop policy if exists lgpd_own on public.lgpd_consents;
create policy lgpd_own on public.lgpd_consents
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- =============================================================================
-- Catálogo da planta — leitura ampla, escrita administrativa
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['plants', 'areas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read())',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_write', t
    );
  end loop;
end $$;

-- =============================================================================
-- assets
-- =============================================================================
drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select to authenticated using (public.can_read());

drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert to authenticated with check (public.has_role('admin', 'engineer'));

drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update to authenticated
  using (public.has_role('admin', 'engineer'))
  with check (public.has_role('admin', 'engineer'));

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete to authenticated using (public.is_admin());

-- =============================================================================
-- asset_nameplates — o técnico cadastra equipamento pela foto da placa
-- =============================================================================
drop policy if exists nameplates_select on public.asset_nameplates;
create policy nameplates_select on public.asset_nameplates
  for select to authenticated using (public.can_read());

drop policy if exists nameplates_insert on public.asset_nameplates;
create policy nameplates_insert on public.asset_nameplates
  for insert to authenticated with check (public.can_write());

drop policy if exists nameplates_update on public.asset_nameplates;
create policy nameplates_update on public.asset_nameplates
  for update to authenticated
  using (public.can_write())
  with check (public.can_write());

drop policy if exists nameplates_delete on public.asset_nameplates;
create policy nameplates_delete on public.asset_nameplates
  for delete to authenticated using (public.has_role('admin', 'engineer'));

-- =============================================================================
-- Telemetria
-- =============================================================================
drop policy if exists health_select on public.asset_health_snapshots;
create policy health_select on public.asset_health_snapshots
  for select to authenticated using (public.can_read());

drop policy if exists sensors_select on public.sensors;
create policy sensors_select on public.sensors
  for select to authenticated using (public.can_read());

drop policy if exists sensors_write on public.sensors;
create policy sensors_write on public.sensors
  for all to authenticated
  using (public.has_role('admin', 'engineer'))
  with check (public.has_role('admin', 'engineer'));

drop policy if exists readings_select on public.sensor_readings;
create policy readings_select on public.sensor_readings
  for select to authenticated using (public.can_read());

drop policy if exists readings_insert on public.sensor_readings;
create policy readings_insert on public.sensor_readings
  for insert to authenticated with check (public.has_role('admin', 'engineer'));

-- Histórico é imutável: sem UPDATE/DELETE para usuários autenticados.

-- =============================================================================
-- alerts — qualquer operador pode reconhecer e resolver
-- =============================================================================
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select to authenticated using (public.can_read());

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
  for insert to authenticated with check (public.can_write());

drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts
  for update to authenticated
  using (public.can_write())
  with check (public.can_write());

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts
  for delete to authenticated using (public.is_admin());

-- =============================================================================
-- maintenance_orders
-- =============================================================================
drop policy if exists maintenance_select on public.maintenance_orders;
create policy maintenance_select on public.maintenance_orders
  for select to authenticated using (public.can_read());

drop policy if exists maintenance_insert on public.maintenance_orders;
create policy maintenance_insert on public.maintenance_orders
  for insert to authenticated with check (public.can_write());

drop policy if exists maintenance_update on public.maintenance_orders;
create policy maintenance_update on public.maintenance_orders
  for update to authenticated
  using (public.can_write())
  with check (public.can_write());

drop policy if exists maintenance_delete on public.maintenance_orders;
create policy maintenance_delete on public.maintenance_orders
  for delete to authenticated using (public.has_role('admin', 'engineer'));

-- =============================================================================
-- Machine Learning
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['ml_models', 'ml_predictions', 'ml_training_runs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read())',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(''admin'', ''engineer'')) with check (public.has_role(''admin'', ''engineer''))',
      t || '_write', t
    );
  end loop;
end $$;

-- =============================================================================
-- Base documental / RAG
-- =============================================================================
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated using (public.can_read());

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all to authenticated
  using (public.can_write())
  with check (public.can_write());

drop policy if exists chunks_select on public.document_chunks;
create policy chunks_select on public.document_chunks
  for select to authenticated using (public.can_read());

drop policy if exists chunks_write on public.document_chunks;
create policy chunks_write on public.document_chunks
  for all to authenticated
  using (public.has_role('admin', 'engineer'))
  with check (public.has_role('admin', 'engineer'));

-- =============================================================================
-- Conversas — visíveis apenas ao próprio autor
-- =============================================================================
drop policy if exists chat_conv_own on public.chat_conversations;
create policy chat_conv_own on public.chat_conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists chat_msg_own on public.chat_messages;
create policy chat_msg_own on public.chat_messages
  for all to authenticated
  using (exists (
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.chat_conversations c
    where c.id = chat_messages.conversation_id and c.user_id = auth.uid()
  ));

-- =============================================================================
-- Nenhum acesso anônimo ao acervo operacional
-- =============================================================================
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
