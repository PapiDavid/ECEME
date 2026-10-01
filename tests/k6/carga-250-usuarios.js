import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Prueba representativa y sin efectos secundarios: todas las rutas son GET
// públicas. No publica actas, no modifica notas ni crea auditorías.
const BASE_URL = (__ENV.BASE_URL || 'http://host.docker.internal:3001').replace(/\/$/, '');
const DURATION_SECONDS = Number(__ENV.DURACION_NIVEL_SEG || 60);
const PAUSA_SECONDS = Number(__ENV.PAUSA_ENTRE_NIVELES_SEG || 10);
const NIVELES = (__ENV.NIVELES || '25,50,100,150,200,250')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isInteger(n) && n > 0);

if (NIVELES.length === 0) {
  throw new Error('NIVELES debe contener al menos un número positivo, por ejemplo 25,50,250');
}

const erroresAplicacion = new Rate('eceme_errores_aplicacion');
const duracionFlujo = new Trend('eceme_flujo_duracion_ms', true);

const scenarios = {};
NIVELES.forEach((usuarios, indice) => {
  scenarios[`usuarios_${usuarios}`] = {
    executor: 'constant-vus',
    vus: usuarios,
    duration: `${DURATION_SECONDS}s`,
    startTime: `${indice * (DURATION_SECONDS + PAUSA_SECONDS)}s`,
    gracefulStop: '15s',
    tags: { usuarios: String(usuarios), tipo_prueba: 'carga_escalonada' },
    exec: 'navegarComoUsuario',
  };
});

export const options = {
  scenarios,
  thresholds: {
    // Objetivos iniciales: ajústelos a su acuerdo de nivel de servicio.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    eceme_errores_aplicacion: ['rate<0.01'],
  },
};

function get(path, etiqueta) {
  const response = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: etiqueta },
    timeout: '15s',
  });
  const correcto = check(response, {
    [`${etiqueta}: HTTP 200`]: (r) => r.status === 200,
    [`${etiqueta}: respuesta no vacía`]: (r) => r.body && r.body.length > 0,
  });
  erroresAplicacion.add(!correcto, { endpoint: etiqueta });
  return response;
}

export function navegarComoUsuario() {
  const inicio = Date.now();
  const selector = Math.random();

  // Distribución basada en páginas públicas frecuentes. La comprobación de
  // blockchain se mantiene baja por ser una operación deliberadamente costosa.
  if (selector < 0.55) get('/api/home/notas', 'inicio_notas');
  else if (selector < 0.75) get('/api/catalogos', 'catalogos');
  else if (selector < 0.93) get('/api/materias', 'materias');
  else get('/api/blockchain/verificar', 'verificar_blockchain');

  duracionFlujo.add(Date.now() - inicio);
  sleep(1 + Math.random() * 2); // tiempo de lectura humano: 1 a 3 segundos
}

