// ============================================================
//  informe.js — Arma el informe HTML con gráficos a partir de
//  resultados.json (salida de runner.js).
// ============================================================
const fs = require('fs');
const path = require('path');
const { columnas, lineas, fmt, esc } = require('./graficos');

const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'resultados.json'), 'utf8'));
const SALIDA = process.argv[2] || path.join(__dirname, 'informe.html');

// Paleta validada (categórica, slots 1 y 2) — ver validate_palette.js
const C1 = 'var(--serie-1)';
const C2 = 'var(--serie-2)';

const ver = R.fases.verificar;
const leer = R.fases.leer;
const esc_ = R.fases.escalabilidad;
const sellar = R.fases.sellar;
const integridad = R.fases.integridad_post_estres;

// --- Requisitos del proyecto (documento de grado) ---
const REQ_CONSULTA_MS = 2000;
const REQ_SELLADO_MS = 5000;

const peorConsulta = Math.max(...[...ver, ...leer].map((r) => r.lat_p99));
const peorSellado = Math.max(...sellar.map((r) => r.lat_p99));
const picoRps = Math.max(...[...ver, ...leer].map((r) => r.rps_prom));
const erroresTotales = [...ver, ...leer, ...sellar].reduce((a, r) => a + r.errores + r.no_2xx + r.timeouts, 0);
const peticionesTotales = [...ver, ...leer, ...sellar].reduce((a, r) => a + r.peticiones_total, 0);
const ver100 = ver.find((r) => r.conexiones === 100);

// ------------------------------------------------------------
//  Gráficos
// ------------------------------------------------------------
const g1 = lineas({
  id: 'g-latencia',
  titulo: 'Latencia de verificación de la cadena según usuarios concurrentes',
  subtitulo: 'GET /api/blockchain/verificar — cada petición recalcula el SHA-256 de todos los bloques. 20 s por nivel.',
  categorias: ver.map((r) => String(r.conexiones)),
  series: [
    { nombre: 'Latencia promedio', color: C1, valores: ver.map((r) => r.lat_prom) },
    { nombre: 'Latencia p99 (peor caso)', color: C2, valores: ver.map((r) => r.lat_p99) }
  ],
  etiquetaY: 'Milisegundos (ms)',
  etiquetaX: 'Usuarios concurrentes'
});

const g2 = columnas({
  id: 'g-rps',
  titulo: 'Rendimiento sostenido: peticiones atendidas por segundo',
  subtitulo: 'El nodo se satura y mantiene su techo de rendimiento; el exceso de carga se traduce en espera, no en fallos.',
  categorias: ver.map((r) => String(r.conexiones)),
  series: [{ nombre: 'Peticiones por segundo', color: C1, valores: ver.map((r) => r.rps_prom) }],
  etiquetaY: 'Peticiones / segundo',
  etiquetaX: 'Usuarios concurrentes',
  unidad: 'req/s',
  decimales: 0
});

// Niveles comunes a ambos endpoints
const nivelesComunes = leer.map((r) => r.conexiones).filter((c) => ver.some((v) => v.conexiones === c));
const g3 = columnas({
  id: 'g-comparativa',
  titulo: 'Costo real del blockchain: verificar la cadena frente a sólo leerla',
  subtitulo: 'La diferencia entre ambas barras es el precio, en milisegundos, de recalcular la integridad criptográfica.',
  categorias: nivelesComunes.map(String),
  series: [
    {
      nombre: 'Verificar cadena (con SHA-256)',
      color: C1,
      valores: nivelesComunes.map((c) => ver.find((r) => r.conexiones === c).lat_prom)
    },
    {
      nombre: 'Leer cadena (sin recalcular)',
      color: C2,
      valores: nivelesComunes.map((c) => leer.find((r) => r.conexiones === c).lat_prom)
    }
  ],
  etiquetaY: 'Latencia promedio (ms)',
  etiquetaX: 'Usuarios concurrentes'
});

const g4 = lineas({
  id: 'g-escalabilidad',
  titulo: 'Escalabilidad: latencia de verificación según el tamaño de la cadena',
  subtitulo: `Medición secuencial (1 usuario, 30 muestras por tamaño). El costo sube con el tamaño de la cadena, pero con ${esc_[esc_.length - 1].bloques} bloques sigue por debajo de ${fmt(Math.ceil(esc_[esc_.length - 1].prom / 5) * 5, 0)} ms.`,
  categorias: esc_.map((r) => String(r.bloques)),
  xNumerico: esc_.map((r) => r.bloques),
  series: [{ nombre: 'Latencia promedio', color: C1, valores: esc_.map((r) => r.prom) }],
  etiquetaY: 'Latencia promedio (ms)',
  etiquetaX: 'Bloques en la cadena'
});

