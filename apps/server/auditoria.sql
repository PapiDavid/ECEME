-- ============================================================
--  MÓDULO DE AUDITORÍA — correr UNA sola vez sobre la BD existente:
--    mysql -u root -p eceme_db < auditoria.sql
--  (NO reejecutar schema.sql: ese archivo hace DROP de todo y
--   borraría la cadena de bloques y los datos reales.)
-- ============================================================
USE eceme_db;

-- Registro de actividad de los usuarios del sistema.
-- usuario_id SIN clave foránea a propósito: el log debe sobrevivir
-- aunque el usuario se elimine (por eso también se copia su nombre).
CREATE TABLE IF NOT EXISTS auditoria (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT NULL,
  usuario_nombre VARCHAR(150) NOT NULL,
  rol            VARCHAR(20) NULL,
  accion         VARCHAR(40) NOT NULL,   -- código corto: INICIO_SESION, PUBLICAR_ACTA, CREAR_CURSANTE...
  detalle        VARCHAR(500) NULL,      -- descripción legible del evento
  ip             VARCHAR(45) NULL,       -- IPv4 o IPv6 del equipo cliente
  dispositivo    VARCHAR(100) NULL,      -- navegador y sistema operativo, ej. "Chrome en Windows 10/11"
  fecha          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hash           VARCHAR(64) NULL,       -- SHA-256 del registro (datos + hash_previo)
  hash_previo    VARCHAR(64) NULL        -- hash del registro anterior ("0" en el génesis)
) ENGINE=InnoDB;
