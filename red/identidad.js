// ============================================================
//  red/identidad.js — IDENTIDAD CRIPTOGRÁFICA DE CADA NODO
// ------------------------------------------------------------
//  Cada nodo de la red permisionada tiene un par de claves Ed25519.
//  La clave PRIVADA vive fuera del repositorio (carpeta claves/, ignorada
//  por git) y nunca sale del nodo. La clave PÚBLICA se declara en
//  red-permisionada.json, que es el REGISTRO DE PERMISOS: un nodo cuya
//  clave pública no figure ahí queda excluido de la red.
//
//  Se usa el módulo `crypto` nativo de Node: no hay dependencias externas
//  ni nada de Ethereum/Hyperledger. Es una cadena propia.
// ============================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO_RED = path.join(RAIZ, 'red-permisionada.json');
const DIR_CLAVES = path.join(RAIZ, 'claves');

// Lee el registro de permisos de la red (nodos autorizados y quórum).
function cargarRed() {
  if (!fs.existsSync(ARCHIVO_RED)) {
    throw new Error(`No existe ${ARCHIVO_RED}. Ejecute: npm run red:claves`);
  }
  return JSON.parse(fs.readFileSync(ARCHIVO_RED, 'utf8'));
}

function nodoDeLaRed(nodeId) {
  const red = cargarRed();
  const nodo = red.nodos.find(n => n.nodeId === nodeId);
  if (!nodo) throw new Error(`El nodo "${nodeId}" no está autorizado en la red`);
  return nodo;
}

const rutaClavePrivada = (nodeId) => path.join(DIR_CLAVES, `${nodeId}.priv.pem`);

// Genera el par Ed25519 de un nodo. Devuelve la clave pública en formato PEM
// (la privada se escribe en disco). Idempotente: si ya existe, no la pisa.
function generarParDeClaves(nodeId) {
  if (!fs.existsSync(DIR_CLAVES)) fs.mkdirSync(DIR_CLAVES, { recursive: true });
  const ruta = rutaClavePrivada(nodeId);
  if (fs.existsSync(ruta)) {
    const priv = crypto.createPrivateKey(fs.readFileSync(ruta, 'utf8'));
    const pub = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' });
    return { publica: pub.toString(), yaExistia: true };
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(ruta, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), { mode: 0o600 });
  return { publica: publicKey.export({ type: 'spki', format: 'pem' }).toString(), yaExistia: false };
}

function cargarClavePrivada(nodeId) {
  const ruta = rutaClavePrivada(nodeId);
  if (!fs.existsSync(ruta)) {
    throw new Error(`Falta la clave privada del nodo ${nodeId} (${ruta}). Ejecute: npm run red:claves`);
  }
  return crypto.createPrivateKey(fs.readFileSync(ruta, 'utf8'));
}

// ---- Firma y verificación ----
// Se firma EL HASH DEL BLOQUE (la cadena de 64 caracteres), no el acta.
// Punto importante: la firma NO entra en el cálculo del hash. El hash se
// sigue calculando con la fórmula original (blockchain.js) y las firmas se
// guardan aparte, así la cadena anterior a la red sigue verificando igual.
function firmarHash(hashBloque, clavePrivada) {
  // En Ed25519 se pasa null como algoritmo: el propio esquema define el digest
  return crypto.sign(null, Buffer.from(hashBloque, 'utf8'), clavePrivada).toString('base64');
}

function verificarFirma(hashBloque, firmaBase64, clavePublicaPem) {
  try {
    return crypto.verify(
      null,
      Buffer.from(hashBloque, 'utf8'),
      crypto.createPublicKey(clavePublicaPem),
      Buffer.from(firmaBase64, 'base64')
    );
  } catch (e) {
    return false;   // firma corrupta o clave inválida => no verifica
  }
}

// Cuenta cuántas firmas VÁLIDAS y de nodos AUTORIZADOS trae un bloque.
// Ignora duplicados: dos firmas del mismo nodo cuentan una sola vez.
function firmasValidas(hashBloque, firmas, red) {
  const vistos = new Set();
  const validas = [];
  for (const f of (firmas || [])) {
    if (!f || !f.nodeId || !f.firma) continue;
    if (vistos.has(f.nodeId)) continue;
    const nodo = red.nodos.find(n => n.nodeId === f.nodeId);
    if (!nodo) continue;                                   // no está en el registro de permisos
    if (!verificarFirma(hashBloque, f.firma, nodo.clave_publica)) continue;
    vistos.add(f.nodeId);
    validas.push(f);
  }
  return validas;
}

module.exports = {
  ARCHIVO_RED, DIR_CLAVES,
  cargarRed, nodoDeLaRed,
  generarParDeClaves, cargarClavePrivada,
  firmarHash, verificarFirma, firmasValidas
};
