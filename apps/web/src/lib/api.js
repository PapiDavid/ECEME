import axios from 'axios';
const api = axios.create({
  baseURL: 'http://localhost:3001/api'
});

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
