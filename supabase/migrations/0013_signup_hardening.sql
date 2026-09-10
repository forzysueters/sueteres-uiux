-- =============================================================================
-- 0013 — Fecha a escalada de privilégio no cadastro
--
-- A versão anterior de handle_new_user (migração 0002) lia o papel de
-- `raw_user_meta_data`, que é escrito pelo próprio cliente: bastava chamar
-- POST /auth/v1/signup com {"data":{"role":"admin"}} e a conta nascia
-- administradora. `raw_app_meta_data` só pode ser definido pela Auth Admin API
-- (chave secreta), então é ele quem passa a mandar.
--
-- Cadastro espontâneo agora nasce como visualizador INATIVO: can_read() e
-- has_role() exigem is_active, então a conta não enxerga nada até um
-- administrador liberar.
-- =============================================================================

set search_path = public, extensions;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role      public.user_role;
  v_is_active boolean;
  v_meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app_meta  jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  -- Somente app_metadata é confiável: o cliente não consegue escrevê-lo.
  begin
    v_role := (v_app_meta ->> 'role')::public.user_role;
  exception when others then
    v_role := null;
  end;

  -- Sem papel provisionado = cadastro espontâneo: entra travado.
  v_is_active := v_role is not null;
  -- 'technician' e nao 'viewer': o papel foi eliminado na 0016 e o literal
  -- levantaria "invalid input value for enum" na proxima conta criada. A conta
  -- nasce INATIVA de qualquer forma (v_is_active acima), entao o papel so vale
  -- depois que um admin liberar.
  v_role := coalesce(v_role, 'technician');

  insert into public.profiles (id, email, full_name, role, is_active, job_title, department)
  values (
    new.id,
    new.email,
    coalesce(v_meta ->> 'full_name', v_meta ->> 'name', split_part(new.email, '@', 1)),
    v_role,
    v_is_active,
    v_meta ->> 'job_title',
    v_meta ->> 'department'
  )
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Impede que um papel seja concedido por fora do fluxo administrativo mesmo que
-- alguém consiga alterar app_metadata de uma conta já existente.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Limpa contas espontâneas que possam ter nascido com papel elevado antes desta
-- correção. As contas de demonstração são preservadas pelo e-mail conhecido.
-- -----------------------------------------------------------------------------
-- O papel de rebaixamento passou a ser 'technician' (a 0016 eliminou
-- 'viewer'). Sem esta troca, a REEXECUCAO desta migracao aborta com
-- "invalid input value for enum user_role" e nenhuma migracao seguinte roda.
-- O que protege a conta e `is_active = false`, nao o papel.
update public.profiles p
   set role = 'technician', is_active = false
  from auth.users u
 where u.id = p.id
   and coalesce(u.raw_app_meta_data ->> 'role', '') = ''
   and p.email not in (
     'admin@industrial.com',
     'engineer@industrial.com',
     'technician@industrial.com',
     'viewer@industrial.com'
   );
