const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { GENESIS_PREV, calcularHash } = require('./blockchain');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
// Sirve la página visual del blockchain en http://localhost:3001/blockchain.html
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eceme_db'
});

const MAX_DOCENTES_POR_MATERIA = 3;

// Seguridad de contraseñas: bcrypt con 10 rondas de salt.
const SALT_ROUNDS = 10;
// Clave institucional que asigna el admin al restablecer credenciales.
const PASSWORD_GENERICA = 'ECEME2026';

// Quita el campo password antes de devolver un usuario al frontend.
function usuarioSinPassword(u) {
  const { password, ...resto } = u;
  return resto;
}

// Devuelve (en el callback) las materias que ya llegaron al tope de docentes.
// excludeDocenteId permite ignorar al propio docente al editar.
function materiasSinCupo(materiaIds, excludeDocenteId, cb) {
  if (!materiaIds || materiaIds.length === 0) return cb(null, []);
  const placeholders = materiaIds.map(() => '?').join(',');
  const params = [...materiaIds];
  let sql = `SELECT materia_id, COUNT(*) AS c FROM docente_materias WHERE materia_id IN (${placeholders})`;
  if (excludeDocenteId) { sql += ` AND docente_id != ?`; params.push(excludeDocenteId); }
  sql += ` GROUP BY materia_id`;
  db.query(sql, params, (err, rows) => {
    if (err) return cb(err);
    cb(null, rows.filter(r => r.c >= MAX_DOCENTES_POR_MATERIA).map(r => r.materia_id));
  });
}

// --- 1. AUTENTICACIÓN ---
// Se busca SOLO por identificador y la clave se valida con bcrypt.
// El mensaje de error es genérico a propósito: no revela si el usuario existe.
app.post('/api/login', (req, res) => {
  const { identificador, password } = req.body;
  const sql = "SELECT * FROM usuarios WHERE identificador = ?";
  db.query(sql, [identificador], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length === 0 || !bcrypt.compareSync(password || '', result[0].password)) {
      return res.status(401).json({ message: "Usuario no encontrado o clave incorrecta" });
    }
    res.json({ user: usuarioSinPassword(result[0]), token: 'sesion-activa-eceme' });
  });
});

app.post('/api/usuarios/cambiar-password', (req, res) => {
  const { usuario_id, nueva_password } = req.body;
  const hash = bcrypt.hashSync(nueva_password, SALT_ROUNDS);
  const sql = "UPDATE usuarios SET password = ?, primer_login = 0 WHERE id = ?";
  db.query(sql, [hash, usuario_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Contraseña actualizada correctamente" });
  });
});

// Recuperación de credenciales: el ADMIN restablece la clave de un usuario a la
// genérica institucional y lo obliga a cambiarla en su próximo ingreso.
app.post('/api/admin/usuarios/:usuarioId/reset-password', (req, res) => {
  const hash = bcrypt.hashSync(PASSWORD_GENERICA, SALT_ROUNDS);
  const sql = "UPDATE usuarios SET password = ?, primer_login = 1 WHERE id = ?";
  db.query(sql, [hash, req.params.usuarioId], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Contraseña restablecida", password_temporal: PASSWORD_GENERICA });
  });
});

// --- 2. RUTAS GET GENERALES ---
app.get('/api/materias', (req, res) => {
  db.query("SELECT * FROM materias ORDER BY nombre", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/criterios', (req, res) => {
  db.query("SELECT * FROM criterios_evaluacion ORDER BY orden", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/configuracion', (req, res) => {
  db.query("SELECT * FROM configuracion LIMIT 1", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0] || { comandante_nombre: 'POR ASIGNAR' });
  });
});

