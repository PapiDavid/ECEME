-- ============================================================
--  ECEME - Esquema de base de datos (MySQL)
--  Proyecto de grado: Sistema Web con Tecnología Blockchain
--  Ejecutar una sola vez para crear la BD y datos de prueba:
--    mysql -u root -p < apps/server/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS eceme_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eceme_db;

-- Orden de borrado respetando llaves foráneas (para re-ejecutar limpio)
DROP TABLE IF EXISTS bloques;
DROP TABLE IF EXISTS evaluaciones_docentes;
DROP TABLE IF EXISTS notas;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS criterios_evaluacion;
DROP TABLE IF EXISTS docente_materias;
DROP TABLE IF EXISTS estudiantes;
DROP TABLE IF EXISTS docentes;
DROP TABLE IF EXISTS materias;
DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS usuarios;

-- ------------------------------------------------------------
-- USUARIOS (autenticación). identificador = correo (admin) o código (docente/cursante)
-- OJO: hoy la contraseña se guarda en TEXTO PLANO. Pendiente: hashear con bcrypt.
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  identificador VARCHAR(150) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  rol           ENUM('admin','profe','alumno') NOT NULL,
  primer_login  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MATERIAS. activa = 1 marca la materia que se está cursando ese momento (1 por semana)
-- ------------------------------------------------------------
CREATE TABLE materias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  ciclo  ENUM('PRIMER CICLO','SEGUNDO CICLO') NOT NULL DEFAULT 'PRIMER CICLO'
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ESTUDIANTES (cursantes)
-- ------------------------------------------------------------
CREATE TABLE estudiantes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nombre     VARCHAR(150) NOT NULL,
  codigo     VARCHAR(50)  NOT NULL,
  ci         VARCHAR(20),
  grado      VARCHAR(80),
  ciclo      ENUM('PRIMER CICLO','SEGUNDO CICLO') NOT NULL,
  materia_id INT NULL,
  docente_id INT NULL,
  CONSTRAINT fk_est_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_est_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DOCENTES
-- ------------------------------------------------------------
CREATE TABLE docentes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nombre     VARCHAR(150) NOT NULL,
  codigo     VARCHAR(50)  NOT NULL,
  ci         VARCHAR(20),
  grado      VARCHAR(80),
  materia_id INT NULL,
  CONSTRAINT fk_doc_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- DOCENTE_MATERIAS. Un docente puede dictar VARIAS materias (relación N a N).
