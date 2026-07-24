// ============================================================
//  runner.js — Test de carga y estrés del nodo blockchain (ECEME)
//  Mide la latencia del servidor al VERIFICAR y al SELLAR actas
//  bajo distintos niveles de concurrencia.
// ============================================================
const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = 'http://localhost:3001';
const SALIDA = path.join(__dirname, 'resultados.json');

const resultados = {
  entorno: {
    fecha: new Date().toISOString(),
    node: process.version,
    so: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0].model,
    nucleos: os.cpus().length,
    ram_gb: +(os.totalmem() / 1024 ** 3).toFixed(1)
  },
  fases: {}
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(ruta) {
  const r = await fetch(BASE + ruta);
  return r.json();
}

// Resume la salida de autocannon a las métricas que interesan al informe.
function resumir(r, etiqueta, conexiones) {
  return {
    etiqueta,
    conexiones,
    duracion_s: r.duration,
    lat_prom: r.latency.average,
    lat_p50: r.latency.p50,
    lat_p90: r.latency.p90,
    lat_p99: r.latency.p99,
    lat_max: r.latency.max,
    rps_prom: r.requests.average,
    peticiones_total: r.requests.total,
    bytes_seg: r.throughput.average,
    errores: r.errors,
    timeouts: r.timeouts,
    no_2xx: r.non2xx,
    ok_2xx: r['2xx']
  };
}

async function correr(opts, etiqueta) {
  process.stdout.write(`  ▶ ${etiqueta} (c=${opts.connections}) ... `);
  const r = await autocannon({ timeout: 30, ...opts });
  const s = resumir(r, etiqueta, opts.connections);
  console.log(
    `prom ${s.lat_prom.toFixed(2)}ms | p99 ${s.lat_p99.toFixed(2)}ms | ` +
      `${Math.round(s.rps_prom)} req/s | err ${s.errores} | no2xx ${s.no_2xx}`
  );
  return s;
}

// Mide latencia de una petición aislada (sin concurrencia), n muestras.
async function medirSecuencial(ruta, n) {
  const muestras = [];
  for (let i = 0; i < n; i++) {
    const t = process.hrtime.bigint();
    await fetch(BASE + ruta).then((r) => r.arrayBuffer());
    muestras.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  muestras.sort((a, b) => a - b);
  return {
    n,
    prom: muestras.reduce((a, b) => a + b, 0) / n,
    p50: muestras[Math.floor(n * 0.5)],
    p99: muestras[Math.min(n - 1, Math.floor(n * 0.99))],
    max: muestras[n - 1]
  };
}

async function main() {
  const cadenaInicial = await get('/api/blockchain');
  const registros = cadenaInicial.reduce((acc, b) => {
    const acta = typeof b.acta_json === 'string' ? JSON.parse(b.acta_json) : b.acta_json;
    return acc + (acta.registros ? acta.registros.length : 0);
  }, 0);
  resultados.entorno.bloques_iniciales = cadenaInicial.length;
  resultados.entorno.registros_sellados = registros;
  console.log(
    `\nCadena de partida: ${cadenaInicial.length} bloques, ${registros} registros sellados\n`
  );

  // Calentamiento (JIT + pool de MySQL) para no medir el arranque en frío.
  console.log('Calentamiento…');
  await autocannon({ url: `${BASE}/api/blockchain/verificar`, connections: 5, duration: 5 });
  await esperar(2000);

  // ---------- FASE 1: verificación de la cadena (trabajo criptográfico) ----------
  console.log('\nFASE 1 — GET /api/blockchain/verificar (recalcula toda la cadena)');
  resultados.fases.verificar = [];
  for (const c of [1, 10, 25, 50, 100, 200]) {
    resultados.fases.verificar.push(
      await correr(
        { url: `${BASE}/api/blockchain/verificar`, connections: c, duration: 20 },
        'Verificar cadena'
      )
    );
    await esperar(3000);
  }

  // ---------- FASE 2: lectura simple (sin recálculo de hashes) ----------
  console.log('\nFASE 2 — GET /api/blockchain (lectura simple, sin recalcular hashes)');
  resultados.fases.leer = [];
  for (const c of [1, 10, 50, 100, 200]) {
    resultados.fases.leer.push(
      await correr({ url: `${BASE}/api/blockchain`, connections: c, duration: 10 }, 'Leer cadena')
    );
    await esperar(2000);
  }

  // ---------- FASE 3: escalabilidad — latencia vs. longitud de la cadena ----------
  // Se van sellando bloques y se mide la verificación a cada tamaño.
  console.log('\nFASE 3 — Escalabilidad: latencia de verificación vs. nº de bloques');
  resultados.fases.escalabilidad = [];
  const objetivos = [8, 25, 50, 100, 200, 400];
  let actuales = cadenaInicial.length;
  for (const objetivo of objetivos) {
    while (actuales < objetivo) {
      await fetch(`${BASE}/api/actas/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }).then((r) => r.json());
      actuales++;
    }
    const m = await medirSecuencial('/api/blockchain/verificar', 30);
    resultados.fases.escalabilidad.push({ bloques: actuales, ...m });
    console.log(
      `  ▶ ${actuales} bloques → prom ${m.prom.toFixed(2)}ms | p99 ${m.p99.toFixed(2)}ms`
    );
  }

  // ---------- FASE 4: sellado de bloques (escritura en la cadena) ----------
  console.log('\nFASE 4 — POST /api/actas/publicar (sellado de un bloque nuevo)');
  resultados.fases.sellar = [];
  for (const c of [1, 5, 10]) {
    resultados.fases.sellar.push(
      await correr(
        {
          url: `${BASE}/api/actas/publicar`,
          connections: c,
          amount: 100, // por petición se crea UN bloque: se limita el total
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        },
        'Sellar bloque'
      )
    );
    await esperar(2000);
  }

  // Estado de la cadena tras el bombardeo de escrituras concurrentes.
  const cadenaFinal = await get('/api/blockchain');
  const indices = cadenaFinal.map((b) => b.indice);
  const duplicados = indices.length - new Set(indices).size;
  const verif = await get('/api/blockchain/verificar');
  resultados.fases.integridad_post_estres = {
    bloques: cadenaFinal.length,
    indices_duplicados: duplicados,
    cadena_valida: verif.valida,
    primer_error: verif.primer_error || null
  };
  console.log(
    `\nEstado tras el estrés: ${cadenaFinal.length} bloques | índices duplicados: ${duplicados} | ` +
      `cadena válida: ${verif.valida}`
  );

  fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 2));
  console.log(`\n✔ Resultados guardados en ${SALIDA}`);
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