app.get('/api/notas/consolidado', (req, res) => {
  const sql = `
    SELECT n.id, e.nombre AS nombre_estudiante, m.nombre AS nombre_materia, e.ciclo, n.nota_final 
    FROM notas n
    JOIN estudiantes e ON n.estudiante_id = e.id
    JOIN materias m ON n.materia_id = m.id
    ORDER BY n.nota_final DESC`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/docentes/evaluaciones', (req, res) => {
  const sql = `
    SELECT d.nombre, IFNULL(AVG(ed.puntuacion), 0) as avg 
    FROM docentes d
    LEFT JOIN evaluaciones_docentes ed ON d.id = ed.docente_id
    GROUP BY d.id`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// --- 3. GESTIÓN DE PERSONAL (ADMINISTRADOR) ---

// --- ESTUDIANTES ---
app.get('/api/admin/estudiantes', (req, res) => {
  db.query("SELECT * FROM estudiantes ORDER BY nombre", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Registro Estudiante con materia_id integrado (código CUR-XXX generado automáticamente)
app.post('/api/admin/estudiantes', (req, res) => {
  const { nombre, ci, grado, ciclo, password, materia_id, docente_id } = req.body;
  const nombreU = (nombre || '').trim().toUpperCase();
  const gradoU = (grado || '').trim().toUpperCase();
  // Calculamos el siguiente correlativo en SQL (robusto a mayúsculas/formato)
  db.query("SELECT IFNULL(MAX(CAST(SUBSTRING(codigo, 5) AS UNSIGNED)), 0) + 1 AS siguiente FROM estudiantes WHERE codigo LIKE 'CUR-%'", (errC, rowsC) => {
    if (errC) return res.status(500).json(errC);
    const codigo = 'CUR-' + String(rowsC[0].siguiente).padStart(3, '0');

    db.query("INSERT INTO usuarios (identificador, password, rol, primer_login) VALUES (?, ?, 'alumno', 1)", [codigo, bcrypt.hashSync(password, SALT_ROUNDS)], (err, userRes) => {
      if (err) return res.status(500).json(err);

      const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;
      const did = docente_id && docente_id !== '' ? parseInt(docente_id) : null;
      db.query("INSERT INTO estudiantes (usuario_id, nombre, codigo, ci, grado, ciclo, materia_id, docente_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userRes.insertId, nombreU, codigo, ci || null, gradoU, ciclo, mid, did], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: "Cursante registrado", codigo });
      });
    });
  });
});

// Actualizar estudiante (Incluyendo materia_id)
app.put('/api/admin/estudiantes/:id', (req, res) => {
  const { nombre, grado, ciclo, materia_id, docente_id } = req.body;
  const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;
  const did = docente_id && docente_id !== '' ? parseInt(docente_id) : null;
  const nombreU = (nombre || '').trim().toUpperCase();
  const gradoU = (grado || '').trim().toUpperCase();

  const sql = "UPDATE estudiantes SET nombre = ?, grado = ?, ciclo = ?, materia_id = ?, docente_id = ? WHERE id = ?";
  db.query(sql, [nombreU, gradoU, ciclo, mid, did, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Estudiante actualizado correctamente" });
  });
});

app.delete('/api/admin/estudiantes/:id', (req, res) => {
  db.query("SELECT usuario_id FROM estudiantes WHERE id = ?", [req.params.id], (err, result) => {
    if (result.length > 0) {
      db.query("DELETE FROM usuarios WHERE id = ?", [result[0].usuario_id], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: "Eliminado con éxito" });
      });
    }
  });
});

// --- DOCENTES ---
// Devuelve cada docente con sus materias (nombres para mostrar + ids para editar)
app.get('/api/admin/docentes', (req, res) => {
  const sql = `
    SELECT d.*,
      (SELECT GROUP_CONCAT(m.nombre ORDER BY m.nombre SEPARATOR ', ')
         FROM docente_materias dm JOIN materias m ON dm.materia_id = m.id
         WHERE dm.docente_id = d.id) AS materias_nombres,
      (SELECT GROUP_CONCAT(dm.materia_id)
         FROM docente_materias dm WHERE dm.docente_id = d.id) AS materia_ids
    FROM docentes d ORDER BY d.nombre`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Registro Docente con VARIAS materias (código DOC-XXX generado automáticamente)
app.post('/api/admin/docentes', (req, res) => {
  const { nombre, ci, grado, password } = req.body;
  // Acepta materia única (listbox) o varias (materia_ids)
  const materiaIds = ((req.body.materia_ids && req.body.materia_ids.length)
    ? req.body.materia_ids
    : (req.body.materia_id ? [req.body.materia_id] : [])).map(Number).filter(Boolean);
  const nombreU = (nombre || '').trim().toUpperCase();
  const gradoU = (grado || '').trim().toUpperCase();

  materiasSinCupo(materiaIds, null, (cupoErr, llenas) => {
    if (cupoErr) return res.status(500).json(cupoErr);
    if (llenas.length > 0) return res.status(400).json({ message: `Una materia ya tiene el máximo de ${MAX_DOCENTES_POR_MATERIA} docentes` });

    // Calculamos el siguiente correlativo en SQL (robusto a mayúsculas/formato)
    db.query("SELECT IFNULL(MAX(CAST(SUBSTRING(codigo, 5) AS UNSIGNED)), 0) + 1 AS siguiente FROM docentes WHERE codigo LIKE 'DOC-%'", (errC, rowsC) => {
      if (errC) return res.status(500).json(errC);
      const codigo = 'DOC-' + String(rowsC[0].siguiente).padStart(3, '0');

      db.query("INSERT INTO usuarios (identificador, password, rol, primer_login) VALUES (?, ?, 'profe', 1)", [codigo, bcrypt.hashSync(password, SALT_ROUNDS)], (err, userRes) => {
        if (err) return res.status(500).json(err);

        const primaryMateria = materiaIds.length > 0 ? materiaIds[0] : null;
        db.query("INSERT INTO docentes (usuario_id, nombre, codigo, ci, grado, materia_id) VALUES (?, ?, ?, ?, ?, ?)",
        [userRes.insertId, nombreU, codigo, ci || null, gradoU, primaryMateria], (err2, docRes) => {
          if (err2) return res.status(500).json(err2);
          if (materiaIds.length === 0) return res.json({ message: "Docente registrado", codigo });

          const values = materiaIds.map(mid => [docRes.insertId, mid]);
          db.query("INSERT INTO docente_materias (docente_id, materia_id) VALUES ?", [values], (err3) => {
            if (err3) return res.status(500).json(err3);
            res.json({ message: "Docente registrado", codigo });
          });
        });
      });
    });
  });
});

// Actualizar docente y sus materias (relación N a N)
app.put('/api/admin/docentes/:id', (req, res) => {
  const { nombre, grado } = req.body;
  const materiaIds = (req.body.materia_ids || []).map(Number).filter(Boolean);
  const nombreU = (nombre || '').trim().toUpperCase();
  const gradoU = (grado || '').trim().toUpperCase();
  const primaryMateria = materiaIds.length > 0 ? materiaIds[0] : null;
  const docenteId = req.params.id;

  materiasSinCupo(materiaIds, docenteId, (cupoErr, llenas) => {
    if (cupoErr) return res.status(500).json(cupoErr);
    if (llenas.length > 0) return res.status(400).json({ message: `Una materia ya tiene el máximo de ${MAX_DOCENTES_POR_MATERIA} docentes` });

    db.query("UPDATE docentes SET nombre = ?, grado = ?, materia_id = ? WHERE id = ?",
    [nombreU, gradoU, primaryMateria, docenteId], (err) => {
      if (err) return res.status(500).json(err);
      // Reemplazamos las materias del docente
      db.query("DELETE FROM docente_materias WHERE docente_id = ?", [docenteId], (delErr) => {
        if (delErr) return res.status(500).json(delErr);
        if (materiaIds.length === 0) return res.json({ message: "Docente actualizado correctamente" });
        const values = materiaIds.map(mid => [docenteId, mid]);
        db.query("INSERT INTO docente_materias (docente_id, materia_id) VALUES ?", [values], (insErr) => {
          if (insErr) return res.status(500).json(insErr);
          res.json({ message: "Docente actualizado correctamente" });
        });
      });
    });
  });
});

app.delete('/api/admin/docentes/:id', (req, res) => {
  db.query("SELECT usuario_id FROM docentes WHERE id = ?", [req.params.id], (err, result) => {
    if (result.length > 0) {
      db.query("DELETE FROM usuarios WHERE id = ?", [result[0].usuario_id], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({ message: "Eliminado con éxito" });
      });
    }
  });
});

// --- 4. CONFIGURACIÓN DE PARÁMETROS ACADÉMICOS ---
app.post('/api/admin/materias', (req, res) => {
  const { nombre, ciclo } = req.body;
  const nombreU = (nombre || '').trim().toUpperCase();
  db.query("INSERT INTO materias (nombre, activa, ciclo) VALUES (?, 1, ?)", [nombreU, ciclo || 'PRIMER CICLO'], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Materia creada" });
  });
});

// Eliminar materia (las notas/evaluaciones/relaciones asociadas se borran en cascada)
app.delete('/api/admin/materias/:id', (req, res) => {
  db.query("DELETE FROM materias WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Materia eliminada" });
  });
});

