// ============================================================
//  red/consenso.js — REGLAS DE VALIDACIÓN DEL CONSENSO
// ------------------------------------------------------------
//  Consenso por QUÓRUM DE FIRMAS (Proof of Authority): un bloque solo se
//  confirma si al menos `quorum` nodos autorizados lo firman.
//
//  Este archivo contiene las reglas que cada auditor aplica POR SU CUENTA,
//  sin confiar en lo que diga el proponente. Son funciones puras: reciben
//  el bloque candidato y el estado local, y devuelven ok/motivo.
// ============================================================
const { calcularHash, GENESIS_PREV } = require('../apps/server/blockchain');

const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 100;
const CAMPOS_DE_NOTA = ['parcial_1', 'parcial_final', 'trabajos', 'nota_final'];

// Regla 1 — el hash debe corresponder al contenido.
// El auditor lo RECALCULA desde lo recibido en vez de creerle al proponente.
function validarHash(candidato) {
  const recalculado = calcularHash(
    candidato.indice, candidato.materia_id, candidato.ciclo,
    candidato.acta, candidato.hash_previo
  );
  if (recalculado !== candidato.hash) {
    return { ok: false, motivo: 'HASH_NO_COINCIDE', detalle: `esperaba ${recalculado}` };
  }
  return { ok: true };
}

// Regla 2 — el bloque debe encajar en MI propia copia de la cadena:
// índice consecutivo y hash_previo igual al hash de mi último bloque.
function validarEncadenado(candidato, ultimoLocal) {
  const indiceEsperado = ultimoLocal ? ultimoLocal.indice + 1 : 0;
  const previoEsperado = ultimoLocal ? ultimoLocal.hash : GENESIS_PREV;
  if (candidato.indice !== indiceEsperado) {
    return { ok: false, motivo: 'INDICE_FUERA_DE_ORDEN', detalle: `esperaba el índice ${indiceEsperado}` };
  }
  if (candidato.hash_previo !== previoEsperado) {
    return { ok: false, motivo: 'ENLACE_ROTO', detalle: `esperaba hash_previo ${previoEsperado}` };
  }
  return { ok: true };
}

// Regla 3 — reglas de negocio del acta: no puede venir vacía y toda nota
// debe estar dentro del rango permitido.
function validarReglasDeNegocio(candidato) {
  const acta = candidato.acta;
  if (!acta || typeof acta !== 'object') return { ok: false, motivo: 'ACTA_INVALIDA' };
  const registros = acta.registros;
  if (!Array.isArray(registros) || registros.length === 0) {
    return { ok: false, motivo: 'ACTA_VACIA', detalle: 'el acta no trae ningún registro' };
  }
  for (const r of registros) {
    for (const campo of CAMPOS_DE_NOTA) {
      if (r[campo] === undefined || r[campo] === null) continue;
      const v = Number(r[campo]);
      if (!Number.isFinite(v) || v < NOTA_MINIMA || v > NOTA_MAXIMA) {
        return {
          ok: false, motivo: 'NOTA_FUERA_DE_RANGO',
          detalle: `${r.codigo || '?'} tiene ${campo} = ${r[campo]} (permitido ${NOTA_MINIMA}-${NOTA_MAXIMA})`
        };
      }
    }
  }
  return { ok: true };
}

// Validación completa que corre un auditor antes de firmar.
// Se detiene en la primera regla que falle y devuelve su motivo.
function validarCandidato(candidato, ultimoLocal) {
  for (const regla of [
    () => validarHash(candidato),
    () => validarEncadenado(candidato, ultimoLocal),
    () => validarReglasDeNegocio(candidato)
  ]) {
    const r = regla();
    if (!r.ok) return r;
  }
  return { ok: true };
}

module.exports = {
  NOTA_MINIMA, NOTA_MAXIMA,
  validarHash, validarEncadenado, validarReglasDeNegocio, validarCandidato
};
