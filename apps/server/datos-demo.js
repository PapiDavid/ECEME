/**
 * Carga de datos de demostración (docentes y cursantes).
 * ------------------------------------------------------------
 * Sirve para llenar el sistema con personal creíble antes de una
 * presentación, sin escribir a mano en el panel.
 *
 * Uso:  npm run datos:demo   (desde apps/server, con el servidor levantado)
 *
 * Va por la API, NO por INSERT directos, a propósito: así pasa por las
 * validaciones, los códigos CUR-XXX/DOC-XXX se generan solos, las claves
 * quedan hasheadas con bcrypt y todo queda registrado en la auditoría.
 * La blockchain no se toca: estas altas no sellan ningún bloque.
 *
 * Es repetible: si un CI ya existe, la API responde 409 y el script lo
 * cuenta como "ya estaba" en vez de fallar.
 */

const API = process.env.API_URL || 'http://localhost:3001/api';
const PASSWORD = 'ECEME2026';        // clave institucional; entran con primer_login = 1
const CURSANTES_POR_MATERIA = 5;
const MAX_DOCENTES_POR_MATERIA = 3;

// Docentes nuevos. `materias` son NOMBRES: el script los traduce a ids, así
// el archivo no depende de los ids que tenga la base.
const DOCENTES = [
  { nombre: 'RAMIRO GUTIÉRREZ SALAZAR',   grado: 'CORONEL',          materias: ['ORDEN', 'OPERACIONES'] },
  { nombre: 'MARCELO ANTEZANA ROJAS',     grado: 'TENIENTE CORONEL', materias: ['ORDEN'] },
  { nombre: 'GONZALO PEÑARANDA LIMA',     grado: 'CORONEL',          materias: ['OPERACIONES', 'NOCTURNO'] },
  { nombre: 'SILVIA CLAROS MENDOZA',      grado: 'MSC.',             materias: ['TACTICA'] },
  { nombre: 'FERNANDO ARANIBAR CUELLAR',  grado: 'TENIENTE CORONEL', materias: ['NOCTURNO'] },
  { nombre: 'PATRICIA ZEBALLOS DURÁN',    grado: 'DR.',              materias: ['DIURNO'] }
];

// Nombres para los cursantes (oficiales del curso de comando)
const NOMBRES_CURSANTES = [
  'ÁLVARO MONTAÑO VILLARROEL', 'CARLA IBÁÑEZ SORUCO',        'DIEGO MAMANI CHOQUE',
  'ELENA VARGAS PINTO',        'FABIÁN ROCHA GUZMÁN',        'GABRIELA NÚÑEZ ARCE',
  'HUGO CALDERÓN TERCEROS',    'INÉS SALVATIERRA BALDIVIESO','JAVIER ORTUÑO MEDINA',
  'KARINA LEDEZMA PAZ',        'LUIS FERNANDO CABRERA SOLIZ','MÓNICA ESCÓBAR JUSTINIANO',
  'NÉSTOR AGUILAR PEREDO',     'OLIVIA TRIGO MERCADO',       'PABLO ENCINAS ROMERO',
  'QUIRINA LOAYZA SEJAS',      'RODRIGO BUSTAMANTE ALIAGA',  'SOFÍA CHÁVEZ MURILLO',
  'TOMÁS VELASCO ARANIBAR',    'ÚRSULA MALDONADO FLORES',    'VÍCTOR SANDOVAL CLAURE',
  'WALTER PANOZO ZAMBRANA',    'XIMENA ROJAS DALENCE',       'YAMIL SUÁREZ BANEGAS',
  'ZULMA CÉSPEDES ANTELO',     'ADRIÁN GUEVARA MOSTAJO',     'BEATRIZ QUISPE LAIME',
  'CÉSAR ARIAS BOZO',          'DANIELA MURILLO SEOANE',     'ENRIQUE PACHECO LANDÍVAR',
  'FLAVIA ROMERO ZURITA',      'GERMÁN TICONA APAZA',        'HELENA CUÉLLAR ROCA',
  'IVÁN SEJAS BARRIENTOS',     'JIMENA POVEDA LARREA',       'KEVIN ALARCÓN MIRANDA'
];

// Los cursantes de la ECEME son capitanes o mayores
const GRADOS_CURSANTE = ['CAPITÁN', 'MAYOR'];

