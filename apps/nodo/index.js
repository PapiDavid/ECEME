// ============================================================
//  apps/nodo/index.js — NODO AUDITOR de la red permisionada
// ------------------------------------------------------------
//  Un mismo código levanta el nodo 2 o el 3: la identidad, el puerto y la
//  base de datos se eligen con la variable de entorno NODE_ID.
//
//    NODE_ID=nodo-2 node index.js     -> AUDITOR-A  en el puerto 3002
//    NODE_ID=nodo-3 node index.js     -> AUDITOR-B  en el puerto 3003
//
//  Un auditor NO sabe nada de alumnos, notas ni usuarios: solo guarda su
//  copia de la cadena, valida los bloques que le proponen y los firma si
//  cumplen las reglas. Es independiente del proponente a propósito.
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const { cargarRed, nodoDeLaRed, cargarClavePrivada, firmarHash, firmasValidas } = require('../../red/identidad');
const { validarCandidato } = require('../../red/consenso');
const cadena = require('../../red/cadena-local');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

// La identidad se pasa como argumento (node index.js nodo-2) o por variable
// de entorno. El argumento va primero porque en PowerShell/cmd no existe la
// forma `VAR=valor comando` de los shells Unix.
const NODE_ID = process.argv[2] || process.env.NODE_ID || 'nodo-2';
const red = cargarRed();
const yo = nodoDeLaRed(NODE_ID);
const clavePrivada = cargarClavePrivada(NODE_ID);
// El puerto sale del REGISTRO DE LA RED, no del .env del servidor: ese .env
// define PORT=3001 para el nodo 1, y si lo tomáramos los tres auditores
// intentarían levantar en el mismo puerto. PORT_NODO permite forzarlo.
const PUERTO = Number(process.env.PORT_NODO) || Number(new URL(yo.url).port) || 3002;
// Cada auditor tiene su PROPIO esquema: eceme_nodo_2 / eceme_nodo_3
const BASE = process.env.DB_NAME_NODO || 'eceme_' + NODE_ID.replace('-', '_');

const pool = cadena.crearPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: BASE
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Log con marca del nodo: es la evidencia que se muestra en la defensa.
const log = (...args) => console.log('[' + NODE_ID + '/' + yo.nombre + ']', ...args);
const corto = (h) => String(h || '').slice(0, 12);

