// ============================================================
//  blockchain.js — Núcleo de la cadena de bloques (ECEME)
//  Cadena PRIVADA/PERMISIONADA: no es Ethereum ni red pública.
//  Cada acta publicada se "sella" con SHA-256 y se encadena a la
//  anterior por su hash. Alterar cualquier dato rompe la cadena.
// ============================================================
const crypto = require('crypto');

// Hash "de arranque": el bloque 0 (génesis) no tiene bloque previo,
// así que su hash_previo son 64 ceros.
const GENESIS_PREV = '0'.repeat(64);

// Serializa un objeto de forma DETERMINISTA (claves ordenadas y de forma
// recursiva). Esto garantiza que el hash sea siempre el mismo sin importar
// en qué orden MySQL nos devuelva las claves del JSON al leerlo de vuelta.
function ordenarClaves(v) {
  if (Array.isArray(v)) return v.map(ordenarClaves);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((acc, k) => {
      acc[k] = ordenarClaves(v[k]);
      return acc;
    }, {});
  }
  return v;
}

function canonical(obj) {
  return JSON.stringify(ordenarClaves(obj));
}

// El hash de un bloque depende de: su índice, la materia/ciclo, el contenido
// canónico del acta y el hash del bloque anterior. Cambiar CUALQUIERA de estos
// produce un hash totalmente distinto (efecto avalancha de SHA-256).
function calcularHash(indice, materiaId, ciclo, actaObj, hashPrevio) {
  const payload = [
    indice,
    materiaId === null || materiaId === undefined ? '' : materiaId,
    ciclo || '',
    canonical(actaObj),
    hashPrevio
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

module.exports = { GENESIS_PREV, canonical, calcularHash };