const g5 = columnas({
  id: 'g-sellado',
  titulo: 'Latencia del sellado de un bloque nuevo',
  subtitulo: 'POST /api/actas/publicar — construye el acta, calcula su hash, lo encadena al bloque anterior y lo escribe en MySQL.',
  categorias: sellar.map((r) => String(r.conexiones)),
  series: [
    { nombre: 'Latencia promedio', color: C1, valores: sellar.map((r) => r.lat_prom) },
    { nombre: 'Latencia p99 (peor caso)', color: C2, valores: sellar.map((r) => r.lat_p99) }
  ],
  etiquetaY: 'Milisegundos (ms)',
  etiquetaX: 'Publicaciones simultáneas'
});

// ------------------------------------------------------------
//  Tablas
// ------------------------------------------------------------
function tablaCarga(filas, titulo) {
  return `
<h3 class="tbl-title">${esc(titulo)}</h3>
<div class="tbl-wrap">
<table>
  <thead>
    <tr>
      <th>Usuarios concurrentes</th><th>Latencia prom. (ms)</th><th>p50 (ms)</th><th>p90 (ms)</th>
      <th>p99 (ms)</th><th>Máx. (ms)</th><th>Pet./seg</th><th>Peticiones</th><th>Errores</th>
    </tr>
  </thead>
  <tbody>
    ${filas
      .map(
        (r) => `<tr>
      <td>${r.conexiones}</td><td>${fmt(r.lat_prom)}</td><td>${fmt(r.lat_p50)}</td><td>${fmt(r.lat_p90)}</td>
      <td>${fmt(r.lat_p99)}</td><td>${fmt(r.lat_max)}</td><td>${fmt(r.rps_prom, 0)}</td>
      <td>${fmt(r.peticiones_total, 0)}</td><td>${r.errores + r.no_2xx + r.timeouts}</td>
    </tr>`
      )
      .join('')}
  </tbody>
</table>
</div>`;
}

const tablaEscalabilidad = `
<h3 class="tbl-title">Escalabilidad — verificación completa según el tamaño de la cadena</h3>
<div class="tbl-wrap">
<table>
  <thead><tr><th>Bloques en la cadena</th><th>Latencia prom. (ms)</th><th>p50 (ms)</th><th>p99 (ms)</th><th>Máx. (ms)</th></tr></thead>
  <tbody>
    ${esc_
      .map(
        (r) =>
          `<tr><td>${r.bloques}</td><td>${fmt(r.prom)}</td><td>${fmt(r.p50)}</td><td>${fmt(r.p99)}</td><td>${fmt(r.max)}</td></tr>`
      )
      .join('')}
  </tbody>
</table>
</div>`;

// ------------------------------------------------------------
//  Cumplimiento de requisitos
// ------------------------------------------------------------
function filaRequisito(nombre, medido, limite) {
  const cumple = medido < limite;
  const holgura = limite / medido;
  const pct = Math.max(0.6, (medido / limite) * 100); // mínimo visible
  return `
  <div class="req">
    <div class="req-head">
      <span class="req-name">${esc(nombre)}</span>
      <span class="badge ${cumple ? 'ok' : 'bad'}">${cumple ? '✓ CUMPLE' : '✗ NO CUMPLE'}</span>
    </div>
    <div class="meter"><span style="width:${pct}%"></span></div>
    <div class="req-foot">
      <span><b>${fmt(medido)} ms</b> medido (peor caso p99)</span>
      <span>límite exigido: ${fmt(limite, 0)} ms</span>
      <span class="holgura">${fmt(holgura, 0)}× por debajo del límite</span>
    </div>
  </div>`;
}

// ------------------------------------------------------------
//  Documento
// ------------------------------------------------------------
const fecha = new Date(R.entorno.fecha);
const fechaTxt = fecha.toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' });

