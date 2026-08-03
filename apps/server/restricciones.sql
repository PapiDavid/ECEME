-- ============================================================
--  RESTRICCIONES DE INTEGRIDAD (para la BD que YA existe)
-- ------------------------------------------------------------
--  Las mismas restricciones están en schema.sql para instalaciones
--  nuevas. Este archivo las agrega a la base viva SIN borrar nada.
--  OJO: nunca reejecutar schema.sql sobre la BD real (hace DROP).
--
--  Uso (después de limpieza-pruebas.sql):
--    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p eceme_db < apps/server/restricciones.sql
--
--  Si alguna sentencia falla con "Duplicate entry", significa que
--  todavía quedan datos repetidos: hay que resolverlos primero.
-- ============================================================

-- El CI identifica a la persona: no puede repetirse
ALTER TABLE estudiantes ADD CONSTRAINT uq_est_ci UNIQUE (ci);
ALTER TABLE docentes    ADD CONSTRAINT uq_doc_ci UNIQUE (ci);

-- No pueden existir dos materias con el mismo nombre en el mismo ciclo
ALTER TABLE materias ADD CONSTRAINT uq_materia_ciclo UNIQUE (nombre, ciclo);

-- Comprobación: deben aparecer uq_est_ci, uq_doc_ci y uq_materia_ciclo
SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME IN ('uq_est_ci', 'uq_doc_ci', 'uq_materia_ciclo')
GROUP BY TABLE_NAME, INDEX_NAME;
