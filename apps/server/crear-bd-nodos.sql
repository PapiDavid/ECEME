-- ============================================================
--  BASES DE DATOS DE LOS NODOS AUDITORES
-- ------------------------------------------------------------
--  Cada auditor guarda su PROPIA copia de la cadena, en su propio esquema.
--  Los auditores NO tocan eceme_db: no conocen alumnos, notas ni usuarios.
--  Solo tienen la tabla `bloques`. Eso es lo que hace que la replicación
--  sea real y que una alteración en la copia del nodo 1 se pueda detectar
--  comparándola contra las copias de los auditores.
--
--  Uso:
--    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < apps/server/crear-bd-nodos.sql
--
--  Es repetible: usa IF NOT EXISTS, así que no borra copias existentes.
-- ============================================================

CREATE DATABASE IF NOT EXISTS eceme_nodo_2 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS eceme_nodo_3 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS eceme_nodo_2.bloques (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  indice      INT NOT NULL,
  materia_id  INT NULL,
  ciclo       ENUM('PRIMER CICLO','SEGUNDO CICLO') NULL,
  acta_json   JSON NOT NULL,
  hash_previo VARCHAR(64) NOT NULL,
  hash        VARCHAR(64) NOT NULL,
  firmas      JSON NULL COMMENT 'Firmas Ed25519 de los nodos que aprobaron el bloque',
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_nodo2_indice UNIQUE (indice)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eceme_nodo_3.bloques (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  indice      INT NOT NULL,
  materia_id  INT NULL,
  ciclo       ENUM('PRIMER CICLO','SEGUNDO CICLO') NULL,
  acta_json   JSON NOT NULL,
  hash_previo VARCHAR(64) NOT NULL,
  hash        VARCHAR(64) NOT NULL,
  firmas      JSON NULL COMMENT 'Firmas Ed25519 de los nodos que aprobaron el bloque',
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_nodo3_indice UNIQUE (indice)
) ENGINE=InnoDB;

SELECT SCHEMA_NAME AS base_creada FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME IN ('eceme_nodo_2','eceme_nodo_3');
