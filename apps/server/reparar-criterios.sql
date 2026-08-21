-- ============================================================
--  REPARACIÓN DEL TEXTO DE LOS CRITERIOS DE EVALUACIÓN
-- ------------------------------------------------------------
--  Las preguntas quedaron guardadas con la "¿" corrompida: se veía
--  "┬┐El docente llega puntual a clases?" en el portal del cursante
--  y en el PDF de desempeño docente.
--
--  CAUSA: schema.sql tiene el texto correcto, pero al importarlo
--  desde la consola de Windows el cliente de MySQL interpretó los
--  bytes UTF-8 de "¿" (C2 BF) como dos caracteres de la página de
--  códigos del sistema (┬ ┐) y los volvió a codificar.
--
--  PARA QUE NO VUELVA A PASAR: importar SIEMPRE con la codificación
--  explícita, tanto este archivo como schema.sql:
--    mysql --default-character-set=utf8mb4 -u root -p eceme_db < archivo.sql
-- ============================================================

-- Quita el prefijo corrupto de cualquier pregunta que lo tenga y le
-- devuelve la "¿". Es idempotente: si ya está bien, no hace nada.
UPDATE criterios_evaluacion
SET pregunta = CONCAT('¿', SUBSTRING(pregunta, 3))
WHERE LEFT(pregunta, 2) = '┬┐';

-- Comprobación: los primeros bytes deben ser C2BF (la "¿" correcta)
SELECT id, pregunta, HEX(LEFT(pregunta, 2)) AS primeros_bytes
FROM criterios_evaluacion ORDER BY orden, id;
