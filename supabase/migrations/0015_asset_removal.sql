-- =============================================================================
-- 0015 — Remoção de ativos pelo engenheiro
--
-- A política de 0009 restringia o DELETE de `assets` a is_admin(), enquanto
-- INSERT e UPDATE já aceitavam has_role('admin','engineer'). O engenheiro
-- podia criar um ativo (inclusive pelo wizard de OCR) e depois não conseguia
-- desfazer o próprio cadastro — um admin tinha de ser acionado para limpar
-- ativo de teste. O DELETE passa a acompanhar o INSERT.
--
-- O caminho normal de remoção na aplicação continua sendo `is_active = false`
-- (as views filtram por ela): reversível e sem destruir histórico. O DELETE só
-- é oferecido na interface para ativo sem sensores, leituras, alertas ou
-- ordens de manutenção — porque as 11 FKs que apontam para `assets` usam
-- ON DELETE CASCADE, e apagar um ativo instrumentado levaria junto a
-- telemetria, que o schema trata como histórico imutável.
-- =============================================================================

set search_path = public, extensions;

drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete to authenticated using (public.has_role('admin', 'engineer'));