// Asignaciones materia->docente (cada docente que dicta cada materia). Para asignar cursantes.
app.get('/api/asignaciones', (req, res) => {
  const sql = `
    SELECT dm.id AS dm_id, dm.materia_id, dm.docente_id,
           m.nombre AS materia, m.ciclo,
           CONCAT_WS(' ', d.grado, d.nombre) AS docente
    FROM docente_materias dm
    JOIN materias m ON dm.materia_id = m.id
    JOIN docentes d ON dm.docente_id = d.id
    ORDER BY m.nombre, d.nombre`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post('/api/admin/criterios', (req, res) => {
  const { pregunta } = req.body;
  db.query("INSERT INTO criterios_evaluacion (pregunta) VALUES (?)", [pregunta], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Criterio agregado" });
  });
});

app.post('/api/configuracion', (req, res) => {
  const { comandante_nombre } = req.body;
  db.query("UPDATE configuracion SET comandante_nombre = ? WHERE id = 1", [comandante_nombre], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.affectedRows === 0) {
      db.query("INSERT INTO configuracion (id, comandante_nombre, gestion) VALUES (1, ?, '2026')", [comandante_nombre]);
    }
    res.json({ message: "Comandante actualizado" });
  });
});

// --- 5. GESTIÓN DE CALIFICACIONES ---
app.post('/api/notas', (req, res) => {
  const { estudiante_id, docente_id, materia_id, parcial_1, parcial_final, trabajos } = req.body;
  const sql = "INSERT INTO notas (estudiante_id, docente_id, materia_id, parcial_1, parcial_final, trabajos) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [estudiante_id, docente_id, materia_id, parcial_1, parcial_final, trabajos], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Nota registrada" });
  });
});

