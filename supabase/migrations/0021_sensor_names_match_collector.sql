-- =============================================================================
-- 0021 — Os sensores passam a se chamar como o instrumento os chama
--
-- O `collector_field_map` da 0014 nomeia os três campos que chegam do túnel do
-- Forzy Lab: `Velocidade`, `Aceleração`, `Temperatura`. Dois deles já batiam; o
-- primeiro aparecia na tela como "Velocidade de Vibração".
--
-- O nome longo existia por um motivo que deixou de valer: até a 0020, EXA-001
-- tinha um sensor chamado 'Velocidade' que era ROTAÇÃO em % — grandeza
-- diferente, e confundir as duas quebra o modelo de anomalia. Aquele sensor foi
-- desativado junto com o resto da instrumentação sem transdutor, então o nome
-- curto ficou livre e a ambiguidade não existe mais na planta.
--
-- Alinhar o nome exibido ao nome do campo de origem tira uma tradução silenciosa
-- entre o que o sensor manda e o que o operador lê. Quem for conferir a
-- telemetria bruta contra a tela encontra a mesma palavra dos dois lados.
--
-- A unidade continua na tela (mm/s) e é ela que desfaz qualquer dúvida sobre
-- que velocidade é essa.
-- =============================================================================

update public.sensors
set name = 'Velocidade'
where name = 'Velocidade de Vibração';

-- Guarda de futuro: com o nome curto em uso, um sensor de rotação chamado
-- 'Velocidade' voltaria a criar a ambiguidade que a 0020 desfez. Rotação é
-- `sensor_type = 'speed'`; vibração é `'vibration'`.
create or replace function public.guard_velocity_name()
returns trigger
language plpgsql
as $$
begin
  if new.name = 'Velocidade' and new.sensor_type <> 'vibration' then
    raise exception
      'O nome "Velocidade" é reservado à velocidade de vibração (sensor_type = vibration). '
      'Para rotação, use um nome explícito como "Rotação".'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_velocity_name on public.sensors;
create trigger guard_velocity_name
  before insert or update of name, sensor_type on public.sensors
  for each row execute function public.guard_velocity_name();

comment on function public.guard_velocity_name() is
  'Impede que "Velocidade" volte a nomear rotação, o que reintroduziria a ambiguidade desfeita na 0020.';

-- -----------------------------------------------------------------------------
-- Mesma ordem em todo ativo
--
-- Com o trio idêntico em toda a planta, a ordem de exibição vinha do cadastro
-- de cada sensor e variava: LAB-S2 abria pela temperatura, os demais pela
-- velocidade. Quem clica de ativo em ativo comparando leituras precisa que a
-- terceira linha seja sempre a mesma grandeza — senão a comparação exige ler o
-- rótulo a cada troca.
-- -----------------------------------------------------------------------------
update public.sensors
set display_order = case name
  when 'Velocidade'  then 1
  when 'Aceleração'  then 2
  when 'Temperatura' then 3
  else display_order
end
where name in ('Velocidade', 'Aceleração', 'Temperatura');
