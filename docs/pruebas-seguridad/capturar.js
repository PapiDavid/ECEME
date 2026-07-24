// Renderiza el informe y exporta captura PNG y PDF (tamaño carta).
const puppeteer = require('puppeteer');
const path = require('path');

const DOCS = __dirname;
const URL_INFORME = process.env.URL_INFORME || 'http://localhost:4599/';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(URL_INFORME, { waitUntil: 'networkidle0' });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  await page.screenshot({ path: path.join(DOCS, 'informe-completo.png'), fullPage: true });

  for (const [sel, nombre] of [
    ['.marcador', 'marcador'],
    ['section:nth-of-type(2)', 'alteracion-datos']
  ]) {
    const el = await page.$(sel);
    if (el) await el.screenshot({ path: path.join(DOCS, `${nombre}.png`) });
  }

  const diag = await page.evaluate(() => ({
    overflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
    alto: document.body.scrollHeight,
    pruebas: document.querySelectorAll('article.test').length
  }));
  console.log(JSON.stringify({ ...diag, errores }, null, 2));

  await page.pdf({
    path: path.join(DOCS, 'informe.pdf'),
    format: 'Letter',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' }
  });
  await browser.close();
})();
