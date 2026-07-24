// ============================================================
//  seguridad.js — Verificación de la resistencia del sistema ante
//  intentos de INYECCIÓN y de ALTERACIÓN de datos (ECEME).
//
//  Ejecuta ataques reales contra el backend y contra la base de datos
//  y comprueba que el sistema los rechaza o los detecta.
//  Todo lo que altera se restaura al terminar.
// ============================================================
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3001';
const SALIDA = path.join(__dirname, 'resultados.json');

const DB = { host: 'localhost', user: 'root', password: '2004', database: 'eceme_db' };
const ADMIN = { identificador: 'admin@eceme.mil.bo', password: 'admin123' };

const pruebas = [];
let db;

// Registra el resultado de una prueba.
function anotar({ categoria, nombre, ataque, esperado, obtenido, resiste, nota }) {
  const p = { n: pruebas.length + 1, categoria, nombre, ataque, esperado, obtenido, resiste, nota: nota || null };
  pruebas.push(p);
  const marca = resiste === true ? 'RESISTE   ' : resiste === false ? 'VULNERABLE' : 'OBSERVAR  ';
  console.log(`  [${marca}] ${nombre}`);
  console.log(`               → ${obtenido}`);
  return p;
}

async function api(ruta, opciones = {}) {
  const r = await fetch(BASE + ruta, opciones);
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch (e) { cuerpo = null; }
  return { estado: r.status, cuerpo };
}

const login = (identificador, password) =>
  api('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, password })
  });

const verificarCadena = () => api('/api/blockchain/verificar');
const verificarBitacora = () => api('/api/admin/auditoria/verificar');

// ============================================================
//  1 · INYECCIÓN SQL
// ============================================================
async function inyeccionSQL() {
  console.log('\n1 · INYECCIÓN SQL');

  // --- Bypass clásico de autenticación con una tautología ---
  let payload = "' OR '1'='1";
  let r = await login(payload, payload);
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'Bypass de login con tautología',
    ataque: `identificador y contraseña = ${payload}`,
    esperado: 'Acceso denegado (401)',
    obtenido: `HTTP ${r.estado} — ${r.cuerpo?.message || 'sin mensaje'}`,
    resiste: r.estado === 401
  });

  // --- Usuario real + comentario SQL para anular la comprobación de clave ---
  payload = `${ADMIN.identificador}' -- `;
  r = await login(payload, 'cualquier-cosa');
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'Anular la verificación de contraseña con un comentario SQL',
    ataque: `identificador = ${payload}`,
    esperado: 'Acceso denegado (401)',
    obtenido: `HTTP ${r.estado} — ${r.cuerpo?.message || 'sin mensaje'}`,
    resiste: r.estado === 401
  });

  // --- Tautología en el buscador de la bitácora ---
  const base = await api('/api/admin/auditoria?q=' + encodeURIComponent('ZZZ_NO_EXISTE_ZZZ'));
  r = await api('/api/admin/auditoria?q=' + encodeURIComponent("' OR '1'='1"));
  const filas = Array.isArray(r.cuerpo) ? r.cuerpo.length : -1;
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'Tautología en el buscador de auditoría',
    ataque: "GET /api/admin/auditoria?q=' OR '1'='1",
    esperado: '0 registros (el texto se busca literal, no se ejecuta)',
    obtenido: `HTTP ${r.estado} — ${filas} registro(s) devuelto(s)`,
    resiste: r.estado === 200 && filas === 0,
    nota: `Búsqueda de control sin resultados: ${Array.isArray(base.cuerpo) ? base.cuerpo.length : '?'} registro(s)`
  });

  // --- UNION SELECT para extraer las contraseñas ---
  r = await api('/api/admin/auditoria?q=' + encodeURIComponent("' UNION SELECT password FROM usuarios -- "));
  const filasU = Array.isArray(r.cuerpo) ? r.cuerpo.length : -1;
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'UNION SELECT para extraer contraseñas',
    ataque: "q=' UNION SELECT password FROM usuarios -- ",
    esperado: '0 registros y ningún error de SQL expuesto',
    obtenido: `HTTP ${r.estado} — ${filasU} registro(s), sin error de SQL`,
    resiste: r.estado === 200 && filasU === 0
  });

  // --- Payload destructivo: DROP TABLE ---
  const [antes] = await db.query('SELECT COUNT(*) AS c FROM bloques');
  await api('/api/admin/auditoria?q=' + encodeURIComponent("'; DROP TABLE bloques; -- "));
  await login("admin'; DROP TABLE bloques; -- ", 'x');
  let sigueViva = true;
  let despues = { c: -1 };
  try {
    const [d] = await db.query('SELECT COUNT(*) AS c FROM bloques');
    despues = d[0];
  } catch (e) {
    sigueViva = false;
  }
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'Payload destructivo DROP TABLE',
    ataque: "'; DROP TABLE bloques; --  (en el buscador y en el login)",
    esperado: 'La tabla bloques sigue existiendo y con los mismos registros',
    obtenido: sigueViva
      ? `Tabla intacta: ${antes[0].c} bloques antes, ${despues.c} después`
      : '¡LA TABLA FUE ELIMINADA!',
    resiste: sigueViva && antes[0].c === despues.c
  });

  // --- Inyección en un parámetro numérico de la ruta ---
  r = await api('/api/reportes/acta/' + encodeURIComponent('1 OR 1=1'));
  anotar({
    categoria: 'Inyección SQL',
    nombre: 'Inyección en un parámetro numérico de la URL',
    ataque: 'GET /api/reportes/acta/1 OR 1=1',
    esperado: 'No se filtran datos de otras materias ni se expone un error de SQL',
    obtenido: `HTTP ${r.estado} — ${r.cuerpo?.materia ? 'devuelve sólo la materia ' + r.cuerpo.materia : r.cuerpo?.message || 'sin datos'}`,
    resiste: r.estado === 404 || (r.estado === 200 && !!r.cuerpo?.materia)
  });
}

