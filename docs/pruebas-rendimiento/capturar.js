// ============================================================
//  capturar.js — Renderiza el informe y exporta la página completa,
//  cada gráfico en PNG y una versión en PDF (tamaño carta).
//  Requiere que informe.html se esté sirviendo por HTTP (ver README).
// ============================================================
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const DOCS = __dirname;
const IMG = path.join(DOCS, 'graficos');
const URL_INFORME = process.env.URL_INFORME || 'http://localhost:4599/';

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1400, deviceScaleFactor: 2 });
  await page.goto(URL_INFORME, { waitUntil: 'networkidle0' });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));

  await page.screenshot({ path: path.join(DOCS, 'informe-completo.png'), fullPage: true });

  const tarjetas = await page.$$('figure.card');
  for (const t of tarjetas) {
    const id = await t.evaluate((el) => el.id);
    await t.screenshot({ path: path.join(IMG, `${id}.png`) });
  }

  // Bloques del informe que no son gráficos pero conviene exportar igual.
  for (const [sel, nombre] of [
    ['header.top', 'cabecera'],
    ['.kpis', 'resumen-kpis'],
    ['section:nth-of-type(6)', 'cumplimiento-requisitos']
  ]) {
    const el = await page.$(sel);
    if (el) await el.screenshot({ path: path.join(IMG, `${nombre}.png`) });
  }

  // Comprobaciones de maquetación: desbordes horizontales y textos recortados.
  const diag = await page.evaluate(() => {
    const overflowH = document.documentElement.scrollWidth > window.innerWidth + 1;
    const cortados = [];
    document.querySelectorAll('.card svg text').forEach((t) => {
      const b = t.getBBox();
      const vb = t.ownerSVGElement.viewBox.baseVal;
      if (b.x < -4 || b.x + b.width > vb.width + 4) cortados.push(t.textContent + ' @' + Math.round(b.x));
    });
    return {
      overflowH,
      cortados,
      alto: document.body.scrollHeight,
      graficos: document.querySelectorAll('figure.card').length
    };
  });

  console.log(JSON.stringify({ ...diag, errores }, null, 2));

  // Versión PDF lista para adjuntar al documento de grado.
  await page.pdf({
    path: path.join(DOCS, 'informe.pdf'),
    format: 'Letter',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' }
  });

  await browser.close();
})();
