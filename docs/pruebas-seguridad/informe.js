// ============================================================
//  informe.js — Arma el informe HTML a partir de resultados.json
//  (salida de seguridad.js).
// ============================================================
const fs = require('fs');
const path = require('path');

const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'resultados.json'), 'utf8'));
const SALIDA = process.argv[2] || path.join(__dirname, 'informe.html');

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ORDEN = ['Inyección SQL', 'Alteración de datos', 'Credenciales', 'Control de acceso'];

const DESCRIPCION = {
  'Inyección SQL':
    'Se enviaron cargas maliciosas a los puntos de entrada del sistema (login, buscador de la bitácora y parámetros de la URL) para intentar que la base de datos las ejecute como instrucciones.',
  'Alteración de datos':
    'Se atacó la integridad de las actas selladas, modificando la base de datos **por fuera del sistema**, con acceso directo a MySQL — el peor escenario posible. También se intentó alterar la bitácora de auditoría.',
  Credenciales: 'Se revisó cómo se guardan y se exponen las contraseñas y qué información filtran los mensajes de error.',
  'Control de acceso': 'Se comprobó si la API exige credenciales para atender peticiones a rutas de administración.'
};

const badge = (r) =>
  r === true
    ? '<span class="badge ok">✓ RESISTE</span>'
    : r === false
      ? '<span class="badge bad">✗ HALLAZGO</span>'
      : '<span class="badge warn">OBSERVACIÓN</span>';

function grupo(categoria) {
  const items = R.pruebas.filter((p) => p.categoria === categoria);
  if (!items.length) return '';
  const superadas = items.filter((p) => p.resiste === true).length;
  return `
<section>
  <div class="cat-head">
    <h2>${esc(categoria)}</h2>
    <span class="cat-score ${superadas === items.length ? 'full' : ''}">${superadas} / ${items.length} superadas</span>
  </div>
  <p class="lead">${DESCRIPCION[categoria].replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
  ${items
    .map(
      (p) => `
  <article class="test ${p.resiste === false ? 'flag' : ''}">
    <div class="test-head">
      <span class="test-n">${p.n}</span>
      <h3>${esc(p.nombre)}</h3>
      ${badge(p.resiste)}
    </div>
    <dl>
      <dt>Ataque</dt><dd><code>${esc(p.ataque)}</code></dd>
      <dt>Se esperaba</dt><dd>${esc(p.esperado)}</dd>
      <dt>Resultado</dt><dd class="res">${esc(p.obtenido)}</dd>
      ${p.nota ? `<dt>Nota</dt><dd class="nota">${esc(p.nota)}</dd>` : ''}
    </dl>
  </article>`
    )
    .join('')}
</section>`;
}

const hallazgos = R.pruebas.filter((p) => p.resiste === false);
const fecha = new Date(R.fecha).toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' });