// ============================================================
//  2 · ALTERACIÓN DE DATOS — inmutabilidad de la cadena
// ============================================================
async function alteracionDatos() {
  console.log('\n2 · ALTERACIÓN DE DATOS (inmutabilidad)');

  // Estado de partida: la cadena debe estar íntegra antes de atacarla.
  let v = await verificarCadena();
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Estado inicial de la cadena de actas',
    ataque: '(ninguno — línea base)',
    esperado: 'Cadena válida',
    obtenido: `${v.cuerpo.longitud} bloques · válida: ${v.cuerpo.valida}`,
    resiste: v.cuerpo.valida === true
  });

  // Guardamos el bloque 0 para restaurarlo después.
  const [orig] = await db.query(
    'SELECT indice, CAST(acta_json AS CHAR) AS acta, hash, hash_previo FROM bloques WHERE indice = 0'
  );
  const bloque0 = orig[0];

  // --- Ataque 1: cambiar una nota YA SELLADA, directo en MySQL ---
  await db.query(
    "UPDATE bloques SET acta_json = JSON_REPLACE(acta_json, '$.registros[0].parcial_final', '95.00') WHERE indice = 0"
  );
  v = await verificarCadena();
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Cambiar una nota ya sellada, directo en la base de datos',
    ataque: "UPDATE bloques SET acta_json = JSON_REPLACE(..., '$.registros[0].parcial_final', '95.00')",
    esperado: 'La verificación detecta DATOS_ALTERADOS en el bloque 0',
    obtenido: `válida: ${v.cuerpo.valida} · primer error: bloque #${v.cuerpo.primer_error?.indice} (${v.cuerpo.primer_error?.motivo})`,
    resiste: v.cuerpo.valida === false && v.cuerpo.primer_error?.motivo === 'DATOS_ALTERADOS',
    nota: 'El atacante modificó la nota pero el hash guardado ya no coincide con el recalculado.'
  });

  // --- Ataque 2: el atacante "listo" falsifica también el hash ---
  await db.query("UPDATE bloques SET hash = SHA2(CONCAT(acta_json, 'x'), 256) WHERE indice = 0");
  v = await verificarCadena();
  const b1 = v.cuerpo.bloques.find((b) => b.indice === 1);
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Falsificar además el hash del bloque alterado',
    ataque: "UPDATE bloques SET hash = SHA2(CONCAT(acta_json,'x'), 256) WHERE indice = 0",
    esperado: 'El bloque sigue inválido y se rompe el enlace con el bloque siguiente',
    obtenido: `válida: ${v.cuerpo.valida} · bloque 0 válido: ${v.cuerpo.bloques[0].valido} · enlace del bloque 1 intacto: ${b1 ? b1.enlace_intacto : 'n/d'}`,
    resiste: v.cuerpo.valida === false && b1 && b1.enlace_intacto === false,
    nota: 'Para que cuadrara tendría que rehacer TODA la cadena posterior con la fórmula exacta del hash.'
  });

  // Restauramos el bloque 0.
  await db.query('UPDATE bloques SET acta_json = ?, hash = ? WHERE indice = 0', [bloque0.acta, bloque0.hash]);

  // --- Ataque 3: borrar un bloque intermedio para "hacer desaparecer" un acta ---
  const [filas1] = await db.query('SELECT * FROM bloques WHERE indice = 1');
  const b = filas1[0];
  if (b) {
    await db.query('DELETE FROM bloques WHERE indice = 1');
    v = await verificarCadena();
    anotar({
      categoria: 'Alteración de datos',
      nombre: 'Eliminar un bloque intermedio de la cadena',
      ataque: 'DELETE FROM bloques WHERE indice = 1',
      esperado: 'La cadena queda rota (ENLACE_ROTO) en el bloque siguiente',
      obtenido: `válida: ${v.cuerpo.valida} · primer error: bloque #${v.cuerpo.primer_error?.indice} (${v.cuerpo.primer_error?.motivo})`,
      resiste: v.cuerpo.valida === false && v.cuerpo.primer_error?.motivo === 'ENLACE_ROTO'
    });
    await db.query(
      'INSERT INTO bloques (id, indice, materia_id, ciclo, acta_json, hash_previo, hash, creado_en) VALUES (?,?,?,?,?,?,?,?)',
      [b.id, b.indice, b.materia_id, b.ciclo, JSON.stringify(b.acta_json), b.hash_previo, b.hash, b.creado_en]
    );
  }

  // --- Ataque 4: intentar modificar o borrar un bloque POR LA API ---
  const intentos = [
    ['PUT', '/api/blockchain/0'],
    ['DELETE', '/api/blockchain/0'],
    ['POST', '/api/bloques']
  ];
  const estados = [];
  for (const [metodo, ruta] of intentos) {
    const rr = await api(ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: metodo === 'POST' ? '{}' : undefined
    });
    estados.push(`${metodo} ${ruta} → ${rr.estado}`);
  }
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Modificar o borrar un bloque desde la API',
    ataque: 'PUT / DELETE /api/blockchain/0 · POST /api/bloques',
    esperado: 'No existe ningún endpoint que edite o borre bloques (404)',
    obtenido: estados.join(' · '),
    resiste: estados.every((e) => e.endsWith('404')),
    nota: 'La cadena sólo admite AÑADIR bloques; no hay ninguna vía de escritura para editarlos.'
  });

  // --- Ataque 5: alterar la bitácora de auditoría para borrar el rastro ---
  let vb = await verificarBitacora();
  const integraAntes = vb.cuerpo.integra;
  const [ult] = await db.query('SELECT id, detalle FROM auditoria ORDER BY id DESC LIMIT 1');
  const registro = ult[0];
  await db.query('UPDATE auditoria SET detalle = ? WHERE id = ?', ['(rastro borrado)', registro.id]);
  vb = await verificarBitacora();
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Borrar el rastro modificando la bitácora de auditoría',
    ataque: `UPDATE auditoria SET detalle = '(rastro borrado)' WHERE id = ${registro.id}`,
    esperado: 'La bitácora se reporta como alterada, señalando el registro',
    obtenido: `íntegra antes: ${integraAntes} → después: ${vb.cuerpo.integra} · registro #${vb.cuerpo.primer_error?.id} (${vb.cuerpo.primer_error?.motivo})`,
    resiste: integraAntes === true && vb.cuerpo.integra === false,
    nota: 'La bitácora tiene su propia cadena de hashes, independiente de la de actas.'
  });
  await db.query('UPDATE auditoria SET detalle = ? WHERE id = ?', [registro.detalle, registro.id]);

  // --- Comprobación final: todo restaurado ---
  v = await verificarCadena();
  vb = await verificarBitacora();
  anotar({
    categoria: 'Alteración de datos',
    nombre: 'Restauración del estado original',
    ataque: '(se deshacen todas las alteraciones)',
    esperado: 'Ambas cadenas vuelven a verificarse como íntegras',
    obtenido: `actas válidas: ${v.cuerpo.valida} (${v.cuerpo.longitud} bloques) · bitácora íntegra: ${vb.cuerpo.integra} (${vb.cuerpo.longitud} registros)`,
    resiste: v.cuerpo.valida === true && vb.cuerpo.integra === true
  });
}

