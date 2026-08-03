// ============================================================
//  VALIDACIONES DE NEGOCIO (fuente única de verdad)
// ------------------------------------------------------------
//  Estas reglas se aplican en el SERVIDOR, que es el único punto
//  que no se puede saltar: el frontend valida igual para dar un
//  mensaje inmediato, pero quien manda es este archivo.
//  Se usan tanto en el ALTA como en la EDICIÓN, para que las dos
//  puertas exijan exactamente lo mismo.
// ============================================================

// Catálogo cerrado de grados. El campo dejó de ser texto libre:
// en el frontend es un desplegable armado con esta misma lista.
const GRADOS_MILITARES = [
  // Oficiales generales
  'GENERAL DE EJÉRCITO',
  'GENERAL DE DIVISIÓN',
  'GENERAL DE BRIGADA',
  // Oficiales superiores (jefes)
  'CORONEL',
  'TENIENTE CORONEL',
  'MAYOR',
  // Oficiales subalternos
  'CAPITÁN',
  'TENIENTE',
  'SUBTENIENTE',
  // Suboficiales y sargentos
  'SUBOFICIAL MAESTRO',
  'SUBOFICIAL MAYOR',
  'SUBOFICIAL PRIMERO',
  'SUBOFICIAL SEGUNDO',
  'SARGENTO PRIMERO',
  'SARGENTO SEGUNDO',
  // Personal civil (docentes invitados)
  'LIC.',
  'ING.',
  'DR.',
  'MSC.'
];

const CICLOS = ['PRIMER CICLO', 'SEGUNDO CICLO'];

// Abreviaturas y palabras de grado que NO deben ir dentro del nombre.
// Evita el "CORONEL CNL. ROBERTO..." (el grado repetido dos veces).
const PREFIJOS_DE_GRADO = [
  'GRAL', 'GRAL.', 'GENERAL', 'CNL', 'CNL.', 'CORONEL', 'TCNL', 'TCNL.',
  'MY', 'MY.', 'MAY', 'MAY.', 'MAYOR', 'CAP', 'CAP.', 'CAPITAN', 'CAPITÁN',
  'TTE', 'TTE.', 'TENIENTE', 'SBTTE', 'SBTTE.', 'SUBTENIENTE',
  'SGTO', 'SGTO.', 'SARGENTO', 'SOF', 'SOF.', 'SUBOFICIAL',
  'LIC', 'LIC.', 'ING', 'ING.', 'DR', 'DR.', 'MSC', 'MSC.'
];

// Normaliza cualquier texto: recorta los extremos, colapsa los espacios
// internos y pasa a mayúsculas (todo el sistema guarda en mayúsculas).
// Un valor de solo espacios queda en cadena vacía, y así lo detecta la
// validación de obligatorio (antes se guardaba una fila en blanco).
function limpiar(texto) {
  return String(texto == null ? '' : texto).trim().replace(/\s+/g, ' ').toUpperCase();
}

// Solo letras (con tildes y ñ), espacios, apóstrofes, guiones y puntos.
const RE_NOMBRE = /^[A-ZÁÉÍÓÚÜÑ'.\- ]+$/;

function validarNombre(nombre) {
  const n = limpiar(nombre);
  if (!n) return 'El nombre es obligatorio (no puede ser solo espacios)';
  if (n.length < 3) return 'El nombre debe tener al menos 3 caracteres';
  if (n.length > 80) return 'El nombre no puede superar los 80 caracteres';
  if (!RE_NOMBRE.test(n)) return 'El nombre solo admite letras, espacios, apóstrofes, guiones y puntos';
  // Al menos 3 letras reales: descarta cosas como "..." o "- -"
  if ((n.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length < 3) return 'El nombre debe contener al menos 3 letras';
  const primera = n.split(' ')[0];
  if (PREFIJOS_DE_GRADO.includes(primera)) return 'No escriba el grado dentro del nombre: use el campo GRADO';
  return null;
}

function validarGrado(grado) {
  const g = limpiar(grado);
  if (!g) return 'El grado es obligatorio';
  if (!GRADOS_MILITARES.includes(g)) return `Grado no válido: seleccione uno de la lista oficial`;
  return null;
}

// El CI es el identificador natural de la persona: entre 6 y 9 dígitos.
function validarCI(ci) {
  const c = String(ci == null ? '' : ci).trim();
  if (!c) return 'El carnet de identidad es obligatorio';
  if (!/^\d{6,9}$/.test(c)) return 'El CI debe tener entre 6 y 9 dígitos';
  // Descarta carnets de relleno como 0000000 o 1111111
  if (/^(\d)\1+$/.test(c)) return 'El CI no puede tener todos los dígitos iguales';
  return null;
}

function validarCiclo(ciclo) {
  if (!CICLOS.includes(limpiar(ciclo))) return 'El ciclo debe ser PRIMER CICLO o SEGUNDO CICLO';
  return null;
}

// Nombre de materia: admite números y signos (ej. "TÁCTICA II"), pero
// exige al menos 3 letras, así que un "12345" ya no pasa.
const RE_MATERIA = /^[A-ZÁÉÍÓÚÜÑ0-9'.,\-()\/ ]+$/;

function validarNombreMateria(nombre) {
  const n = limpiar(nombre);
  if (!n) return 'El nombre de la materia es obligatorio';
  if (n.length < 3) return 'El nombre de la materia debe tener al menos 3 caracteres';
  if (n.length > 60) return 'El nombre de la materia no puede superar los 60 caracteres';
  if (!RE_MATERIA.test(n)) return 'El nombre de la materia contiene caracteres no permitidos';
  if ((n.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length < 3) return 'El nombre de la materia debe contener al menos 3 letras';
  return null;
}

// Valida una persona completa (cursante o docente) y devuelve el primer
// error encontrado, o null si todo está bien.
//   opciones.conCI    → valida el CI (solo en el alta; en la edición no se toca)
//   opciones.conCiclo → valida el ciclo (solo cursantes)
function validarPersona(datos, opciones = {}) {
  return validarNombre(datos.nombre)
    || validarGrado(datos.grado)
    || (opciones.conCI ? validarCI(datos.ci) : null)
    || (opciones.conCiclo ? validarCiclo(datos.ciclo) : null);
}

module.exports = {
  GRADOS_MILITARES,
  CICLOS,
  limpiar,
  validarNombre,
  validarGrado,
  validarCI,
  validarCiclo,
  validarNombreMateria,
  validarPersona
};
