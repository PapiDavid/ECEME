// ============================================================
//  scripts/crear-bd-nodos.js — COPIAS DE LOS NODOS AUDITORES
// ------------------------------------------------------------
//  Crea los esquemas eceme_nodo_2 y eceme_nodo_3, cada uno con su propia
//  tabla `bloques`. Es lo que hace que la replicación sea real: cada nodo
//  guarda su copia por separado y una alteración en la copia de uno se
//  detecta comparándola contra las otras.
//
//  Uso:  npm run red:bd     (desde la raíz)
//
//  Ejecuta el mismo SQL que apps/server/crear-bd-nodos.sql, pero desde Node
//  para no depender de dónde esté instalado el cliente mysql en Windows.
//  Es repetible: usa IF NOT EXISTS, no borra copias existentes.
// ============================================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'server', '.env') });

const ARCHIVO_SQL = path.join(__dirname, '..', 'apps', 'server', 'crear-bd-nodos.sql');

const conexion = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true   // el archivo trae varias sentencias
});

const sql = fs.readFileSync(ARCHIVO_SQL, 'utf8');

conexion.query(sql, (err, resultados) => {
  if (err) {
    console.error('No se pudieron crear las bases de los nodos:', err.message);
    conexion.end();
    process.exit(1);
  }
  // La última sentencia del archivo es un SELECT de comprobación
  const comprobacion = resultados[resultados.length - 1];
  if (Array.isArray(comprobacion)) {
    comprobacion.forEach(f => console.log(`  ✓ ${f.base_creada}`));
  }
  console.log('\nCopias de los auditores listas. Cada nodo guarda su cadena por separado.');
  conexion.end();
});