app.post('/api/notas/publicar-lote', (req, res) => {
  db.query("UPDATE notas SET publicado = 1", (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Tablero publicado" });
  });
});

// ============================================================
//  BLOCKCHAIN — cadena de actas (el CORE del proyecto)
//  Al publicar un acta se congela en un bloque encadenado por SHA-256.
//  Desde ese momento es inmutable: cualquier alteración rompe la cadena.
// ============================================================

// Devuelve el último bloque de la cadena (o null si está vacía).
function ultimoBloque(cb) {
  db.query("SELECT * FROM bloques ORDER BY indice DESC LIMIT 1", (err, rows) => {
    if (err) return cb(err);
    cb(null, rows[0] || null);
  });
}

// Convierte una fila de notas en un registro de acta (notas como texto con 2
// decimales para que el JSON sea estable y el hash siempre reproducible).
function registroDeNota(n) {
  return {
    codigo: n.codigo,
    estudiante: n.estudiante,
    materia: n.materia,
    parcial_1: Number(n.parcial_1).toFixed(2),
    parcial_final: Number(n.parcial_final).toFixed(2),
    trabajos: Number(n.trabajos).toFixed(2),
    nota_final: Number(n.nota_final).toFixed(2)
  };
}

// Inserta secuencialmente una lista de actas, encadenando cada bloque al anterior.
function sellarActasSecuencial(actas, res) {
  ultimoBloque((err, prevInicial) => {
    if (err) return res.status(500).json(err);
    let prev = prevInicial;
    let i = 0;
    (function siguiente() {
      if (i >= actas.length) return res.json({ message: "Cadena generada", bloques_creados: actas.length });
      const { materia_id, ciclo, acta } = actas[i];
      const indice = prev ? prev.indice + 1 : 0;
      const hashPrevio = prev ? prev.hash : GENESIS_PREV;
      const hash = calcularHash(indice, materia_id, ciclo, acta, hashPrevio);
      db.query("INSERT INTO bloques (indice, materia_id, ciclo, acta_json, hash_previo, hash) VALUES (?, ?, ?, ?, ?, ?)",
        [indice, materia_id, ciclo, JSON.stringify(acta), hashPrevio, hash], (errI) => {
          if (errI) return res.status(500).json(errI);
          prev = { indice, hash };
          i++;
          siguiente();
        });
    })();
  });
}

