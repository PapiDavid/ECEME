import axios from 'axios';

// El backend (API) vive SIEMPRE en el mismo equipo que sirve esta página,
// en el puerto 3001. Antes esto estaba fijo en "localhost", lo que rompía el
// acceso desde otro dispositivo: en el teléfono "localhost" es el teléfono,
// no la laptop. Ahora tomamos el host desde el que se abrió la página
// (window.location.hostname): "localhost" cuando entras en la PC, o la IP de
// la laptop (192.168.x.x) cuando entras desde el celular. Así funciona desde
// cualquier dispositivo de la red sin tocar nada. Se puede forzar otra URL con
// la variable VITE_API_URL si algún día hace falta.
const host = window.location.hostname;
const baseURL = import.meta.env.VITE_API_URL || `http://${host}:3001/api`;

const api = axios.create({ baseURL });

// Cabeceras de identidad para el módulo de AUDITORÍA: el backend las lee en
// cada petición para saber QUIÉN hizo cada acción. El nombre va codificado
// porque las cabeceras HTTP no admiten acentos ni ñ.
export const setAuditHeaders = (user) => {
  if (user) {
    api.defaults.headers.common['X-Usuario-Id'] = String(user.id);
    api.defaults.headers.common['X-Usuario-Nombre'] = encodeURIComponent(user.identificador || '');
    api.defaults.headers.common['X-Usuario-Rol'] = user.rol || '';
  } else {
    delete api.defaults.headers.common['X-Usuario-Id'];
    delete api.defaults.headers.common['X-Usuario-Nombre'];
    delete api.defaults.headers.common['X-Usuario-Rol'];
  }
};

export default api;