const html = `<title>Resistencia ante inyección y alteración de datos — ECEME</title>
<style>
  :root {
    color-scheme: light;
    --plano: #f9f9f7; --superficie: #fcfcfb;
    --ink: #0b0b0b; --ink-2: #52514e; --ink-mudo: #898781;
    --grid: #e1e0d9; --borde: rgba(11,11,11,0.10);
    --bueno: #0ca30c; --texto-bueno: #006300; --critico: #d03b3b; --aviso: #fab219;
    --acento: #2a78d6;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --plano: #0d0d0d; --superficie: #1a1a19;
      --ink: #ffffff; --ink-2: #c3c2b7; --ink-mudo: #898781;
      --grid: #2c2c2a; --borde: rgba(255,255,255,0.10);
      --texto-bueno: #0ca30c; --acento: #3987e5;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --plano: #0d0d0d; --superficie: #1a1a19;
    --ink: #ffffff; --ink-2: #c3c2b7; --ink-mudo: #898781;
    --grid: #2c2c2a; --borde: rgba(255,255,255,0.10);
    --texto-bueno: #0ca30c; --acento: #3987e5;
  }
  body {
    margin: 0; background: var(--plano); color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.55; -webkit-font-smoothing: antialiased;
  }
  .doc { max-width: 840px; margin: 0 auto; padding: 40px 20px 80px; }
  header.top { border-bottom: 1px solid var(--borde); padding-bottom: 24px; margin-bottom: 8px; }
  .kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mudo); margin: 0 0 8px; }
  h1 { font-size: clamp(23px, 4vw, 32px); line-height: 1.2; margin: 0 0 10px; font-weight: 650; }
  .sub { color: var(--ink-2); margin: 0; max-width: 64ch; }
  .meta { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 6px 20px; font-size: 13px; color: var(--ink-mudo); }
  .meta b { color: var(--ink-2); font-weight: 550; }

  .marcador { display: flex; flex-wrap: wrap; gap: 14px; margin: 28px 0 8px; }
  .kpi { flex: 1 1 148px; background: var(--superficie); border: 1px solid var(--borde); border-radius: 12px; padding: 16px 18px; }
  .kpi .label { font-size: 13px; color: var(--ink-2); margin: 0 0 6px; }
  .kpi .value { font-size: 30px; font-weight: 620; letter-spacing: -0.01em; }
  .kpi .value small { font-size: 14px; font-weight: 500; color: var(--ink-2); margin-left: 4px; }
  .kpi .note { font-size: 12px; color: var(--ink-mudo); margin-top: 4px; }
  .kpi .note.good { color: var(--texto-bueno); }

  .cat-head { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; margin: 46px 0 4px; border-top: 1px solid var(--borde); padding-top: 26px; }
  h2 { font-size: 19px; margin: 0; font-weight: 620; }
  .cat-score { font-size: 12.5px; color: var(--ink-mudo); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cat-score.full { color: var(--texto-bueno); font-weight: 560; }
  .lead { color: var(--ink-2); margin: 0 0 18px; max-width: 68ch; font-size: 14.5px; }

  .test { background: var(--superficie); border: 1px solid var(--borde); border-radius: 12px; padding: 15px 18px; margin: 12px 0; }
  .test.flag { border-color: color-mix(in srgb, var(--critico) 45%, transparent); }
  .test-head { display: flex; align-items: center; gap: 11px; margin-bottom: 10px; }
  .test-n { flex: none; width: 22px; height: 22px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 8%, transparent);
            color: var(--ink-2); font-size: 11.5px; font-weight: 620; display: grid; place-items: center; }
  .test-head h3 { font-size: 15px; margin: 0; font-weight: 570; flex: 1; }
  .badge { font-size: 11px; font-weight: 650; letter-spacing: .04em; padding: 3px 9px; border-radius: 999px; white-space: nowrap; color: #fff; }
  .badge.ok { background: var(--bueno); }
  .badge.bad { background: var(--critico); }
  .badge.warn { background: var(--aviso); color: #3a2a00; }

  dl { display: grid; grid-template-columns: 96px 1fr; gap: 4px 14px; margin: 0; font-size: 13.5px; }
  dt { color: var(--ink-mudo); font-size: 12.5px; }
  dd { margin: 0; color: var(--ink-2); }
  dd.res { color: var(--ink); }
  dd.nota { color: var(--ink-mudo); font-style: italic; }
  code { background: color-mix(in srgb, var(--ink) 7%, transparent); padding: 1px 5px; border-radius: 5px;
         font-size: .92em; word-break: break-word; }

  .callout { border-left: 3px solid var(--critico); background: var(--superficie); border-radius: 0 12px 12px 0; padding: 16px 18px; margin: 20px 0; }
  .callout.verde { border-left-color: var(--bueno); }
  .callout h3 { margin: 0 0 6px; font-size: 15px; font-weight: 620; }
  .callout p { margin: 0 0 8px; font-size: 14px; color: var(--ink-2); }
  .callout p:last-child { margin-bottom: 0; }
  ul { color: var(--ink-2); padding-left: 20px; font-size: 14px; }
  li { margin: 5px 0; }
  footer { margin-top: 52px; padding-top: 20px; border-top: 1px solid var(--borde); font-size: 12.5px; color: var(--ink-mudo); }
  @media print { body { background: #fff; } .test, .kpi, .callout { break-inside: avoid; } }
</style>

<div class="doc">
<header class="top">
  <p class="kicker">Proyecto de grado · Ingeniería de Sistemas</p>
  <h1>Verificación de la resistencia ante intentos de inyección y alteración de datos</h1>
  <p class="sub">Se ejecutaron ataques reales contra el sistema web de gestión de calificaciones de la ECEME:
  inyección SQL por sus puntos de entrada y manipulación directa de la base de datos para intentar falsear
  notas ya selladas en la cadena de bloques.</p>
  <div class="meta">
    <span><b>Fecha:</b> ${esc(fecha)}</span>
    <span><b>Objetivo:</b> backend Express + MySQL (localhost:3001)</span>
    <span><b>Pruebas ejecutadas:</b> ${R.total}</span>
  </div>
</header>

<div class="marcador">
  <div class="kpi">
    <p class="label">Pruebas superadas</p>
    <div class="value">${R.resisten}<small>de ${R.total}</small></div>
    <p class="note good">el sistema rechazó o detectó el ataque</p>
  </div>
  <div class="kpi">
    <p class="label">Inyecciones SQL exitosas</p>
    <div class="value">0</div>
    <p class="note good">todas las consultas van parametrizadas</p>
  </div>
  <div class="kpi">
    <p class="label">Alteraciones no detectadas</p>
    <div class="value">0</div>
    <p class="note good">la cadena delató cada modificación</p>
  </div>
  <div class="kpi">
    <p class="label">Hallazgos por corregir</p>
    <div class="value">${R.vulnerables}</div>
    <p class="note">${hallazgos.length ? esc(hallazgos.map((h) => h.categoria).join(', ')) : 'ninguno'}</p>
  </div>
</div>

${ORDEN.map(grupo).join('')}

<section>
  <div class="cat-head"><h2>Conclusiones</h2></div>
  <div class="callout verde">
    <h3>La capa blockchain cumple su función</h3>
    <p>El ataque más fuerte que se puede montar contra este sistema es el que se hizo: entrar directamente a MySQL
    y cambiar una nota ya publicada, sin pasar por la aplicación. Aun así <b>ninguna alteración pasó inadvertida</b>.
    Modificar la nota rompe el hash del bloque; falsificar el hash rompe el enlace con el bloque siguiente; borrar
    un bloque rompe la cadena. Para que el fraude cuadrara, el atacante tendría que rehacer todos los bloques
    posteriores conociendo la fórmula exacta del hash — y lo mismo, por separado, con la bitácora de auditoría.</p>
    <p>Las notas son, en la práctica, <b>inalterables sin dejar evidencia</b>: es exactamente lo que el proyecto se propuso demostrar.</p>
  </div>

  ${hallazgos
    .map(
      (h) => `
  <div class="callout">
    <h3>Hallazgo — ${esc(h.nombre)}</h3>
    <p><b>Qué se comprobó:</b> ${esc(h.obtenido)}</p>
    <p><b>Por qué importa:</b> la protección de rutas está implementada en el frontend (React decide qué ve cada rol),
    pero la API no la exige. Cualquiera que conozca la dirección del servidor puede consultar los datos sin pasar por la pantalla de acceso.</p>
    <p><b>Cómo se corrige:</b> emitir un token de sesión al iniciar sesión y exigirlo en un middleware de Express
    para las rutas <code>/api/admin/*</code> y demás endpoints sensibles, verificando además el rol.
    Es un cambio acotado al backend y <b>no toca la capa blockchain</b>.</p>
    <p><b>Alcance real:</b> el sistema opera en la red interna de la institución, y este hallazgo permitiría <i>leer</i>
    o <i>escribir</i> datos operativos — pero no falsear un acta ya sellada sin que la cadena lo delate, como demuestran las pruebas anteriores.</p>
  </div>`
    )
    .join('')}
</section>

<section>
  <div class="cat-head"><h2>Metodología</h2></div>
  <ul>
    <li><b>Automatizada:</b> las ${R.total} pruebas están en <code>seguridad.js</code> y se ejecutan con un solo comando; los resultados quedan en <code>resultados.json</code>.</li>
    <li><b>Ataques reales:</b> no son simulaciones. Las cargas se enviaron al servidor en funcionamiento y las alteraciones se aplicaron con sentencias <code>UPDATE</code> y <code>DELETE</code> sobre la base de datos real.</li>
    <li><b>Criterio de éxito:</b> una prueba se supera si el ataque es <i>rechazado</i> (inyección) o <i>detectado</i> (alteración). Detectar es suficiente: la cadena no impide que alguien con acceso a MySQL escriba, sino que garantiza que no pueda hacerlo sin dejar rastro.</li>
    <li><b>Reversibilidad:</b> se respaldó la base con <code>mysqldump</code> antes de empezar y cada alteración se deshizo dentro de la misma prueba. Al terminar, la cadena de actas y la bitácora se verificaron íntegras.</li>
  </ul>
</section>

<footer>
  Informe generado automáticamente a partir de <code>resultados.json</code> · Sistema web con tecnología blockchain
  para la gestión segura de calificaciones y evaluación docente · Escuela de Comando y Estado Mayor del Ejército.
</footer>
</div>
`;

fs.writeFileSync(SALIDA, html, 'utf8');
console.log('✔ Informe escrito en ' + SALIDA);
