-- =============================================================================
-- 0010 — Buckets de storage, políticas de arquivo e publicação realtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Buckets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('equipment-images', 'equipment-images', true,  10485760,
    array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('avatars',          'avatars',          true,   2097152,
    array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('floor-plans',      'floor-plans',      true,  20971520,
    array['image/svg+xml', 'image/png', 'application/pdf']),
  ('documents',        'documents',        false, 52428800,
    array['application/pdf', 'text/plain', 'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Políticas de objeto
-- -----------------------------------------------------------------------------

-- Leitura pública dos buckets públicos (imagens exibidas na UI).
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select to public
  using (bucket_id in ('equipment-images', 'avatars', 'floor-plans'));

-- Fotos de placa: qualquer operador envia; remoção restrita a admin/engenheiro.
drop policy if exists storage_equipment_write on storage.objects;
create policy storage_equipment_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'equipment-images' and public.can_write());

drop policy if exists storage_equipment_update on storage.objects;
create policy storage_equipment_update on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment-images' and public.can_write())
  with check (bucket_id = 'equipment-images' and public.can_write());

drop policy if exists storage_equipment_delete on storage.objects;
create policy storage_equipment_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment-images' and public.has_role('admin', 'engineer'));

-- Avatar: cada usuário administra apenas a própria pasta (<uid>/arquivo).
drop policy if exists storage_avatar_own on storage.objects;
create policy storage_avatar_own on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Planta baixa: escrita administrativa.
drop policy if exists storage_floorplan_write on storage.objects;
create policy storage_floorplan_write on storage.objects
  for all to authenticated
  using (bucket_id = 'floor-plans' and public.has_role('admin', 'engineer'))
  with check (bucket_id = 'floor-plans' and public.has_role('admin', 'engineer'));

-- Documentos técnicos: bucket privado, leitura para usuários ativos.
drop policy if exists storage_documents_read on storage.objects;
create policy storage_documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.can_read());

drop policy if exists storage_documents_write on storage.objects;
create policy storage_documents_write on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.can_write())
  with check (bucket_id = 'documents' and public.can_write());

-- -----------------------------------------------------------------------------
-- Realtime — o supervisório reflete mudanças sem polling
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assets', 'alerts', 'sensor_readings', 'maintenance_orders'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;   -- publicação ausente em ambiente local
    end;
  end loop;
end $$;

-- REPLICA IDENTITY FULL entrega o registro anterior nos eventos de update.
alter table public.assets            replica identity full;
alter table public.alerts            replica identity full;
alter table public.maintenance_orders replica identity full;
