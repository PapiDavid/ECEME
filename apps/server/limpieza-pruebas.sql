-- ============================================================
--  LIMPIEZA DE LOS REGISTROS DE PRUEBA (reporte del 2026-08-03)
-- ------------------------------------------------------------
--  Borra SOLO los registros basura que dejó la sesión de pruebas.
--  Se ejecuta UNA vez y ANTES de restricciones.sql, porque esos
--  registros son los que impiden crear el índice UNIQUE del CI.
--
--  Uso:
--    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p eceme_db < apps/server/limpieza-pruebas.sql
--
--  Se conserva a propósito CUR-020 (TTE. MARIA FERNANDA QUISPE
--  ALVARADO): es un registro válido.
-- ============================================================

-- Docentes de prueba. Se borra el USUARIO: la fila de `docentes`
-- cae sola por la FK ON DELETE CASCADE.
DELETE FROM usuarios
WHERE id IN (
  SELECT usuario_id FROM docentes
  WHERE codigo IN ('DOC-012', 'DOC-013', 'DOC-014', 'DOC-015', 'DOC-016')
);

-- Cursante de prueba con nombre inválido y CI duplicado ("99999 !!!@#$%")
DELETE FROM usuarios
WHERE id IN (
  SELECT usuario_id FROM estudiantes WHERE codigo IN ('CUR-021')
);

-- Materias basura: las dos filas llamadas "12345"
DELETE FROM materias WHERE nombre = '12345';

-- Comprobación: las tres consultas deben salir vacías o en 0
SELECT 'DOCENTES DE PRUEBA RESTANTES' AS control, COUNT(*) AS total
  FROM docentes WHERE codigo IN ('DOC-012','DOC-013','DOC-014','DOC-015','DOC-016');
SELECT 'MATERIAS 12345 RESTANTES' AS control, COUNT(*) AS total
  FROM materias WHERE nombre = '12345';
SELECT 'CI DUPLICADOS RESTANTES' AS control, ci, COUNT(*) AS veces FROM (
  SELECT ci FROM estudiantes WHERE ci IS NOT NULL AND ci <> ''
  UNION ALL
  SELECT ci FROM docentes    WHERE ci IS NOT NULL AND ci <> ''
) t GROUP BY ci HAVING COUNT(*) > 1;