// ------------------------------------------------------------
//  Identidad y estado
// ------------------------------------------------------------
app.get('/nodo/info', async (req, res) => {
  try {
    const alt = await cadena.altura(pool);
    const ultimo = await cadena.ultimoBloque(pool);
    res.json({
      nodeId: NODE_ID, nombre: yo.nombre, rol: yo.rol, base_datos: BASE,
      altura: alt.bloques, ultimo_indice: alt.ultimo_indice,
      ultimo_hash: ultimo ? ultimo.hash : null
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/nodo/cadena', async (req, res) => {
  try { res.json(await cadena.cadenaCompleta(pool)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/nodo/huellas', async (req, res) => {
  try { res.json(await cadena.huellas(pool)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/nodo/verificar', async (req, res) => {
  try { res.json(await cadena.verificarCadena(pool)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// ------------------------------------------------------------
//  CONSENSO — validar y firmar un bloque propuesto
// ------------------------------------------------------------
//  El auditor NO confía en el proponente: recalcula el hash por su cuenta,
//  comprueba que el bloque encaje en SU copia y aplica las reglas de
//  negocio. Solo entonces firma.
app.post('/nodo/validar-y-firmar', async (req, res) => {
  const candidato = req.body || {};
  log('propuesta recibida: bloque #' + candidato.indice + ' hash ' + corto(candidato.hash));
  try {
    let ultimo = await cadena.ultimoBloque(pool);

    // Si vengo atrasado (estuve caído), intento ponerme al día antes de juzgar
    const indiceEsperado = ultimo ? ultimo.indice + 1 : 0;
    if (candidato.indice > indiceEsperado) {
      log('estoy atrasado (esperaba #' + indiceEsperado + '), intento sincronizar');
      await sincronizarDesdeProponente();
      ultimo = await cadena.ultimoBloque(pool);
    }

    const veredicto = validarCandidato(candidato, ultimo);
    if (!veredicto.ok) {
      log('RECHAZO bloque #' + candidato.indice + ': ' + veredicto.motivo + ' ' + (veredicto.detalle || ''));
      return res.status(409).json({ firmado: false, nodeId: NODE_ID, ...veredicto });
    }

    const firma = firmarHash(candidato.hash, clavePrivada);
    log('FIRMO bloque #' + candidato.indice);
    res.json({ firmado: true, nodeId: NODE_ID, nombre: yo.nombre, firma });
  } catch (e) {
    log('error al validar:', e.message);
    res.status(500).json({ firmado: false, nodeId: NODE_ID, motivo: 'ERROR_INTERNO', detalle: e.message });
  }
});

// ------------------------------------------------------------
//  REPLICACIÓN — guardar el bloque ya confirmado
// ------------------------------------------------------------
//  Antes de guardar, el auditor verifica OTRA VEZ: el hash, el encadenado
//  y que las firmas alcancen el quórum y sean de nodos autorizados.
app.post('/nodo/replicar', async (req, res) => {
  const bloque = req.body || {};
  try {
    const ultimo = await cadena.ultimoBloque(pool);
    if (ultimo && bloque.indice <= ultimo.indice) {
      return res.json({ guardado: false, motivo: 'YA_LO_TENGO', altura: ultimo.indice });
    }
    const veredicto = validarCandidato(bloque, ultimo);
    if (!veredicto.ok) {
      log('replicacion RECHAZADA bloque #' + bloque.indice + ': ' + veredicto.motivo);
      return res.status(409).json({ guardado: false, ...veredicto });
    }
    const validas = firmasValidas(bloque.hash, bloque.firmas, red);
    if (validas.length < red.quorum) {
      log('replicacion RECHAZADA bloque #' + bloque.indice + ': ' + validas.length + ' firma(s) valida(s), hace falta ' + red.quorum);
      return res.status(409).json({ guardado: false, motivo: 'SIN_QUORUM', firmas_validas: validas.length });
    }
    await cadena.guardarBloque(pool, bloque);
    log('bloque #' + bloque.indice + ' replicado y guardado (' + validas.length + ' firmas validas)');
    res.json({ guardado: true, indice: bloque.indice, firmas_validas: validas.length });
  } catch (e) {
    log('error al replicar:', e.message);
    res.status(500).json({ guardado: false, motivo: 'ERROR_INTERNO', detalle: e.message });
  }
});

// ------------------------------------------------------------
//  SINCRONIZACIÓN — ponerse al día tras haber estado caído
// ------------------------------------------------------------
//  Pide al proponente los bloques que le faltan y verifica cada uno antes
//  de aceptarlo: hash, encadenado y firmas.
//
//  NOTA sobre los bloques HEREDADOS: los que se sellaron antes de que
//  existiera la red no tienen firmas. Se aceptan verificando hash y
//  encadenado, y quedan marcados como heredados. Los bloques nuevos sí
//  exigen quórum de firmas.
async function sincronizarDesdeProponente() {
  const proponente = red.nodos.find(n => n.rol === 'proponente');
  const resultado = { pedidos: 0, aceptados: 0, rechazados: [] };
  const r = await fetch(proponente.url + '/api/blockchain', { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error('el proponente respondio ' + r.status);
  const remota = await r.json();

  let ultimo = await cadena.ultimoBloque(pool);
  const faltantes = remota
    .filter(b => !ultimo || b.indice > ultimo.indice)
    .sort((a, b) => a.indice - b.indice);
  resultado.pedidos = faltantes.length;

  for (const b of faltantes) {
    const bloque = {
      indice: b.indice, materia_id: b.materia_id, ciclo: b.ciclo,
      acta: typeof b.acta_json === 'string' ? JSON.parse(b.acta_json) : (b.acta_json || b.acta),
      hash_previo: b.hash_previo, hash: b.hash,
      firmas: typeof b.firmas === 'string' ? JSON.parse(b.firmas) : (b.firmas || [])
    };
    const veredicto = validarCandidato(bloque, ultimo);
    if (!veredicto.ok) {
      resultado.rechazados.push({ indice: bloque.indice, ...veredicto });
      log('sincronizacion: RECHAZO bloque #' + bloque.indice + ' (' + veredicto.motivo + ')');
      break;  // la cadena es secuencial: si uno falla, los siguientes no encajan
    }
    const validas = firmasValidas(bloque.hash, bloque.firmas, red);
    const heredado = (bloque.firmas || []).length === 0;
    if (!heredado && validas.length < red.quorum) {
      resultado.rechazados.push({ indice: bloque.indice, motivo: 'SIN_QUORUM', firmas_validas: validas.length });
      log('sincronizacion: RECHAZO bloque #' + bloque.indice + ' (firmas insuficientes)');
      break;
    }
    await cadena.guardarBloque(pool, bloque);
    ultimo = { indice: bloque.indice, hash: bloque.hash };
    resultado.aceptados++;
    log('sincronizacion: bloque #' + bloque.indice + ' aceptado' +
        (heredado ? ' (heredado, sin firmas)' : ' (' + validas.length + ' firmas)'));
  }
  return resultado;
}

app.post('/nodo/sincronizar', async (req, res) => {
  try {
    const r = await sincronizarDesdeProponente();
    const alt = await cadena.altura(pool);
    res.json({ ...r, altura: alt.bloques });
  } catch (e) {
    log('error al sincronizar:', e.message);
    res.status(500).json({ message: e.message });
  }
});

const servidor = app.listen(PUERTO, async () => {
  log('escuchando en el puerto ' + PUERTO + ' | base ' + BASE + ' | quorum de red ' + red.quorum + '/' + red.nodos.length);
  // Al arrancar intenta ponerse al día solo (por si estuvo caído).
  // Reintenta unas veces porque al levantar la red completa los auditores
  // suelen arrancar antes que el proponente.
  const INTENTOS = 6, ESPERA_MS = 2000;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const r = await sincronizarDesdeProponente();
      if (r.aceptados > 0) log('sincronizado al arrancar: ' + r.aceptados + ' bloque(s) incorporado(s)');
      else log('al arrancar ya estaba al dia');
      return;
    } catch (e) {
      if (intento === INTENTOS) {
        log('no pude sincronizar al arrancar (' + e.message + '); lo intentare al recibir una propuesta');
      } else {
        await new Promise(r => setTimeout(r, ESPERA_MS));
      }
    }
  }
});

// Un puerto ocupado es el error más común al levantar la red: se avisa claro.
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    log('ERROR: el puerto ' + PUERTO + ' ya está ocupado. ¿Hay otro nodo corriendo?');
    process.exit(1);
  }
  log('ERROR al levantar el nodo:', e.message);
  process.exit(1);
});
