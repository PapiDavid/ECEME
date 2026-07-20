-- ============================================================
--  INTEGRIDAD DE LA AUDITORÍA — correr UNA sola vez sobre la BD existente:
--    mysql -u root -p eceme_db < sellar-auditoria.sql
--  Agrega las columnas del encadenamiento SHA-256 a la bitácora.
--  Después correr la migración:  npm run sellar:log  (en apps/server)
--  (NO reejecutar schema.sql: hace DROP de todo.)
-- ============================================================
USE eceme_db;

ALTER TABLE auditoria
  ADD COLUMN hash        VARCHAR(64) NULL AFTER fecha,
  ADD COLUMN hash_previo VARCHAR(64) NULL AFTER hash;