// --- Publicar un acta y sellarla en la cadena ---
// Body opcional { materia_id }. Sin materia_id => acta general de todas las notas.
app.post('/api/actas/publicar', (req, res) => {
  const body = req.body || {};
  const materiaId = body.materia_id ? parseInt(body.materia_id) : null;
  let sql = `
    SELECT e.codigo, e.nombre AS estudiante, e.ciclo,
           n.materia_id, m.nombre AS materia,
           n.parcial_1, n.parcial_final, n.trabajos, n.nota_final
    FROM notas n
    JOIN estudiantes e ON n.estudiante_id = e.id
    JOIN materias m ON n.materia_id = m.id`;
  const params = [];
  if (materiaId) { sql += " WHERE n.materia_id = ?"; params.push(materiaId); }
  sql += " ORDER BY e.nombre";

  db.query(sql, params, (err, notas) => {
    if (err) return res.status(500).json(err);
    if (notas.length === 0) return res.status(400).json({ message: "No hay notas para publicar en esta acta" });

    db.query("SELECT comandante_nombre, gestion FROM configuracion LIMIT 1", (errC, cfgRows) => {
      if (errC) return res.status(500).json(errC);
      const cfg = cfgRows[0] || { comandante_nombre: 'POR ASIGNAR', gestion: '2026' };
      const ciclo = materiaId ? (notas[0].ciclo || null) : null;
      const acta = {
        materia: materiaId ? notas[0].materia : 'ACTA GENERAL',
        ciclo,
        gestion: cfg.gestion || '2026',
        comandante: cfg.comandante_nombre || 'POR ASIGNAR',
        sello_tiempo: new Date().toISOString(),
        registros: notas.map(registroDeNota)
      };

      ultimoBloque((errU, prev) => {
        if (errU) return res.status(500).json(errU);
        const indice = prev ? prev.indice + 1 : 0;
        const hashPrevio = prev ? prev.hash : GENESIS_PREV;
        const hash = calcularHash(indice, materiaId, ciclo, acta, hashPrevio);
        db.query("INSERT INTO bloques (indice, materia_id, ciclo, acta_json, hash_previo, hash) VALUES (?, ?, ?, ?, ?, ?)",
          [indice, materiaId, ciclo, JSON.stringify(acta), hashPrevio, hash], (errI) => {
            if (errI) return res.status(500).json(errI);
            let upd = "UPDATE notas SET publicado = 1";
            const uParams = [];
            if (materiaId) { upd += " WHERE materia_id = ?"; uParams.push(materiaId); }
            db.query(upd, uParams, (errUp) => {
              if (errUp) return res.status(500).json(errUp);
              res.json({ message: "Acta publicada y sellada en la cadena", indice, hash });
            });
          });
      });
    });
  });
});

