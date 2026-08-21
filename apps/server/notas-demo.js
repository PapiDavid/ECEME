/**
 * Carga de NOTAS y EVALUACIONES DOCENTES de demostración.
 * ------------------------------------------------------------
 * Complemento de datos-demo.js: aquel crea el personal, este le da
 * actividad académica (notas de cada cursante y su evaluación al docente).
 *
 * Uso:  npm run notas:demo   (desde apps/server, con el servidor levantado)
 *
 * Dos reglas de diseño:
 *  1) NO PISA lo que ya existe. Lee primero qué cursantes ya tienen nota y
 *     cuáles ya evaluaron, y solo completa los que faltan. Así no se alteran
 *     las notas que ya fueron selladas en un bloque de la cadena.
 *  2) Escribe por la API (no INSERT directos), para que todo quede en la
 *     auditoría, igual que si lo hubiera hecho un docente desde su planilla.
 *
 * Los valores son PSEUDOALEATORIOS PERO DETERMINISTAS (semilla fija): dos
 * corridas producen exactamente los mismos números, así la demo es repetible.
 * La blockchain no se toca: guardar notas no sella ningún bloque, eso solo
 * pasa al publicar el acta desde el panel del administrador.
 */

const mysql = require('mysql2');
require('dotenv').config();

const API = process.env.API_URL || 'http://localhost:3001/api';

// --- Generador pseudoaleatorio con semilla (mulberry32) ---
// Se usa en vez de Math.random() para que los datos sean reproducibles.
let semilla = 20260810;
function aleatorio() {
  semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => Math.round(min + aleatorio() * (max - min));

// Nota de un examen: casi todos aprueban, algunos raspan y unos pocos reprueban,
// que es como se ve una planilla real (y hace creíble el reporte de mérito).
function notaExamen() {
  const r = aleatorio();
  if (r < 0.10) return entre(30, 50);   // 10% reprobado
  if (r < 0.35) return entre(51, 68);   // 25% suficiente
  if (r < 0.80) return entre(69, 85);   // 45% bueno
  return entre(86, 100);                // 20% sobresaliente
}

// Puntuación 1-5 de un criterio. Cada docente arrastra su propio "nivel", así
// unos quedan con 5 estrellas y otros con 3, en vez de todos iguales.
function puntuacion(nivelDocente) {
  const r = aleatorio();
  const base = nivelDocente + (r < 0.25 ? -1 : r > 0.75 ? 1 : 0);
  return Math.max(1, Math.min(5, base));
}

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eceme_db'
});
const consultar = (sql, params = []) =>
  new Promise((ok, mal) => db.query(sql, params, (e, r) => (e ? mal(e) : ok(r))));

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Nombre': encodeURIComponent('CARGA DE DATOS DEMO'),
      'X-Usuario-Rol': 'admin'
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, datos };
}

async function main() {
  console.log(`Servidor: ${API}\n`);

  // Los cursantes que tienen materia y docente son los únicos que pueden
  // tener planilla y evaluar.
  const cursantes = await consultar(`
    SELECT e.id, e.codigo, e.nombre, e.materia_id, e.docente_id, m.nombre AS materia
    FROM estudiantes e JOIN materias m ON e.materia_id = m.id
    WHERE e.materia_id IS NOT NULL AND e.docente_id IS NOT NULL
    ORDER BY m.nombre, e.codigo`);

  // ---------- 1. NOTAS ----------
  const conNota = new Set((await consultar('SELECT DISTINCT estudiante_id FROM notas')).map(r => r.estudiante_id));
  const faltanNota = cursantes.filter(c => !conNota.has(c.id));
  console.log(`NOTAS — ${conNota.size} cursante(s) ya tenían; faltan ${faltanNota.length}`);

  // La planilla se guarda agrupada por docente+materia, igual que cuando el
  // docente pulsa "SUBIR NOTAS" en su portal.
  const porPlanilla = new Map();
  for (const c of faltanNota) {
    const clave = `${c.docente_id}|${c.materia_id}`;
    if (!porPlanilla.has(clave)) porPlanilla.set(clave, { materia: c.materia, filas: [] });
    porPlanilla.get(clave).filas.push({
      estudiante_id: c.id,
      docente_id: c.docente_id,
      materia_id: c.materia_id,
      parcial_1: notaExamen(),
      parcial_final: notaExamen(),
      trabajos: entre(60, 100)   // los trabajos suelen ir mejor que los exámenes
    });
  }

  let notasCreadas = 0;
  for (const [, { materia, filas }] of porPlanilla) {
    const r = await pedir('POST', '/notas/guardar-planilla', { planilla: filas });
    if (r.ok) {
      notasCreadas += filas.length;
      console.log(`  ✓ ${materia}: ${filas.length} planilla(s) guardada(s)`);
    } else {
      console.log(`  · ${materia}: ${r.datos.message || 'error ' + r.status}`);
    }
  }

  // ---------- 2. EVALUACIÓN DOCENTE ----------
  const criterios = await consultar('SELECT id FROM criterios_evaluacion ORDER BY orden, id');
  if (criterios.length === 0) {
    console.log('\nEVALUACIÓN DOCENTE — no hay criterios definidos, se omite.');
  } else {
    // Quién ya evaluó (para no reemplazar evaluaciones reales)
    const yaEvaluo = new Set(
      (await consultar('SELECT DISTINCT estudiante_id, docente_id, materia_id FROM evaluaciones_docentes'))
        .map(r => `${r.estudiante_id}|${r.docente_id}|${r.materia_id}`));
    const faltanEvaluar = cursantes.filter(c => !yaEvaluo.has(`${c.id}|${c.docente_id}|${c.materia_id}`));
    console.log(`\nEVALUACIÓN DOCENTE — ${yaEvaluo.size} evaluación(es) ya existían; faltan ${faltanEvaluar.length}`);

    // Cada docente arrastra su propio nivel (3, 4 o 5) para que las estrellas
    // salgan distintas entre uno y otro.
    const nivelDe = new Map();
    for (const c of cursantes) if (!nivelDe.has(c.docente_id)) nivelDe.set(c.docente_id, entre(3, 5));

    let evaluaciones = 0, fallos = 0;
    for (const c of faltanEvaluar) {
      const calificaciones = {};
      for (const cr of criterios) calificaciones[cr.id] = puntuacion(nivelDe.get(c.docente_id));
      const r = await pedir('POST', '/estudiantes/evaluar-docente', {
        estudiante_id: c.id, materia_id: c.materia_id, calificaciones
      });
      if (r.ok) evaluaciones++;
      else { fallos++; console.log(`  · ${c.codigo}: ${r.datos.message || 'error ' + r.status}`); }
    }
    console.log(`  ✓ ${evaluaciones} evaluación(es) registradas${fallos ? ` · ${fallos} con error` : ''}`);
  }

  console.log(`\nRESUMEN: ${notasCreadas} planilla(s) de notas creadas.`);
  console.log('         No se modificó ninguna nota ni evaluación que ya existiera.');
  console.log('         La cadena de bloques no se tocó: sellar un acta se hace desde el panel.');
  db.end();
}

main().catch(err => {
  console.error('\nFalló la carga:', err.message);
  db.end();
  process.exit(1);
});
