-- =============================================================================
-- 0017 — Administrador não fabrica administrador
--
-- Regra de negócio: a conta de administrador que existe hoje é a única, e
-- conceder esse papel deixa de ser uma ação da aplicação. Se um dia outro
-- administrador for necessário, quem provisiona é o time de desenvolvimento,
-- fora do produto — pelo script de provisionamento ou por SQL direto.
--
-- Por que no banco e não só na interface: `apiService.updateUserAccess` escreve
-- em `public.profiles` via PostgREST. Tirar o botão da tela de Usuários some
-- com o caminho fácil e não com o caminho: qualquer sessão de administrador
-- ainda poderia mandar `role = 'admin'` na requisição. Quem recusa de verdade é
-- este gatilho, que já é o dono das outras regras de privilégio.
--
-- A saída para o time continua aberta pela primeira linha de
-- `guard_profile_privileges`: quando `auth.uid()` é nulo — migração, seed, job
-- ou conexão com a service role — a função retorna antes de qualquer checagem.
-- É exatamente o caminho que `scripts/create-demo-users.mjs` usa.
--
-- Rebaixar um administrador segue permitido, e segue barrado pela regra que
-- impede o sistema de ficar sem nenhum administrador ativo.
-- =============================================================================

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

  -- NOVO em 0017: conceder o proprio papel esta fora do alcance da aplicacao.
  if new.role = 'admin' and old.role is distinct from 'admin' then
    raise exception 'Conceder o papel de administrador e feito fora da aplicacao' using errcode = '42501';
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

-- O gatilho ja aponta para esta funcao desde a 0016; `create or replace` acima
-- basta. Recriado aqui so para a migracao ser idempotente por si mesma.
drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
