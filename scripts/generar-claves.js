// ============================================================
//  scripts/generar-claves.js — IDENTIDADES DE LA RED
// ------------------------------------------------------------
//  Genera el par de claves Ed25519 de cada nodo y escribe el registro de
//  permisos red-permisionada.json con las claves PÚBLICAS.
//
//  Uso:  npm run red:claves     (desde la raíz)
//
//  Es idempotente: si un nodo ya tiene su clave privada, la conserva y
//  vuelve a publicar la pública que le corresponde. Así se puede correr
//  de nuevo sin invalidar las firmas de los bloques ya sellados.
//  Las claves privadas quedan en claves/, que git ignora.
// ============================================================
const fs = require('fs');
const path = require('path');
const { generarParDeClaves, ARCHIVO_RED } = require('../red/identidad');

// Definición de la red. El quórum es 2 de 3: con un nodo caído se sigue
// sellando; con dos caídos, no.
const QUORUM = 2;
const NODOS = [
  { nodeId: 'nodo-1', nombre: 'VALIDADOR-PRINCIPAL', url: 'http://localhost:3001', rol: 'proponente',
    descripcion: 'Servidor académico de la ECEME. Propone los bloques y expone la API.' },
  { nodeId: 'nodo-2', nombre: 'AUDITOR-A', url: 'http://localhost:3002', rol: 'auditor',
    descripcion: 'Nodo auditor independiente. Valida y firma; guarda su propia copia.' },
  { nodeId: 'nodo-3', nombre: 'AUDITOR-B', url: 'http://localhost:3003', rol: 'auditor',
    descripcion: 'Nodo auditor independiente. Valida y firma; guarda su propia copia.' }
];

const nodos = NODOS.map(n => {
  const { publica, yaExistia } = generarParDeClaves(n.nodeId);
  console.log(`  ${yaExistia ? '·' : '✓'} ${n.nodeId} (${n.nombre}) ${yaExistia ? 'ya tenía claves, se conservan' : 'claves nuevas generadas'}`);
  return { ...n, clave_publica: publica };
});

const red = {
  red: 'ECEME — cadena privada permisionada',
  descripcion: 'Registro de permisos: solo los nodos listados aquí pueden firmar bloques. ' +
               'Las claves privadas viven en claves/ y nunca se versionan.',
  algoritmo_firma: 'Ed25519',
  algoritmo_hash: 'SHA-256',
  quorum: QUORUM,
  total_nodos: nodos.length,
  nodos
};

fs.writeFileSync(ARCHIVO_RED, JSON.stringify(red, null, 2) + '\n', 'utf8');
console.log(`\nRegistro de permisos escrito en ${path.basename(ARCHIVO_RED)}`);
console.log(`Quórum: ${QUORUM} de ${nodos.length} firmas para confirmar un bloque.`);
