// Servidor estático mínimo para abrir informe.html en el navegador
// (necesario para capturar.js, que no puede leer file://).
const http = require('http');
const fs = require('fs');
const p = require('path');

const RAIZ = __dirname;
const PUERTO = process.env.PUERTO || 4599;

http
  .createServer((req, res) => {
    const f = p.join(RAIZ, req.url === '/' ? 'informe.html' : decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, d) => {
      if (e) {
        res.writeHead(404);
        return res.end('404');
      }
      const tipo = f.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : f.endsWith('.png')
          ? 'image/png'
          : f.endsWith('.json')
            ? 'application/json; charset=utf-8'
            : 'text/plain; charset=utf-8';
      res.writeHead(200, { 'Content-Type': tipo });
      res.end(d);
    });
  })
  .listen(PUERTO, () => console.log(`Informe en http://localhost:${PUERTO}`));