// --- Ver la cadena completa (bloques crudos) ---
app.get('/api/blockchain', (req, res) => {
  db.query("SELECT * FROM bloques ORDER BY indice ASC", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

// --- Verificar la INTEGRIDAD de la cadena ---
// Recalcula el hash de cada bloque y comprueba el encadenado con el anterior.
app.get('/api/blockchain/verificar', (req, res) => {
  db.query("SELECT * FROM bloques ORDER BY indice ASC", (err, rows) => {
    if (err) return res.status(500).json(err);
    let cadenaValida = true;
    let primerError = null;
    let hashPrevioEsperado = GENESIS_PREV;

    const bloques = rows.map((b) => {
      const acta = typeof b.acta_json === 'string' ? JSON.parse(b.acta_json) : b.acta_json;
      const hashRecalculado = calcularHash(b.indice, b.materia_id, b.ciclo, acta, b.hash_previo);
      const hashIntacto = hashRecalculado === b.hash;              // ¿los datos coinciden con su hash?
      const enlaceIntacto = b.hash_previo === hashPrevioEsperado;  // ¿enlaza con el bloque anterior?
      const valido = hashIntacto && enlaceIntacto;
      if (!valido && cadenaValida) {
        cadenaValida = false;
        primerError = {
          indice: b.indice,
          motivo: !hashIntacto ? 'DATOS_ALTERADOS' : 'ENLACE_ROTO'
        };
      }
      hashPrevioEsperado = b.hash; // el siguiente bloque debe apuntar a ESTE hash
      return {
        id: b.id, indice: b.indice, materia_id: b.materia_id, ciclo: b.ciclo,
        acta, hash_previo: b.hash_previo, hash: b.hash,
        hash_recalculado: hashRecalculado,
        hash_intacto: hashIntacto, enlace_intacto: enlaceIntacto, valido,
        creado_en: b.creado_en
      };
    });
    res.json({ valida: cadenaValida, longitud: bloques.length, primer_error: primerError, bloques });
  });
});

// ============================================================
//  DEMO — la manipulación para la demostración se hace MANUALMENTE en MySQL
//  (UPDATE directo sobre la tabla `bloques`); ver instrucciones en blockchain.html.
// ============================================================

// RECONSTRUIR la cadena de demostración: borra los bloques y vuelve a sellar
//     un acta por cada materia que tenga notas.
app.post('/api/blockchain/demo-reset', (req, res) => {
  db.query("DELETE FROM bloques", (errDel) => {
    if (errDel) return res.status(500).json(errDel);
    db.query("SELECT comandante_nombre, gestion FROM configuracion LIMIT 1", (errC, cfgRows) => {
      if (errC) return res.status(500).json(errC);
      const cfg = cfgRows[0] || { comandante_nombre: 'POR ASIGNAR', gestion: '2026' };
      db.query(`
        SELECT n.materia_id, m.nombre AS materia, e.ciclo,
               e.codigo, e.nombre AS estudiante,
               n.parcial_1, n.parcial_final, n.trabajos, n.nota_final
        FROM notas n
        JOIN estudiantes e ON n.estudiante_id = e.id
        JOIN materias m ON n.materia_id = m.id
        ORDER BY n.materia_id, e.nombre`, (err2, notas) => {
        if (err2) return res.status(500).json(err2);
        if (notas.length === 0) return res.status(400).json({ message: "No hay notas; registra notas antes de generar la demo" });

        const grupos = {};
        notas.forEach(n => {
          if (!grupos[n.materia_id]) grupos[n.materia_id] = { materia_id: n.materia_id, materia: n.materia, ciclo: n.ciclo, filas: [] };
          grupos[n.materia_id].filas.push(n);
        });
        const actas = Object.values(grupos).map(g => ({
          materia_id: g.materia_id,
          ciclo: g.ciclo,
          acta: {
            materia: g.materia,
            ciclo: g.ciclo,
            gestion: cfg.gestion || '2026',
            comandante: cfg.comandante_nombre || 'POR ASIGNAR',
            sello_tiempo: new Date().toISOString(),
            registros: g.filas.map(registroDeNota)
          }
        }));
        sellarActasSecuencial(actas, res);
      });
    });
  });
});

app.get('/api/notas/docente-historial/:id', (req, res) => {
  const sql = `
    SELECT n.*, e.nombre AS nombre_estudiante, m.nombre AS nombre_materia 
    FROM notas n
    JOIN estudiantes e ON n.estudiante_id = e.id
    JOIN materias m ON n.materia_id = m.id
    WHERE n.docente_id = ?
    ORDER BY n.id DESC LIMIT 10`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// --- 6. BITÁCORA PERSONAL (NOTES) ---
app.get('/api/notes/usuario/:id', (req, res) => {
  const sql = "SELECT * FROM notes WHERE usuario_id = ? ORDER BY fecha DESC";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post('/api/notes', (req, res) => {
  const { usuario_id, titulo, descripcion } = req.body;
  const sql = "INSERT INTO notes (usuario_id, titulo, descripcion) VALUES (?, ?, ?)";
  db.query(sql, [usuario_id, titulo, descripcion], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Nota personal guardada" });
  });
});

app.delete('/api/notes/:id', (req, res) => {
  db.query("DELETE FROM notes WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Nota eliminada" });
  });
});

// --- 7. PORTAL DOCENTE & CONSULTAS DE EVALUACIÓN ---
app.get('/api/home/notas', (req, res) => {
  const sql = `
    SELECT e.nombre AS nombre_estudiante, n.nota_final, m.nombre AS nombre_materia, e.ciclo 
    FROM notas n
    JOIN estudiantes e ON n.estudiante_id = e.id
    JOIN materias m ON n.materia_id = m.id
    WHERE n.publicado = 1 AND m.activa = 1
    ORDER BY n.nota_final DESC`;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/docentes/perfil/:id', (req, res) => {
  const sql = "SELECT * FROM docentes WHERE usuario_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length > 0) {
      res.json(result[0]);
    } else {
      res.status(404).json({ message: "Perfil no vinculado" });
    }
  });
});

