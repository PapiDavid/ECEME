// Monitor de disponibilidad de la red ECEME.
// Ejecutar: npm run monitor:red --prefix apps/server
// Configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en apps/server/.env.
const net = require('node:net');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { cargarRed } = require('../../red/identidad');

const INTERVALO_MS = Number(process.env.MONITOR_INTERVAL_MS) || 10_000;
const TIMEOUT_MS = Number(process.env.MONITOR_TIMEOUT_MS) || 3_000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const red = cargarRed();
let intervalo = null;

function obtenerDestino(nodo) {
  const url = new URL(nodo.url);
  return {
    host: url.hostname,
    puerto: Number(url.port) || (url.protocol === 'https:' ? 443 : 80)
  };
}

function estaVivo(host, puerto) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: puerto });
    let terminado = false;

    const finalizar = (vivo) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      resolve(vivo);
    };

    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () => finalizar(true));
    socket.once('timeout', () => finalizar(false));
    socket.once('error', () => finalizar(false));
  });
}

async function notificar(mensaje) {
  try {
    const respuesta = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: mensaje }),
      signal: AbortSignal.timeout(5_000)
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  } catch (error) {
    console.error('Error enviando notificacion a Telegram:', error.message);
  }
}

// null significa que todavia se esta tomando la linea base al iniciar.
const estados = new Map(red.nodos.map((nodo) => [nodo.nodeId, null]));

async function revisarNodo(nodo) {
  const { host, puerto } = obtenerDestino(nodo);
  const vivo = await estaVivo(host, puerto);
  const estadoAnterior = estados.get(nodo.nodeId);
  estados.set(nodo.nodeId, vivo);

  if (estadoAnterior === null) {
    console.log(`${nodo.nombre}: ${vivo ? 'en linea' : 'caido'} (${host}:${puerto})`);
    return;
  }
  if (vivo === estadoAnterior) return;

  const mensaje = vivo
    ? `🟢 ${nodo.nombre} se recuperó (${host}:${puerto})`
    : `🔴 ${nodo.nombre} CAYÓ (${host}:${puerto})`;
  console.log(mensaje);
  await notificar(mensaje);
}

async function revisarRed() {
  if (revisarRed.enCurso) return;
  revisarRed.enCurso = true;
  try {
    await Promise.all(red.nodos.map(revisarNodo));
  } finally {
    revisarRed.enCurso = false;
  }
}

function iniciarMonitor() {
  if (!TOKEN || !CHAT_ID) {
    console.warn('Monitor de red no iniciado: faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.');
    return false;
  }
  if (intervalo) return true;

  console.log(`Monitor ECEME iniciado: ${red.nodos.length} nodo(s), cada ${INTERVALO_MS / 1000} s.`);
  revisarRed();
  intervalo = setInterval(revisarRed, INTERVALO_MS);
  return true;
}

if (require.main === module && !iniciarMonitor()) process.exit(1);

module.exports = { iniciarMonitor };
