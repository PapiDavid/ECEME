// ============================================================
//  graficos.js — Constructores de SVG para el informe de carga.
//  Sin librerías externas: cada gráfico es SVG generado a mano.
// ============================================================

const W = 760;
const H = 340;
const PAD = { top: 28, right: 26, bottom: 52, left: 62 };
const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n, d = 2) =>
  Number(n).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d });

// Escala de ticks "redondos" (1, 2, 2.5, 5 × 10^n) para el eje Y.
function ticksBonitos(max, cantidad = 5) {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const bruto = max / cantidad;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const tope = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) ticks.push(+v.toFixed(10));
  return { max: tope, ticks };
}

// Rectángulo con las dos esquinas superiores redondeadas (4px) y base recta.
function barraPath(x, y, w, h, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function ejes(ticks, escalaY, etiquetaY) {
  let s = '';
  for (const t of ticks) {
    const y = escalaY(t);
    s += `<line class="grid" x1="${PAD.left}" y1="${y}" x2="${PAD.left + PLOT.w}" y2="${y}"/>`;
    s += `<text class="tick" x="${PAD.left - 10}" y="${y + 4}" text-anchor="end">${fmt(t, t % 1 === 0 ? 0 : 1)}</text>`;
  }
  s += `<line class="axis" x1="${PAD.left}" y1="${PAD.top + PLOT.h}" x2="${PAD.left + PLOT.w}" y2="${PAD.top + PLOT.h}"/>`;
  s += `<text class="axis-title" transform="translate(16,${PAD.top + PLOT.h / 2}) rotate(-90)" text-anchor="middle">${esc(etiquetaY)}</text>`;
  return s;
}

function leyenda(series) {
  return (
    '<div class="legend">' +
    series
      .map(
        (s) =>
          `<span class="legend-item"><span class="swatch" style="background:${s.color}"></span>${esc(s.nombre)}</span>`
      )
      .join('') +
    '</div>'
  );
}

// ---------- Gráfico de columnas agrupadas (eje X categórico) ----------
// series: [{nombre, color, valores:[…], unidad}]
function columnas({ id, titulo, subtitulo, categorias, series, etiquetaY, etiquetaX, unidad = 'ms', decimales = 2 }) {
  const maxVal = Math.max(...series.flatMap((s) => s.valores));
  const { max, ticks } = ticksBonitos(maxVal);
  const escalaY = (v) => PAD.top + PLOT.h - (v / max) * PLOT.h;
  const banda = PLOT.w / categorias.length;
  const GAP = 2; // separación en color de superficie entre barras vecinas
  const anchoGrupo = Math.min(banda * 0.62, 24 * series.length + GAP * (series.length - 1));
  const anchoBarra = (anchoGrupo - GAP * (series.length - 1)) / series.length;

  let marcas = '';
  let etiquetasCat = '';
  let hits = '';
  categorias.forEach((cat, i) => {
    const cx = PAD.left + banda * i + banda / 2;
    const x0 = cx - anchoGrupo / 2;
    series.forEach((s, j) => {
      const v = s.valores[i];
      const x = x0 + j * (anchoBarra + GAP);
      const y = escalaY(v);
      const h = PAD.top + PLOT.h - y;
      marcas += `<path d="${barraPath(x, y, anchoBarra, h)}" fill="${s.color}"/>`;
      // Valor en la cabeza de la columna sólo cuando hay UNA serie: con dos
      // barras vecinas las etiquetas se pisarían (las lleva el eje y la tabla).
      if (series.length === 1) {
        marcas += `<text class="val" x="${x + anchoBarra / 2}" y="${y - 7}" text-anchor="middle">${fmt(v, decimales)}</text>`;
      }
    });
    etiquetasCat += `<text class="tick" x="${cx}" y="${PAD.top + PLOT.h + 22}" text-anchor="middle">${esc(cat)}</text>`;
    const filas = series
      .map((s) => `<span class="tt-row"><span class="swatch" style="background:${s.color}"></span>${esc(s.nombre)}<b>${fmt(s.valores[i], decimales)} ${unidad}</b></span>`)
      .join('');
    hits += `<rect class="hit" x="${PAD.left + banda * i}" y="${PAD.top}" width="${banda}" height="${PLOT.h}" data-tip="${esc(`<span class='tt-title'>${etiquetaX}: ${cat}</span>${filas}`)}"/>`;
  });

  return tarjeta({
    id,
    titulo,
    subtitulo,
    series: series.length > 1 ? series : null,
    svg:
      ejes(ticks, escalaY, etiquetaY) +
      marcas +
      etiquetasCat +
      `<text class="axis-title" x="${PAD.left + PLOT.w / 2}" y="${H - 8}" text-anchor="middle">${esc(etiquetaX)}</text>` +
      hits
  });
}

// ---------- Gráfico de líneas (eje X categórico o numérico) ----------
// series: [{nombre, color, valores:[…]}]
function lineas({ id, titulo, subtitulo, categorias, series, etiquetaY, etiquetaX, unidad = 'ms', decimales = 2, xNumerico = null }) {
  const maxVal = Math.max(...series.flatMap((s) => s.valores));
  const { max, ticks } = ticksBonitos(maxVal);
  const escalaY = (v) => PAD.top + PLOT.h - (v / max) * PLOT.h;
  let escalaX;
  if (xNumerico) {
    const minX = Math.min(...xNumerico);
    const maxX = Math.max(...xNumerico);
    escalaX = (i) => PAD.left + ((xNumerico[i] - minX) / (maxX - minX)) * PLOT.w;
  } else {
    const banda = PLOT.w / categorias.length;
    escalaX = (i) => PAD.left + banda * i + banda / 2;
  }

  let marcas = '';
  series.forEach((s) => {
    const pts = s.valores.map((v, i) => `${escalaX(i)},${escalaY(v)}`).join(' ');
    marcas += `<polyline class="linea" points="${pts}" stroke="${s.color}"/>`;
  });
  series.forEach((s) => {
    s.valores.forEach((v, i) => {
      marcas += `<circle class="punto" cx="${escalaX(i)}" cy="${escalaY(v)}" r="4.5" fill="${s.color}"/>`;
    });
    // Etiqueta directa sólo en el último punto de cada serie.
    const iUlt = s.valores.length - 1;
    marcas += `<text class="val" x="${escalaX(iUlt) - 6}" y="${escalaY(s.valores[iUlt]) - 12}" text-anchor="end">${fmt(s.valores[iUlt], decimales)}</text>`;
  });

  // Zonas sensibles: con eje X numérico los puntos NO están repartidos por
  // igual, así que el límite entre dos zonas es el punto medio entre vecinos.
  const bordes = categorias.map((_, i) => {
    const izq = i === 0 ? PAD.left : (escalaX(i - 1) + escalaX(i)) / 2;
    const der = i === categorias.length - 1 ? PAD.left + PLOT.w : (escalaX(i) + escalaX(i + 1)) / 2;
    return [izq, der];
  });

  let etiquetasCat = '';
  let hits = '';
  categorias.forEach((cat, i) => {
    const cx = escalaX(i);
    etiquetasCat += `<text class="tick" x="${cx}" y="${PAD.top + PLOT.h + 22}" text-anchor="middle">${esc(cat)}</text>`;
    const filas = series
      .map((s) => `<span class="tt-row"><span class="swatch" style="background:${s.color}"></span>${esc(s.nombre)}<b>${fmt(s.valores[i], decimales)} ${unidad}</b></span>`)
      .join('');
    const [izq, der] = bordes[i];
    hits += `<rect class="hit" x="${izq}" y="${PAD.top}" width="${der - izq}" height="${PLOT.h}" data-tip="${esc(`<span class='tt-title'>${etiquetaX}: ${cat}</span>${filas}`)}"/>`;
  });

  return tarjeta({
    id,
    titulo,
    subtitulo,
    series: series.length > 1 ? series : null,
    svg:
      ejes(ticks, escalaY, etiquetaY) +
      marcas +
      etiquetasCat +
      `<text class="axis-title" x="${PAD.left + PLOT.w / 2}" y="${H - 8}" text-anchor="middle">${esc(etiquetaX)}</text>` +
      hits
  });
}

function tarjeta({ id, titulo, subtitulo, series, svg }) {
  return `
<figure class="card" id="${id}">
  <figcaption>
    <h3>${esc(titulo)}</h3>
    ${subtitulo ? `<p>${esc(subtitulo)}</p>` : ''}
  </figcaption>
  ${series ? leyenda(series) : ''}
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">${svg}</svg>
    <div class="tooltip" hidden></div>
  </div>
</figure>`;
}

module.exports = { columnas, lineas, fmt, esc, tarjeta };
