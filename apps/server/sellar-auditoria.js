// ============================================================
//  MIGRACIÓN: sella (encadena por SHA-256) los registros de
//  auditoría que ya existían antes de activar la integridad.
//
//  Recorre TODA la bitácora en orden y recalcula hash_previo y
//  hash de cada registro con la misma fórmula del backend
//  (auditoria-hash.js), encadenando desde el génesis ("0").
//  Es DETERMINISTA: correrlo de nuevo produce los mismos hashes,
//  así que se puede repetir sin problemas.
//  Uso:  npm run sellar:log   (desde apps/server)
// ============================================================
const mysql = require('mysql2');
const { GENESIS_AUDITORIA, calcularHashAuditoria } = require('./auditoria-hash');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eceme_db'
});

db.query("SELECT * FROM auditoria ORDER BY id ASC", (err, registros) => {
  if (err) { console.error('Error leyendo la auditoría:', err.message); process.exit(1); }
  if (registros.length === 0) { console.log('La bitácora está vacía; nada que sellar. ✔'); process.exit(0); }

  console.log(`Sellando ${registros.length} registro(s) de auditoría...`);
  let hashPrevio = GENESIS_AUDITORIA;
  let i = 0;

  // Secuencial a propósito: cada hash depende del anterior
  (function siguiente() {
    if (i >= registros.length) { console.log('Bitácora sellada y encadenada. ✔'); process.exit(0); }
    const r = registros[i];
    const hash = calcularHashAuditoria(r, hashPrevio);
    db.query("UPDATE auditoria SET hash = ?, hash_previo = ? WHERE id = ?", [hash, hashPrevio, r.id], (errU) => {
      if (errU) { console.error(`✗ registro #${r.id}:`, errU.message); process.exit(1); }
      console.log(`✔ #${r.id} ${r.accion} → ${hash.slice(0, 12)}…`);
      hashPrevio = hash; // el siguiente registro se encadena a ESTE
      i++;
      siguiente();
    });
  })();
});
