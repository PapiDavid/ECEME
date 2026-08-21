// ============================================================
//  red/proponente.js — RONDA DE CONSENSO (lado del proponente)
// ------------------------------------------------------------
//  Lo ejecuta el nodo 1 cada vez que hay que sellar un acta.
//
//  Flujo:
//    1. Construye el bloque candidato y calcula su hash (fórmula original).
//    2. Lo propone a los auditores por HTTP, en paralelo y con timeout corto
//       para no colgar la interfaz si un nodo está caído.
//    3. Cada auditor valida por su cuenta y devuelve su firma, o rechaza.
//    4. El proponente firma también. Si junta al menos `quorum` firmas
//       VÁLIDAS de nodos autorizados, confirma el bloque.
//    5. Si no alcanza el quórum, el bloque se DESCARTA: no se guarda nada.
//
//  Las firmas se calculan SOBRE EL HASH del bloque y se guardan aparte:
//  no entran en el hash, así la cadena anterior sigue verificando igual.
// ============================================================
const { calcularHash, GENESIS_PREV } = require('../apps/server/blockchain');
const { cargarRed, cargarClavePrivada, firmarHash, firmasValidas } = require('./identidad');

// Timeout corto: si un auditor está caído, la publicación no se cuelga.
const TIMEOUT_MS = Number(process.env.RED_TIMEOUT_MS) || 2500;

const red = cargarRed();
const NODE_ID_PROPONENTE = (red.nodos.find(n => n.rol === 'proponente') || {}).nodeId || 'nodo-1';
const auditores = () => red.nodos.filter(n => n.nodeId !== NODE_ID_PROPONENTE);

let clavePrivada = null;
const miClave = () => (clavePrivada || (clavePrivada = cargarClavePrivada(NODE_ID_PROPONENTE)));

const log = (...args) => console.log('[' + NODE_ID_PROPONENTE + '/CONSENSO]', ...args);
const corto = (h) => String(h || '').slice(0, 12);

// Arma el bloque candidato a partir del último bloque de la cadena local.
function construirCandidato({ ultimo, materia_id, ciclo, acta }) {
  const indice = ultimo ? ultimo.indice + 1 : 0;
  const hash_previo = ultimo ? ultimo.hash : GENESIS_PREV;
  const hash = calcularHash(indice, materia_id, ciclo, acta, hash_previo);
  return { indice, materia_id: materia_id ?? null, ciclo: ciclo ?? null, acta, hash_previo, hash };
}

// Pide la firma de un auditor. Nunca lanza: un nodo caído devuelve firmado:false.
async function pedirFirma(nodo, candidato) {
  try {
    const r = await fetch(nodo.url + '/nodo/validar-y-firmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidato),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const datos = await r.json().catch(() => ({}));
    if (r.ok && datos.firmado) {
      log('firma recibida de ' + nodo.nodeId + ' (' + nodo.nombre + ') para el bloque #' + candidato.indice);
      return { nodeId: nodo.nodeId, nombre: nodo.nombre, firma: datos.firma };
    }
    log('RECHAZO de ' + nodo.nodeId + ' para el bloque #' + candidato.indice + ': ' + (datos.motivo || r.status));
    return null;
  } catch (e) {
    // Timeout, conexión rechazada: el nodo está caído. La red sigue.
    log('sin respuesta de ' + nodo.nodeId + ' (' + nodo.nombre + '): ' + e.message);
    return null;
  }
}

// Replica el bloque ya confirmado. No bloquea la confirmación: un auditor que
// no responda se pondrá al día solo la próxima vez que sincronice.
async function replicar(bloque) {
  const resultados = await Promise.all(auditores().map(async (nodo) => {
    try {
      const r = await fetch(nodo.url + '/nodo/replicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bloque),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      const datos = await r.json().catch(() => ({}));
      const ok = Boolean(datos.guardado);
      log('replicacion a ' + nodo.nodeId + ': ' + (ok ? 'guardado' : (datos.motivo || 'rechazado')));
      return { nodeId: nodo.nodeId, guardado: ok, motivo: datos.motivo || null };
    } catch (e) {
      log('replicacion a ' + nodo.nodeId + ' fallida: ' + e.message);
      return { nodeId: nodo.nodeId, guardado: false, motivo: 'NODO_CAIDO' };
    }
  }));
  return resultados;
}

// ------------------------------------------------------------
//  Ronda completa de consenso.
//  Devuelve { ok: true, bloque, firmas, replicacion } si alcanzó el quórum,
//  o { ok: false, motivo: 'SIN_QUORUM', ... } si no.
//  NO escribe en la base: quien llama decide qué hacer (para poder abortar
//  la publicación entera si no hay quórum).
// ------------------------------------------------------------
async function proponerBloque({ ultimo, materia_id, ciclo, acta }) {
  const candidato = construirCandidato({ ultimo, materia_id, ciclo, acta });
  log('propongo el bloque #' + candidato.indice + ' hash ' + corto(candidato.hash) +
      ' a ' + auditores().length + ' auditor(es); quorum ' + red.quorum + '/' + red.nodos.length);

  // Las propuestas van en paralelo: un nodo caído no retrasa al otro.
  const respuestas = await Promise.all(auditores().map(n => pedirFirma(n, candidato)));

  // El proponente firma su propio bloque.
  const firmaPropia = {
    nodeId: NODE_ID_PROPONENTE,
    nombre: (red.nodos.find(n => n.nodeId === NODE_ID_PROPONENTE) || {}).nombre,
    firma: firmarHash(candidato.hash, miClave())
  };

  const reunidas = [firmaPropia, ...respuestas.filter(Boolean)];
  // Se verifican todas otra vez contra el registro de permisos: solo cuentan
  // las firmas criptográficamente válidas y de nodos autorizados.
  const validas = firmasValidas(candidato.hash, reunidas, red);

  if (validas.length < red.quorum) {
    log('SIN QUORUM para el bloque #' + candidato.indice + ': ' + validas.length +
        ' firma(s) valida(s) de ' + red.quorum + ' necesarias. Bloque descartado.');
    return {
      ok: false, motivo: 'SIN_QUORUM',
      firmas_validas: validas.length, quorum: red.quorum, total_nodos: red.nodos.length,
      firmantes: validas.map(f => f.nodeId)
    };
  }

  const bloque = { ...candidato, firmas: validas };
  log('BLOQUE #' + candidato.indice + ' CONFIRMADO con ' + validas.length + ' firmas: ' +
      validas.map(f => f.nodeId).join(', '));
  return { ok: true, bloque, firmas: validas, quorum: red.quorum };
}

module.exports = {
  red, NODE_ID_PROPONENTE, auditores, TIMEOUT_MS,
  construirCandidato, proponerBloque, replicar
};