-- ------------------------------------------------------------
CREATE TABLE docente_materias (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  docente_id INT NOT NULL,
  materia_id INT NOT NULL,
  UNIQUE KEY uq_doc_mat (docente_id, materia_id),
  CONSTRAINT fk_dm_docente FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE CASCADE,
  CONSTRAINT fk_dm_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Un cursante pertenece a UN docente concreto (su "sección" de la materia)
ALTER TABLE estudiantes
  ADD CONSTRAINT fk_est_docente FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- NOTAS. nota_final se CALCULA automáticamente: Parcial 30% + Final 60% + Trabajos 10%
-- UNIQUE(estudiante_id, materia_id) permite el guardado parcial con ON DUPLICATE KEY UPDATE.
-- ------------------------------------------------------------
CREATE TABLE notas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  docente_id    INT NOT NULL,
  materia_id    INT NOT NULL,
  parcial_1     DECIMAL(5,2) NOT NULL DEFAULT 0,
  parcial_final DECIMAL(5,2) NOT NULL DEFAULT 0,
  trabajos      DECIMAL(5,2) NOT NULL DEFAULT 0,
  nota_final    DECIMAL(5,2) AS (parcial_1 * 0.30 + parcial_final * 0.60 + trabajos * 0.10) STORED,
  publicado     TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_est_materia (estudiante_id, materia_id),
  CONSTRAINT fk_nota_est     FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_nota_doc     FOREIGN KEY (docente_id)    REFERENCES docentes(id)    ON DELETE CASCADE,
  CONSTRAINT fk_nota_materia FOREIGN KEY (materia_id)    REFERENCES materias(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CRITERIOS DE EVALUACIÓN DOCENTE (preguntas que califican los cursantes 1-5)
-- ------------------------------------------------------------
CREATE TABLE criterios_evaluacion (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  pregunta VARCHAR(255) NOT NULL,
  orden    INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- EVALUACIONES DOCENTES (respuestas de los cursantes, escala 1-5)
-- ------------------------------------------------------------
CREATE TABLE evaluaciones_docentes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  estudiante_id INT NOT NULL,
  docente_id    INT NOT NULL,
  materia_id    INT NOT NULL,
  criterio_id   INT NOT NULL,
  puntuacion    TINYINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  CONSTRAINT fk_eval_est      FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_doc      FOREIGN KEY (docente_id)    REFERENCES docentes(id)    ON DELETE CASCADE,
  CONSTRAINT fk_eval_materia  FOREIGN KEY (materia_id)    REFERENCES materias(id)    ON DELETE CASCADE,
  CONSTRAINT fk_eval_criterio FOREIGN KEY (criterio_id)   REFERENCES criterios_evaluacion(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CONFIGURACIÓN (nombre del comandante actual, gestión). Fila única id=1.
-- ------------------------------------------------------------
CREATE TABLE configuracion (
  id               INT PRIMARY KEY,
  comandante_nombre VARCHAR(150) NOT NULL DEFAULT 'POR ASIGNAR',
  gestion          VARCHAR(20)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- NOTES (bitácora personal de cada usuario)
-- ------------------------------------------------------------
CREATE TABLE notes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  titulo      VARCHAR(150) NOT NULL,
  descripcion TEXT,
  fecha       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- BLOQUES (cadena blockchain de actas publicadas) — base para la capa de inmutabilidad.
-- Cada bloque encadena al anterior por hash SHA-256. Aún sin lógica en el backend.
-- ------------------------------------------------------------
CREATE TABLE bloques (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  indice      INT NOT NULL,
  materia_id  INT NULL,
  ciclo       ENUM('PRIMER CICLO','SEGUNDO CICLO') NULL,
  acta_json   JSON NOT NULL,
  hash_previo VARCHAR(64) NOT NULL,
  hash        VARCHAR(64) NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Vista de auditoría: muestra las notas selladas dentro de cada bloque como
-- una tabla normal (para la demostración de inmutabilidad).
--   SELECT * FROM v_actas_notas;
-- 'pos' es la posición del registro dentro del bloque (0, 1, 2, ...) y sirve
-- para el UPDATE de la demo: JSON_REPLACE(acta_json, '$.registros[pos].campo', ...)
CREATE OR REPLACE VIEW v_actas_notas AS
SELECT b.indice AS bloque,
       r.registro - 1 AS pos,
       JSON_UNQUOTE(JSON_EXTRACT(b.acta_json, '$.materia')) AS materia,
       r.codigo, r.estudiante,
       r.parcial_1 AS parcial,
       r.parcial_final AS examen_final,
       r.trabajos,
       r.nota_final
FROM bloques b,
     JSON_TABLE(b.acta_json, '$.registros[*]'
       COLUMNS (registro FOR ORDINALITY,
                codigo        VARCHAR(20)  PATH '$.codigo',
                estudiante    VARCHAR(150) PATH '$.estudiante',
                parcial_1     VARCHAR(10)  PATH '$.parcial_1',
                parcial_final VARCHAR(10)  PATH '$.parcial_final',
                trabajos      VARCHAR(10)  PATH '$.trabajos',
                nota_final    VARCHAR(10)  PATH '$.nota_final')) r;

-- ------------------------------------------------------------
-- AUDITORÍA (logs) — rastreo de actividad de los usuarios.
-- usuario_id SIN clave foránea a propósito: el log debe sobrevivir
-- aunque el usuario se elimine (por eso también se copia su nombre).
-- En una BD ya existente NO reejecutar este schema (hace DROP de todo);
-- usar apps/server/auditoria.sql, que solo crea esta tabla.
-- ------------------------------------------------------------
CREATE TABLE auditoria (
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

-- ============================================================
--  DATOS DE PRUEBA (contraseñas en texto plano por ahora)
-- ============================================================

-- Configuración inicial
INSERT INTO configuracion (id, comandante_nombre, gestion) VALUES (1, 'POR ASIGNAR', '2026');

-- Usuarios: admin entra con correo; docente/cursante con su código. Clave genérica: 123456
INSERT INTO usuarios (identificador, password, rol, primer_login) VALUES
  ('admin@eceme.mil.bo', 'admin123', 'admin', 0),
  ('DOC-001', '123456', 'profe',  1),
  ('CUR-001', '123456', 'alumno', 1),
  ('CUR-002', '123456', 'alumno', 1);

-- Materias (activa=1 la que se cursa ahora). Cada una pertenece a un ciclo.
INSERT INTO materias (nombre, activa, ciclo) VALUES
  ('Táctica y Operaciones', 1, 'PRIMER CICLO'),
  ('Logística Militar', 0, 'PRIMER CICLO'),
  ('Derecho Internacional Humanitario', 0, 'SEGUNDO CICLO');

-- Docente (usuario_id 2 = DOC-001), asignado a la materia activa
INSERT INTO docentes (usuario_id, nombre, codigo, ci, grado, materia_id) VALUES
  (2, 'CNL. JUAN PÉREZ', 'DOC-001', '1234567', 'CORONEL', 1);

-- Relación docente-materias (copiamos la materia principal de cada docente)
INSERT INTO docente_materias (docente_id, materia_id)
SELECT id, materia_id FROM docentes WHERE materia_id IS NOT NULL;

-- Cursantes (usuario_id 3 y 4), asignados al docente 1 en la materia 1
INSERT INTO estudiantes (usuario_id, nombre, codigo, ci, grado, ciclo, materia_id, docente_id) VALUES
  (3, 'MY. ANA GÓMEZ',   'CUR-001', '7654321', 'MAYOR',   'PRIMER CICLO',  1, 1),
  (4, 'CAP. LUIS ROJAS', 'CUR-002', '9876543', 'CAPITÁN', 'SEGUNDO CICLO', 1, 1);

-- Criterios de evaluación docente
INSERT INTO criterios_evaluacion (pregunta, orden) VALUES
  ('¿El docente llega puntual a clases?', 1),
  ('¿Domina el contenido de la materia?', 2),
  ('¿Explica con claridad?', 3);

-- Notas de ejemplo (nota_final se calcula sola). Una publicada, una en edición.
INSERT INTO notas (estudiante_id, docente_id, materia_id, parcial_1, parcial_final, trabajos, publicado) VALUES
  (1, 1, 1, 80, 90, 100, 1),
  (2, 1, 1, 70, 0,  0,   0);
