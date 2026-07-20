// ============================================================
//  INTEGRIDAD DE LA AUDITORÍA — fórmula del hash de la bitácora
//  Mismo enfoque SHA-256 del módulo nativo `crypto` que usa la
//  blockchain de actas (blockchain.js), pero para los logs.
//  Módulo aparte para NO tocar blockchain.js (core de las actas)
//  y para que index.js y sellar-auditoria.js compartan la fórmula.
// ============================================================
const crypto = require('crypto');

// hash_previo del primer registro (génesis de la bitácora)
const GENESIS_AUDITORIA = '0';

// La fecha SIEMPRE se serializa igual (toISOString) para que el hash sea
// reproducible. OJO: no se incluye el id autoincremental en el hash.
function fechaISO(fecha) {
  return new Date(fecha).toISOString();
}

// SHA-256 sobre la concatenación de los datos del registro + hash_previo.
function calcularHashAuditoria(reg, hashPrevio) {
  const payload = [
    reg.usuario_id == null ? '' : reg.usuario_id,
    reg.usuario_nombre || '',
    reg.rol || '',
    reg.accion || '',
    reg.detalle || '',
    reg.ip || '',
    reg.dispositivo || '',
    fechaISO(reg.fecha),
    hashPrevio
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

module.exports = { GENESIS_AUDITORIA, calcularHashAuditoria, fechaISO };