// CI: rango propio de los datos de demostración, para no chocar con los reales
let siguienteCI = 3100001;
const nuevoCI = () => String(siguienteCI++);

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      // Cabeceras de identidad: la auditoría registra quién cargó los datos
      'X-Usuario-Nombre': encodeURIComponent('CARGA DE DATOS DEMO'),
      'X-Usuario-Rol': 'admin'
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, datos };
}

async function main() {
  console.log(`Servidor: ${API}\n`);

  const { ok, datos: materias } = await pedir('GET', '/materias');
  if (!ok) throw new Error('No se pudo leer las materias. ¿Está levantado el servidor (npm run dev)?');
  const idDeMateria = Object.fromEntries(materias.map(m => [m.nombre, m.id]));
  const cicloDeMateria = Object.fromEntries(materias.map(m => [m.id, m.ciclo]));

  // ---------- 1. DOCENTES ----------
  console.log('DOCENTES');
  let docentesNuevos = 0, docentesOmitidos = 0;
  for (const d of DOCENTES) {
    const materia_ids = d.materias.map(n => idDeMateria[n]).filter(Boolean);
    if (materia_ids.length === 0) {
      console.log(`  · ${d.nombre}: sus materias no existen en esta base, se omite`);
      docentesOmitidos++;
      continue;
    }
    const r = await pedir('POST', '/admin/docentes', {
      nombre: d.nombre, grado: d.grado, ci: nuevoCI(), password: PASSWORD, materia_ids
    });
    if (r.ok) {
      console.log(`  ✓ ${r.datos.codigo}  ${d.grado} ${d.nombre}  →  ${d.materias.join(', ')}`);
      docentesNuevos++;
    } else {
      console.log(`  · ${d.nombre}: ${r.datos.message || 'error ' + r.status}`);
      docentesOmitidos++;
    }
  }

  // ---------- 2. CURSANTES ----------
  // Se reparten entre los docentes de cada materia (cada cursante pertenece a
  // la "sección" de un docente concreto).
  const { datos: asignaciones } = await pedir('GET', '/asignaciones');
  console.log('\nCURSANTES');
  let cursantesNuevos = 0, cursantesOmitidos = 0, iNombre = 0;

  for (const m of materias) {
    const docentesDeLaMateria = asignaciones.filter(a => a.materia_id === m.id);
    if (docentesDeLaMateria.length === 0) {
      console.log(`  · ${m.nombre}: sin docente asignado, no se le pueden cargar cursantes`);
      continue;
    }
    console.log(`  ${m.nombre} (${m.ciclo}) — ${docentesDeLaMateria.length} docente(s)`);

    for (let i = 0; i < CURSANTES_POR_MATERIA; i++) {
      const nombre = NOMBRES_CURSANTES[iNombre % NOMBRES_CURSANTES.length];
      iNombre++;
      // Reparto en round-robin entre los docentes de esta materia
      const docente = docentesDeLaMateria[i % docentesDeLaMateria.length];
      const r = await pedir('POST', '/admin/estudiantes', {
        nombre,
        grado: GRADOS_CURSANTE[i % GRADOS_CURSANTE.length],
        ci: nuevoCI(),
        ciclo: cicloDeMateria[m.id],
        materia_id: m.id,
        docente_id: docente.docente_id,
        password: PASSWORD
      });
      if (r.ok) {
        console.log(`     ✓ ${r.datos.codigo}  ${nombre}  →  ${docente.docente}`);
        cursantesNuevos++;
      } else {
        console.log(`     · ${nombre}: ${r.datos.message || 'error ' + r.status}`);
        cursantesOmitidos++;
      }
    }
  }

  console.log(`\nRESUMEN: ${docentesNuevos} docente(s) y ${cursantesNuevos} cursante(s) creados.`);
  if (docentesOmitidos || cursantesOmitidos) {
    console.log(`         ${docentesOmitidos} docente(s) y ${cursantesOmitidos} cursante(s) omitidos (ya existían o no cumplían una regla).`);
  }
  console.log(`         Todos entran con la clave ${PASSWORD} y deben cambiarla en su primer ingreso.`);
  console.log(`         Tope de ${MAX_DOCENTES_POR_MATERIA} docentes por materia respetado por el servidor.`);
}

main().catch(err => {
  console.error('\nFalló la carga:', err.message);
  process.exit(1);
});