// ============================================================
//  3 · CREDENCIALES Y EXPOSICIÓN DE DATOS
// ============================================================
async function credenciales() {
  console.log('\n3 · CREDENCIALES Y EXPOSICIÓN DE DATOS');

  const ok = await login(ADMIN.identificador, ADMIN.password);
  const traePassword = ok.cuerpo && Object.prototype.hasOwnProperty.call(ok.cuerpo.user || ok.cuerpo, 'password');
  anotar({
    categoria: 'Credenciales',
    nombre: 'La respuesta del login no expone la contraseña',
    ataque: 'Inspeccionar el JSON que devuelve POST /api/login',
    esperado: 'El campo password no viaja al cliente',
    obtenido: traePassword ? '¡La respuesta incluye el campo password!' : `HTTP ${ok.estado} — respuesta sin campo password`,
    resiste: ok.estado === 200 && !traePassword
  });

  const [us] = await db.query('SELECT password FROM usuarios');
  const planas = us.filter((u) => !String(u.password).startsWith('$2'));
  anotar({
    categoria: 'Credenciales',
    nombre: 'Contraseñas almacenadas con hash bcrypt',
    ataque: 'Leer directamente la columna usuarios.password en MySQL',
    esperado: 'Ninguna contraseña legible en texto plano',
    obtenido: `${us.length - planas.length} de ${us.length} usuarios con hash bcrypt · ${planas.length} en texto plano`,
    resiste: planas.length === 0,
    nota: 'Aun con acceso total a la base, las contraseñas no se pueden leer.'
  });

  const inexistente = await login('NO_EXISTE_9999', 'x');
  const claveMala = await login(ADMIN.identificador, 'clave-incorrecta');
  const mismoMensaje =
    inexistente.estado === claveMala.estado && inexistente.cuerpo?.message === claveMala.cuerpo?.message;
  anotar({
    categoria: 'Credenciales',
    nombre: 'El error de login no revela si el usuario existe',
    ataque: 'Comparar la respuesta de un usuario inexistente con la de una contraseña incorrecta',
    esperado: 'Mismo código y mismo mensaje en ambos casos',
    obtenido: `usuario inexistente: ${inexistente.estado} "${inexistente.cuerpo?.message}" · clave incorrecta: ${claveMala.estado} "${claveMala.cuerpo?.message}"`,
    resiste: mismoMensaje,
    nota: 'Impide averiguar qué usuarios existen probando identificadores (enumeración).'
  });
}

