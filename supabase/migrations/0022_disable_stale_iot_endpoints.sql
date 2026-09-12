-- Remove do estado existente os quick tunnels efêmeros que já expiraram.
-- O operador configura a URL atual com `npm run collector -- url both <BASE>`;
-- esse comando também reabilita as fontes e o coletor.
update public.collector_sources
set url = 'https://example.invalid/get_' || code,
    is_enabled = false,
    notes = 'Configure a URL ativa fora do Git antes de habilitar a fonte.'
where code in ('s1', 's2')
  and url like '%.trycloudflare.com/%';

update public.collector_config
set is_enabled = false
where id = true
  and exists (
    select 1
    from public.collector_sources
    where code in ('s1', 's2')
      and is_enabled = false
  );
