-- ============================================================
--  MIGRACIÓN: firmas de consenso en la tabla `bloques`
-- ------------------------------------------------------------
--  Agrega la columna donde cada bloque guarda las firmas Ed25519 de los
--  nodos que lo aprobaron. Se aplica sobre la BD VIVA sin borrar nada.
--  OJO: nunca reejecutar schema.sql sobre la base real (hace DROP de todo).
--
--  Uso:
--    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p eceme_db < apps/server/red-firmas.sql
--
--  IMPORTANTE: las firmas NO entran en el cálculo del hash del bloque.
--  El hash se sigue calculando con la fórmula original, así la cadena que
--  ya existía sigue verificando igual. Las firmas se guardan al lado.
--  Los bloques anteriores a la red quedan con firmas = NULL: son bloques
--  HEREDADOS, sellados cuando todavía no había consenso.
-- ============================================================

ALTER TABLE bloques ADD COLUMN firmas JSON NULL COMMENT 'Firmas Ed25519 de los nodos que aprobaron el bloque';

-- Comprobación
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloques' AND COLUMN_NAME = 'firmas';