// ============================================================
//  4 · CONTROL DE ACCESO
// ============================================================
async function controlAcceso() {
  console.log('\n4 · CONTROL DE ACCESO');

  const r = await api('/api/admin/auditoria');
  const filas = Array.isArray(r.cuerpo) ? r.cuerpo.length : -1;
  anotar({
    categoria: 'Control de acceso',
    nombre: 'Acceder a un endpoint de administración sin autenticarse',
    ataque: 'GET /api/admin/auditoria sin ninguna credencial ni cabecera de sesión',
    esperado: 'Acceso denegado (401 / 403)',
    obtenido: `HTTP ${r.estado} — ${filas} registro(s) de la bitácora entregados sin autenticación`,
    resiste: r.estado === 401 || r.estado === 403,
    nota: 'La API no exige token de sesión: la protección de rutas vive sólo en el frontend.'
  });
}

// ============================================================
(async () => {
  db = await mysql.createConnection(DB);
  console.log('VERIFICACIÓN DE RESISTENCIA ANTE INYECCIÓN Y ALTERACIÓN DE DATOS\n');

  await inyeccionSQL();
  await credenciales();
  await alteracionDatos();
  await controlAcceso();

  const resisten = pruebas.filter((p) => p.resiste === true).length;
  const vulnerables = pruebas.filter((p) => p.resiste === false).length;
  console.log(`\nRESUMEN: ${resisten} de ${pruebas.length} pruebas superadas · ${vulnerables} hallazgo(s)`);

  fs.writeFileSync(
    SALIDA,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        total: pruebas.length,
        resisten,
        vulnerables,
        pruebas
      },
      null,
      2
    )
  );
  console.log(`✔ Resultados en ${SALIDA}`);
  await db.end();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
