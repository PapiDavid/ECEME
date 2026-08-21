// ============================================================
//  red/cadena-local.js — COPIA LOCAL DE LA CADENA DE UN NODO
// ------------------------------------------------------------
//  Cada nodo guarda su PROPIA copia de la cadena en su propio esquema
//  MySQL (eceme_db el nodo 1, eceme_nodo_2 y eceme_nodo_3 los auditores).
//  Eso es lo que hace que la replicación sea real: si alguien altera la
//  copia de un nodo, las otras siguen sanas y la divergencia se detecta.
//
//  Este módulo es el único punto que toca la tabla `bloques`, y sirve
//  igual para el proponente y para los auditores.
// ============================================================
const mysql = require('mysql2');
const { calcularHash, GENESIS_PREV } = require('../apps/server/blockchain');

// Crea el pool de conexiones a la copia de ESTE nodo.
function crearPool(cfg) {
  return mysql.createPool({
    host: cfg.host || 'localhost',
    user: cfg.user || 'root',
    password: cfg.password || '',
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 5
  });
}

// Envoltura en promesas: el resto de la red usa async/await.
const consultar = (pool, sql, params = []) =>
  new Promise((ok, mal) => pool.query(sql, params, (e, r) => (e ? mal(e) : ok(r))));

const parsearActa = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const parsearFirmas = (v) => {
  if (v === null || v === undefined) return [];
  return typeof v === 'string' ? JSON.parse(v) : v;
};

async function ultimoBloque(pool) {
  const filas = await consultar(pool, 'SELECT * FROM bloques ORDER BY indice DESC LIMIT 1');
  return filas[0] || null;
}

async function altura(pool) {
  const filas = await consultar(pool, 'SELECT COUNT(*) AS n, MAX(indice) AS ultimo FROM bloques');
  return { bloques: filas[0].n, ultimo_indice: filas[0].ultimo };
}

async function cadenaCompleta(pool) {
  const filas = await consultar(pool, 'SELECT * FROM bloques ORDER BY indice ASC');
  return filas.map(b => ({
    indice: b.indice,
    materia_id: b.materia_id,
    ciclo: b.ciclo,
    acta: parsearActa(b.acta_json),
    hash_previo: b.hash_previo,
    hash: b.hash,
    firmas: parsearFirmas(b.firmas),
    creado_en: b.creado_en
  }));
}

// Huellas de toda la cadena: es lo que se compara entre nodos para detectar
// divergencias sin mover las actas completas.
//
// Se devuelve el hash GUARDADO y el hash RECALCULADO desde el contenido.
// La comparación entre nodos se hace sobre el RECALCULADO, y esto es clave:
// si alguien altera el acta con un UPDATE pero no toca la columna hash, el
// hash guardado sigue igual en las tres copias y la divergencia pasaría
// inadvertida. El recalculado, en cambio, delata el contenido alterado.
async function huellas(pool) {
  const filas = await consultar(pool, 'SELECT * FROM bloques ORDER BY indice ASC');
  return filas.map(b => {
    const acta = parsearActa(b.acta_json);
    return {
      indice: b.indice,
      hash: b.hash,
      hash_recalculado: calcularHash(b.indice, b.materia_id, b.ciclo, acta, b.hash_previo)
    };
  });
}

async function guardarBloque(pool, bloque) {
  await consultar(pool,
    'INSERT INTO bloques (indice, materia_id, ciclo, acta_json, hash_previo, hash, firmas) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [bloque.indice, bloque.materia_id, bloque.ciclo, JSON.stringify(bloque.acta),
     bloque.hash_previo, bloque.hash, JSON.stringify(bloque.firmas || [])]);
}

// Verifica la integridad de la copia local: recalcula el hash de cada bloque
// y comprueba el encadenado. Misma lógica que /api/blockchain/verificar.
async function verificarCadena(pool) {
  const filas = await consultar(pool, 'SELECT * FROM bloques ORDER BY indice ASC');
  let previoEsperado = GENESIS_PREV;
  let primerError = null;
  for (const b of filas) {
    const acta = parsearActa(b.acta_json);
    const recalculado = calcularHash(b.indice, b.materia_id, b.ciclo, acta, b.hash_previo);
    const hashIntacto = recalculado === b.hash;
    const enlaceIntacto = b.hash_previo === previoEsperado;
    if ((!hashIntacto || !enlaceIntacto) && !primerError) {
      primerError = { indice: b.indice, motivo: !hashIntacto ? 'DATOS_ALTERADOS' : 'ENLACE_ROTO' };
    }
    previoEsperado = b.hash;
  }
  return { valida: !primerError, longitud: filas.length, primer_error: primerError };
}

module.exports = {
  crearPool, consultar,
  ultimoBloque, altura, cadenaCompleta, huellas, guardarBloque, verificarCadena
};