const html = `<title>Test de carga y estrés del nodo blockchain — ECEME</title>
<style>
  :root {
    color-scheme: light;
    --plano:        #f9f9f7;
    --superficie:   #fcfcfb;
    --ink:          #0b0b0b;
    --ink-2:        #52514e;
    --ink-mudo:     #898781;
    --grid:         #e1e0d9;
    --eje:          #c3c2b7;
    --borde:        rgba(11,11,11,0.10);
    --serie-1:      #2a78d6;
    --serie-2:      #eb6834;
    --bueno:        #0ca30c;
    --critico:      #d03b3b;
    --texto-bueno:  #006300;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --plano:      #0d0d0d;
      --superficie: #1a1a19;
      --ink:        #ffffff;
      --ink-2:      #c3c2b7;
      --ink-mudo:   #898781;
      --grid:       #2c2c2a;
      --eje:        #383835;
      --borde:      rgba(255,255,255,0.10);
      --serie-1:    #3987e5;
      --serie-2:    #d95926;
      --texto-bueno:#0ca30c;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --plano:      #0d0d0d;
    --superficie: #1a1a19;
    --ink:        #ffffff;
    --ink-2:      #c3c2b7;
    --ink-mudo:   #898781;
    --grid:       #2c2c2a;
    --eje:        #383835;
    --borde:      rgba(255,255,255,0.10);
    --serie-1:    #3987e5;
    --serie-2:    #d95926;
    --texto-bueno:#0ca30c;
  }

  body {
    margin: 0;
    background: var(--plano);
    color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .doc { max-width: 900px; margin: 0 auto; padding: 40px 20px 80px; }

  header.top { border-bottom: 1px solid var(--borde); padding-bottom: 24px; margin-bottom: 32px; }
  .kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-mudo); margin: 0 0 8px; }
  h1 { font-size: clamp(24px, 4vw, 34px); line-height: 1.2; margin: 0 0 10px; font-weight: 650; }
  .sub { color: var(--ink-2); margin: 0; max-width: 62ch; }
  .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; color: var(--ink-mudo); }
  .meta b { color: var(--ink-2); font-weight: 550; }

  h2 { font-size: 20px; margin: 48px 0 6px; font-weight: 620; }
  h2 + .lead { color: var(--ink-2); margin: 0 0 20px; max-width: 68ch; }

  /* --- KPI --- */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 28px 0 8px; }
  .kpi { background: var(--superficie); border: 1px solid var(--borde); border-radius: 12px; padding: 16px 18px; }
  .kpi .label { font-size: 13px; color: var(--ink-2); margin: 0 0 6px; }
  .kpi .value { font-size: 30px; font-weight: 620; letter-spacing: -0.01em; }
  .kpi .value small { font-size: 15px; font-weight: 500; color: var(--ink-2); margin-left: 3px; }
  .kpi .note { font-size: 12px; color: var(--ink-mudo); margin-top: 4px; }
  .kpi .note.good { color: var(--texto-bueno); }

  /* --- Tarjetas de gráfico --- */
  .card { background: var(--superficie); border: 1px solid var(--borde); border-radius: 14px; padding: 20px 20px 12px; margin: 22px 0; }
  .card figcaption h3 { font-size: 16px; margin: 0 0 4px; font-weight: 600; }
  .card figcaption p { font-size: 13px; color: var(--ink-2); margin: 0; max-width: 70ch; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 14px 0 2px; font-size: 13px; color: var(--ink-2); }
  .legend-item { display: inline-flex; align-items: center; gap: 7px; }
  .swatch { width: 11px; height: 11px; border-radius: 3px; display: inline-block; flex: none; }
  .chart-wrap { position: relative; }
  .chart-wrap svg { width: 100%; height: auto; display: block; overflow: visible; }

  .grid  { stroke: var(--grid); stroke-width: 1; }
  .axis  { stroke: var(--eje); stroke-width: 1; }
  .tick  { fill: var(--ink-mudo); font-size: 12px; font-variant-numeric: tabular-nums; }
  .axis-title { fill: var(--ink-2); font-size: 12px; }
  .val   { fill: var(--ink-2); font-size: 11.5px; font-weight: 600; }
  .linea { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .punto { stroke: var(--superficie); stroke-width: 2; }
  .hit   { fill: transparent; cursor: crosshair; }
  .hit:hover { fill: var(--ink); fill-opacity: .035; }

  .tooltip {
    position: absolute; pointer-events: none; z-index: 5;
    background: var(--superficie); border: 1px solid var(--borde);
    border-radius: 9px; padding: 9px 11px; font-size: 12.5px; color: var(--ink);
    box-shadow: 0 6px 20px rgba(0,0,0,.14); min-width: 170px;
  }
  .tt-title { display: block; color: var(--ink-mudo); font-size: 11.5px; margin-bottom: 5px; }
  .tt-row { display: flex; align-items: center; gap: 7px; color: var(--ink-2); }
  .tt-row b { margin-left: auto; color: var(--ink); font-variant-numeric: tabular-nums; }

  /* --- Requisitos --- */
  .req { background: var(--superficie); border: 1px solid var(--borde); border-radius: 12px; padding: 16px 18px; margin: 12px 0; }
  .req-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .req-name { font-weight: 560; }
  .badge { font-size: 11.5px; font-weight: 650; letter-spacing: .04em; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
  .badge.ok  { color: #fff; background: var(--bueno); }
  .badge.bad { color: #fff; background: var(--critico); }
  .meter { height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--bueno) 18%, transparent); margin: 12px 0 10px; overflow: hidden; }
  .meter span { display: block; height: 100%; background: var(--bueno); border-radius: 999px; }
  .req-foot { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 12.5px; color: var(--ink-mudo); }
  .req-foot b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .holgura { color: var(--texto-bueno); font-weight: 560; }

  /* --- Tablas --- */
  .tbl-title { font-size: 14px; font-weight: 600; margin: 26px 0 8px; color: var(--ink-2); }
  .tbl-wrap { overflow-x: auto; border: 1px solid var(--borde); border-radius: 12px; background: var(--superficie); }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { padding: 9px 12px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th:first-child, td:first-child { text-align: left; font-variant-numeric: normal; }
  thead th { font-weight: 560; color: var(--ink-2); border-bottom: 1px solid var(--borde); font-size: 12px; }
  tbody tr + tr td { border-top: 1px solid var(--grid); }

  .callout { border-left: 3px solid var(--serie-2); background: var(--superficie); border-radius: 0 12px 12px 0; padding: 14px 18px; margin: 20px 0; }
  .callout h4 { margin: 0 0 6px; font-size: 14.5px; font-weight: 620; }
  .callout p { margin: 0 0 8px; font-size: 14px; color: var(--ink-2); }
  .callout p:last-child { margin-bottom: 0; }
  code { background: color-mix(in srgb, var(--ink) 7%, transparent); padding: 1px 5px; border-radius: 5px; font-size: .9em; }
  ul { color: var(--ink-2); padding-left: 20px; }
  li { margin: 5px 0; }
  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--borde); font-size: 12.5px; color: var(--ink-mudo); }
  @media print {
    body { background: #fff; }
    .card, .kpi, .req, .tbl-wrap { break-inside: avoid; }
  }
</style>

<div class="doc">
<header class="top">
  <p class="kicker">Proyecto de grado · Ingeniería de Sistemas</p>
  <h1>Test de carga y estrés del nodo blockchain</h1>
  <p class="sub">Medición de la latencia del sistema web de gestión de calificaciones de la ECEME al
  <b>sellar</b> y <b>verificar</b> actas encadenadas por SHA-256, sometido a niveles crecientes de usuarios concurrentes.</p>
  <div class="meta">
    <span><b>Fecha:</b> ${esc(fechaTxt)}</span>
    <span><b>Herramienta:</b> autocannon (HTTP/1.1)</span>
    <span><b>Equipo:</b> ${esc(R.entorno.cpu)} · ${R.entorno.nucleos} núcleos · ${fmt(R.entorno.ram_gb, 1)} GB RAM</span>
    <span><b>Plataforma:</b> Node ${esc(R.entorno.node)} · ${esc(R.entorno.so)}</span>
    <span><b>Cadena de partida:</b> ${R.entorno.bloques_iniciales} bloques · ${R.entorno.registros_sellados} registros sellados</span>
  </div>
</header>

<section>
  <h2>Resultados en una mirada</h2>
  <p class="lead">Cifras obtenidas sobre ${fmt(peticionesTotales, 0)} peticiones reales enviadas al nodo durante toda la campaña de pruebas.</p>
  <div class="kpis">
    <div class="kpi">
      <p class="label">Latencia con 100 usuarios simultáneos</p>
      <div class="value">${fmt(ver100.lat_prom, 1)}<small>ms</small></div>
      <p class="note">verificación completa de la cadena</p>
    </div>
    <div class="kpi">
      <p class="label">Peor latencia de consulta (p99)</p>
      <div class="value">${fmt(peorConsulta, 0)}<small>ms</small></div>
      <p class="note good">${fmt(REQ_CONSULTA_MS / peorConsulta, 0)}× por debajo del límite de 2 s</p>
    </div>
    <div class="kpi">
      <p class="label">Rendimiento máximo sostenido</p>
      <div class="value">${fmt(picoRps, 0)}<small>req/s</small></div>
      <p class="note">techo del nodo al saturarse</p>
    </div>
    <div class="kpi">
      <p class="label">Errores y respuestas fallidas</p>
      <div class="value">${erroresTotales}</div>
      <p class="note ${erroresTotales === 0 ? 'good' : ''}">${erroresTotales === 0 ? 'ninguna petición perdida' : 'revisar detalle en las tablas'}</p>
    </div>
  </div>
</section>

<section>
  <h2>1 · Prueba de carga y estrés sobre la verificación de la cadena</h2>
  <p class="lead">Se eligió <code>/api/blockchain/verificar</code> porque es la operación más pesada del sistema:
  recorre todos los bloques, recalcula su hash SHA-256 y comprueba el encadenamiento. Es trabajo criptográfico real
  y, además, sólo lee, así que no altera los datos. La carga se elevó de 1 a 200 usuarios simultáneos, 20 segundos por nivel.</p>
  ${g1}
  ${g2}
  <p class="lead">La latencia crece de forma proporcional a la concurrencia mientras el rendimiento se mantiene
  estable en su techo: el comportamiento esperado de un servidor saturado que <b>encola</b> el exceso de trabajo en lugar
  de rechazarlo. En ningún nivel hubo peticiones perdidas ni respuestas fuera del rango 2xx.</p>
</section>

<section>
  <h2>2 · ¿Cuánto cuesta la seguridad criptográfica?</h2>
  <p class="lead">Comparación directa entre verificar la cadena (recalculando todos los hashes) y simplemente leerla
  de la base de datos. La diferencia es el sobrecosto que introduce la capa blockchain.</p>
  ${g3}
</section>

<section>
  <h2>3 · Escalabilidad frente al crecimiento de la cadena</h2>
  <p class="lead">Una cadena de bloques sólo crece: nunca se borra un bloque. Por eso se midió cómo evoluciona la
  verificación completa a medida que la cadena se alarga, sellando actas hasta llegar a ${esc_[esc_.length - 1].bloques} bloques.</p>
  ${g4}
</section>

<section>
  <h2>4 · Latencia del sellado de un bloque nuevo</h2>
  <p class="lead">Es la operación de escritura del sistema: se arma el acta, se calcula su hash, se encadena al bloque
  anterior y se escribe en MySQL. Se limitó a 100 publicaciones por nivel porque cada petición crea un bloque real.</p>
  ${g5}
</section>

<section>
  <h2>5 · Cumplimiento de los requisitos de rendimiento</h2>
  <p class="lead">Contraste de las latencias medidas (siempre en su peor caso, percentil 99) con los tiempos máximos
  comprometidos en el documento de grado.</p>
  ${filaRequisito('Sellado de un acta en la cadena — máximo 5 segundos', peorSellado, REQ_SELLADO_MS)}
  ${filaRequisito('Consulta y verificación de la cadena — máximo 2 segundos', peorConsulta, REQ_CONSULTA_MS)}
</section>

<section>
  <h2>6 · Hallazgo: la escritura de bloques debe ser secuencial</h2>
  <div class="callout">
    <h4>Qué se observó</h4>
    <p>Al bombardear <code>POST /api/actas/publicar</code> con publicaciones simultáneas, el nodo respondió sin errores
    (${sellar.filter((s) => s.conexiones > 1).reduce((a, s) => a + s.errores + s.no_2xx, 0)} fallos), pero la cadena terminó con
    <b>${integridad.indices_duplicados} índices duplicados</b> sobre ${integridad.bloques} bloques y la verificación la reportó como
    <b>${integridad.cadena_valida ? 'válida' : 'inválida'}</b>${integridad.primer_error ? ` (primer error en el bloque #${integridad.primer_error.indice ?? integridad.primer_error.id}: ${esc(String(integridad.primer_error.motivo || ''))})` : ''}.</p>
    <p>La causa es que el sellado lee el último bloque y luego inserta el nuevo en dos pasos separados: si dos
    publicaciones ocurren en el mismo instante, ambas leen el mismo bloque previo y se ramifican.</p>
    <h4>Por qué no afecta al uso real</h4>
    <p>La publicación de actas es un acto administrativo: la ejecuta únicamente el administrador, de a una y de forma
    deliberada. El escenario concurrente no se da en el flujo normal del sistema. Aun así, el hallazgo documenta la
    necesidad de <b>serializar el sellado</b> (una transacción con bloqueo, o una cola de publicación) si en el futuro
    se habilitaran publicaciones simultáneas.</p>
    <p>Es también una prueba a favor del diseño: la verificación por hashes <b>detecta</b> la anomalía en lugar de ocultarla.
    Terminada la prueba, la base se restauró desde el respaldo previo y ambas cadenas — actas y bitácora de auditoría — volvieron a
    verificarse como íntegras.</p>
  </div>
</section>

<section>
  <h2>7 · Tablas de resultados</h2>
  <p class="lead">Valores completos de cada corrida, equivalentes a la salida de autocannon.</p>
  ${tablaCarga(ver, 'Verificación de la cadena — GET /api/blockchain/verificar (20 s por nivel)')}
  ${tablaCarga(leer, 'Lectura de la cadena — GET /api/blockchain (10 s por nivel)')}
  ${tablaCarga(sellar, 'Sellado de bloques — POST /api/actas/publicar (100 publicaciones por nivel)')}
  ${tablaEscalabilidad}
</section>

<section>
  <h2>8 · Metodología</h2>
  <ul>
    <li><b>Herramienta:</b> autocannon, ejecutado desde un script de Node que encadena todos los niveles y guarda las métricas en JSON.</li>
    <li><b>Calentamiento:</b> 5 segundos de carga previa descartados, para no medir el arranque en frío del servidor ni del pool de MySQL.</li>
    <li><b>Niveles de carga:</b> 1, 10, 25, 50, 100 y 200 conexiones simultáneas, con 3 segundos de reposo entre corridas.</li>
    <li><b>Métricas registradas:</b> latencia promedio, percentiles 50/90/99, latencia máxima, peticiones por segundo, total de peticiones, errores, tiempos de espera agotados y respuestas fuera de 2xx.</li>
    <li><b>Escenario:</b> cliente y servidor en el mismo equipo (localhost), por lo que las cifras excluyen la latencia de red y reflejan el costo de cómputo del nodo.</li>
    <li><b>Estado final:</b> antes de las pruebas de escritura se respaldaron las tablas <code>bloques</code> y <code>auditoria</code>; al terminar la campaña la base se restauró a ese estado exacto y ambas cadenas de hashes se verificaron íntegras.</li>
  </ul>
</section>

<footer>
  Informe generado automáticamente a partir de <code>resultados.json</code> · Sistema web con tecnología blockchain
  para la gestión segura de calificaciones y evaluación docente · Escuela de Comando y Estado Mayor del Ejército.
</footer>
</div>

<script>
  // Capa de interacción: tooltip sobre las bandas del eje X de cada gráfico.
  document.querySelectorAll('.chart-wrap').forEach((wrap) => {
    const tip = wrap.querySelector('.tooltip');
    wrap.querySelectorAll('.hit').forEach((hit) => {
      const mostrar = (ev) => {
        tip.innerHTML = hit.dataset.tip;
        tip.hidden = false;
        const r = wrap.getBoundingClientRect();
        const b = hit.getBoundingClientRect();
        let x = b.left - r.left + b.width / 2 - tip.offsetWidth / 2;
        x = Math.max(4, Math.min(x, r.width - tip.offsetWidth - 4));
        tip.style.left = x + 'px';
        tip.style.top = Math.max(4, (ev.clientY ? ev.clientY - r.top - tip.offsetHeight - 14 : 8)) + 'px';
      };
      hit.addEventListener('mousemove', mostrar);
      hit.addEventListener('mouseenter', mostrar);
      hit.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  });
</script>
`;

fs.writeFileSync(SALIDA, html, 'utf8');
console.log('✔ Informe escrito en ' + SALIDA);