app.get('/api/docentes/estrellas/:id', (req, res) => {
  const sql = "SELECT IFNULL(AVG(puntuacion), 0) as promedio FROM evaluaciones_docentes WHERE docente_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
});

// Materias que dicta un docente (relación N a N)
app.get('/api/docentes/:docenteId/materias', (req, res) => {
  const sql = `
    SELECT m.id, m.nombre, m.ciclo, m.activa
    FROM docente_materias dm
    JOIN materias m ON dm.materia_id = m.id
    WHERE dm.docente_id = ?
    ORDER BY m.nombre`;
  db.query(sql, [req.params.docenteId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Cursantes de una materia asignados a ESTE docente (para su planilla)
app.get('/api/docentes/:docenteId/materia/:materiaId/estudiantes', (req, res) => {
  const sql = "SELECT id, nombre, grado, ciclo FROM estudiantes WHERE materia_id = ? AND docente_id = ? ORDER BY nombre ASC";
  db.query(sql, [req.params.materiaId, req.params.docenteId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// El cursante evalúa al docente de su materia (guarda una fila por criterio)
app.post('/api/estudiantes/evaluar-docente', (req, res) => {
  const { estudiante_id, materia_id, calificaciones } = req.body;
  const entries = Object.entries(calificaciones || {});
  if (!estudiante_id || !materia_id || entries.length === 0) {
    return res.status(400).json({ message: "Datos de evaluación incompletos" });
  }
  // El cursante evalúa a SU docente asignado
  db.query("SELECT docente_id FROM estudiantes WHERE id = ?", [estudiante_id], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (rows.length === 0 || !rows[0].docente_id) return res.status(400).json({ message: "El cursante no tiene docente asignado" });
    const docente_id = rows[0].docente_id;

    // Borramos evaluaciones previas de este cursante para este docente/materia (evita duplicar)
    db.query("DELETE FROM evaluaciones_docentes WHERE estudiante_id = ? AND docente_id = ? AND materia_id = ?",
    [estudiante_id, docente_id, materia_id], (delErr) => {
      if (delErr) return res.status(500).json(delErr);

      const values = entries.map(([criterio_id, puntuacion]) => [estudiante_id, docente_id, materia_id, criterio_id, puntuacion]);
      db.query("INSERT INTO evaluaciones_docentes (estudiante_id, docente_id, materia_id, criterio_id, puntuacion) VALUES ?",
      [values], (insErr) => {
        if (insErr) return res.status(500).json(insErr);
        res.json({ message: "Evaluación registrada" });
      });
    });
  });
});

app.get('/api/estudiante_materia/:materiaId', (req, res) => {
  if (req.params.materiaId === 'undefined') {
    return res.status(400).json({ message: "ID de materia no proporcionado" });
  }
  const sql = "SELECT id, nombre, grado, ciclo FROM estudiantes ORDER BY nombre ASC";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/notas/docente/:docenteId/:materiaId', (req, res) => {
  const { docenteId, materiaId } = req.params;
  if (materiaId === 'undefined') return res.status(400).json({ message: "ID de materia inválido" });

  const sql = "SELECT * FROM notas WHERE docente_id = ? AND materia_id = ?";
  db.query(sql, [docenteId, materiaId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post('/api/notas/guardar-planilla', (req, res) => {
  const { planilla } = req.body;
  if (!planilla || planilla.length === 0) {
    return res.status(400).json({ message: "No hay datos para guardar" });
  }
  const values = planilla.map(n => [
    n.estudiante_id,
    n.docente_id,
    n.materia_id,
    n.parcial_1 || 0,
    n.parcial_final || 0,
    n.trabajos || 0,
    0
  ]);
  const sql = `
    INSERT INTO notas (estudiante_id, docente_id, materia_id, parcial_1, parcial_final, trabajos, publicado)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      parcial_1 = VALUES(parcial_1),
      parcial_final = VALUES(parcial_final),
      trabajos = VALUES(trabajos);`;
  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Planilla sincronizada con éxito", affectedRows: result.affectedRows });
  });
});

// --- 8. PORTAL ESTUDIANTE & CRITERIOS ---
app.get('/api/admin/criterios', (req, res) => {
  db.query("SELECT * FROM criterios_evaluacion ORDER BY id ASC", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.get('/api/estudiantes/perfil/:id', (req, res) => {
  const sql = `
    SELECT e.*,
      m.nombre AS nombre_materia_activa,
      (SELECT CONCAT_WS(' ', d.grado, d.nombre)
         FROM docentes d WHERE d.id = e.docente_id) AS nombre_docente_actual
    FROM estudiantes e
    LEFT JOIN materias m ON e.materia_id = m.id
    WHERE e.usuario_id = ?`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length > 0) {
      res.json(result[0]);
    } else {
      res.status(404).json({ message: "Perfil no encontrado" });
    }
  });
});

app.get('/api/notas/estudiante/:id', (req, res) => {
  const sql = `
    SELECT n.*, m.nombre AS nombre_materia, d.nombre AS nombre_docente, d.grado AS grado_docente
    FROM notas n
    JOIN materias m ON n.materia_id = m.id
    JOIN docentes d ON n.docente_id = d.id
    JOIN estudiantes e ON n.estudiante_id = e.id
    WHERE e.usuario_id = ?`;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor ECEME activo e integrado en puerto ${PORT}`));