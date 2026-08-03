// ============================================================
//  VALIDACIONES DEL FORMULARIO (espejo de apps/server/validaciones.js)
// ------------------------------------------------------------
//  Sirven para avisar al instante, ANTES de mandar la petición.
//  La validación que manda de verdad es la del servidor: esta se
//  puede saltar desde la consola del navegador, aquella no.
//  El catálogo de grados NO se copia aquí: se pide a /api/catalogos
//  para que exista una sola lista en todo el sistema.
// ============================================================

// Recorta, colapsa espacios internos y pasa a mayúsculas.
export const limpiar = (texto) =>
  String(texto == null ? '' : texto).trim().replace(/\s+/g, ' ').toUpperCase();

const RE_NOMBRE = /^[A-ZÁÉÍÓÚÜÑ'.\- ]+$/;
const RE_MATERIA = /^[A-ZÁÉÍÓÚÜÑ0-9'.,\-()\/ ]+$/;

// Abreviaturas de grado que no deben ir dentro del nombre
const PREFIJOS_DE_GRADO = [
  'GRAL', 'GRAL.', 'GENERAL', 'CNL', 'CNL.', 'CORONEL', 'TCNL', 'TCNL.',
  'MY', 'MY.', 'MAY', 'MAY.', 'MAYOR', 'CAP', 'CAP.', 'CAPITAN', 'CAPITÁN',
  'TTE', 'TTE.', 'TENIENTE', 'SBTTE', 'SBTTE.', 'SUBTENIENTE',
  'SGTO', 'SGTO.', 'SARGENTO', 'SOF', 'SOF.', 'SUBOFICIAL',
  'LIC', 'LIC.', 'ING', 'ING.', 'DR', 'DR.', 'MSC', 'MSC.'
];

// Devuelven el mensaje de error (en MAYÚSCULAS, como el resto del panel)
// o null si el dato es válido.
export function validarNombre(nombre) {
  const n = limpiar(nombre);
  if (!n) return 'EL NOMBRE ES OBLIGATORIO (NO PUEDE SER SOLO ESPACIOS)';
  if (n.length < 3) return 'EL NOMBRE DEBE TENER AL MENOS 3 CARACTERES';
  if (n.length > 80) return 'EL NOMBRE NO PUEDE SUPERAR LOS 80 CARACTERES';
  if (!RE_NOMBRE.test(n)) return 'EL NOMBRE SOLO ADMITE LETRAS, ESPACIOS, APÓSTROFES, GUIONES Y PUNTOS';
  if ((n.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length < 3) return 'EL NOMBRE DEBE CONTENER AL MENOS 3 LETRAS';
  if (PREFIJOS_DE_GRADO.includes(n.split(' ')[0])) return 'NO ESCRIBA EL GRADO DENTRO DEL NOMBRE: USE EL CAMPO GRADO';
  return null;
}

export function validarGrado(grado, grados) {
  const g = limpiar(grado);
  if (!g) return 'SELECCIONE EL GRADO';
  if (grados && grados.length > 0 && !grados.includes(g)) return 'GRADO NO VÁLIDO: SELECCIONE UNO DE LA LISTA';
  return null;
}

export function validarCI(ci) {
  const c = String(ci == null ? '' : ci).trim();
  if (!c) return 'EL CARNET DE IDENTIDAD ES OBLIGATORIO';
  if (!/^\d{6,9}$/.test(c)) return 'EL CI DEBE TENER ENTRE 6 Y 9 DÍGITOS';
  // Descarta carnets de relleno como 0000000 o 1111111
  if (/^(\d)\1+$/.test(c)) return 'EL CI NO PUEDE TENER TODOS LOS DÍGITOS IGUALES';
  return null;
}

export function validarNombreMateria(nombre) {
  const n = limpiar(nombre);
  if (!n) return 'EL NOMBRE DE LA MATERIA ES OBLIGATORIO';
  if (n.length < 3) return 'EL NOMBRE DE LA MATERIA DEBE TENER AL MENOS 3 CARACTERES';
  if (n.length > 60) return 'EL NOMBRE DE LA MATERIA NO PUEDE SUPERAR LOS 60 CARACTERES';
  if (!RE_MATERIA.test(n)) return 'EL NOMBRE DE LA MATERIA CONTIENE CARACTERES NO PERMITIDOS';
  if ((n.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length < 3) return 'EL NOMBRE DE LA MATERIA DEBE CONTENER AL MENOS 3 LETRAS';
  return null;
}

// Valida una persona completa (cursante o docente). Devuelve el primer error.
export function validarPersona(datos, grados, opciones = {}) {
  return validarNombre(datos.nombre)
    || validarGrado(datos.grado, grados)
    || (opciones.conCI ? validarCI(datos.ci) : null);
}
