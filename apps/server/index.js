const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eceme_db'
});

// --- 1. AUTENTICACIÓN ---
app.post('/api/login', (req, res) => {
  const { identificador, password } = req.body;
  const sql = "SELECT * FROM usuarios WHERE identificador = ? AND password = ?";
  db.query(sql, [identificador, password], (err, result) => {
    if (err) return res.status(500).json(err);
    if (result.length > 0) {
      res.json({ user: result[0], token: 'sesion-activa-eceme' });
    } else {
      res.status(401).json({ message: "Usuario no encontrado o clave incorrecta" });
    }
  });
});

app.post('/api/usuarios/cambiar-password', (req, res) => {
  const { usuario_id, nueva_password } = req.body;
  const sql = "UPDATE usuarios SET password = ?, primer_login = 0 WHERE id = ?";
  db.query(sql, [nueva_password, usuario_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Contraseña actualizada correctamente" });
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

// Registro Estudiante con materia_id integrado
app.post('/api/admin/estudiantes', (req, res) => {
  const { nombre, codigo, grado, ciclo, password, materia_id } = req.body;
  db.query("INSERT INTO usuarios (identificador, password, rol, primer_login) VALUES (?, ?, 'alumno', 1)", [codigo, password], (err, userRes) => {
    if (err) return res.status(500).json(err);
    
    const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;
    db.query("INSERT INTO estudiantes (usuario_id, nombre, codigo, grado, ciclo, materia_id) VALUES (?, ?, ?, ?, ?, ?)", 
    [userRes.insertId, nombre, codigo, grado, ciclo, mid], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ message: "Cursante registrado con materia" });
    });
  });
});

// Actualizar estudiante (Incluyendo materia_id)
app.put('/api/admin/estudiantes/:id', (req, res) => {
  const { nombre, grado, ciclo, materia_id } = req.body;
  const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;
  
  const sql = "UPDATE estudiantes SET nombre = ?, grado = ?, ciclo = ?, materia_id = ? WHERE id = ?";
  db.query(sql, [nombre, grado, ciclo, mid, req.params.id], (err) => {
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
app.get('/api/admin/docentes', (req, res) => {
  db.query("SELECT * FROM docentes ORDER BY nombre", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Registro Docente con materia_id integrado
app.post('/api/admin/docentes', (req, res) => {
  const { nombre, codigo, grado, password, materia_id } = req.body;
  db.query("INSERT INTO usuarios (identificador, password, rol, primer_login) VALUES (?, ?, 'profe', 1)", [codigo, password], (err, userRes) => {
    if (err) return res.status(500).json(err);
    
    const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;
    db.query("INSERT INTO docentes (usuario_id, nombre, codigo, grado, materia_id) VALUES (?, ?, ?, ?, ?)", 
    [userRes.insertId, nombre, codigo, grado, mid], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ message: "Docente registrado con materia" });
    });
  });
});

// Actualizar docente (Incluyendo materia_id)
app.put('/api/admin/docentes/:id', (req, res) => {
  const { nombre, grado, materia_id } = req.body;
  const mid = materia_id && materia_id !== '' ? parseInt(materia_id) : null;

  const sql = "UPDATE docentes SET nombre = ?, grado = ?, materia_id = ? WHERE id = ?";
  db.query(sql, [nombre, grado, mid, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Docente actualizado correctamente" });
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
  const { nombre } = req.body;
  db.query("INSERT INTO materias (nombre, activa) VALUES (?, 1)", [nombre], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Materia creada" });
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

app.get('/api/docentes/materia-actual/:id', (req, res) => {
  db.query("SELECT * FROM materias WHERE activa = 1 LIMIT 1", (err, matResult) => {
    if (err) return res.status(500).json(err);
    if (matResult.length === 0) {
      return res.json({ materia: null, estudiantes: [] });
    }
    const materia = matResult[0];
    db.query("SELECT id, nombre, grado, ciclo FROM estudiantes ORDER BY nombre ASC", (err2, estResult) => {
      if (err2) return res.status(500).json(err2);
      res.json({ materia: materia, estudiantes: estResult });
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
    SELECT e.*, m.nombre as nombre_materia 
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

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor ECEME activo e integrado en puerto ${PORT}`));