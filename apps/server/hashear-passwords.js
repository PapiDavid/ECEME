// ============================================================
//  MIGRACIÓN ÚNICA: hashea con bcrypt las contraseñas que siguen
//  en texto plano en la tabla `usuarios`.
//
//  - Es IDEMPOTENTE: los hashes bcrypt empiezan con "$2", así que
//    si una clave ya está hasheada no se toca. Se puede correr
//    las veces que haga falta sin dañar nada.
//  - Uso:  npm run hash:pwd   (desde apps/server)
// ============================================================
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const SALT_ROUNDS = 10;

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eceme_db'
});

db.query("SELECT id, identificador, password FROM usuarios", (err, usuarios) => {
  if (err) { console.error('Error leyendo usuarios:', err.message); process.exit(1); }

  const pendientes = usuarios.filter(u => !String(u.password || '').startsWith('$2'));
  console.log(`Usuarios totales: ${usuarios.length} · en texto plano: ${pendientes.length}`);
  if (pendientes.length === 0) { console.log('Nada que migrar: todas las claves ya están hasheadas. ✔'); process.exit(0); }

  let hechos = 0;
  pendientes.forEach(u => {
    const hash = bcrypt.hashSync(String(u.password), SALT_ROUNDS);
    db.query("UPDATE usuarios SET password = ? WHERE id = ?", [hash, u.id], (errU) => {
      if (errU) { console.error(`✗ ${u.identificador}:`, errU.message); }
      else { console.log(`✔ ${u.identificador} → hasheada`); }
      hechos++;
      if (hechos === pendientes.length) { console.log('Migración terminada.'); process.exit(0); }
    });
  });
});
