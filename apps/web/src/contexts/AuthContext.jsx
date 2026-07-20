import React, { createContext, useContext, useState, useEffect } from 'react';
// 1. Importamos nuestra configuración de Axios para MySQL
import api, { setAuditHeaders } from '@/lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // 2. Al iniciar la app, recuperamos la sesión de MySQL guardada en el navegador
  useEffect(() => {
    const savedUser = localStorage.getItem('eceme_user');
    const savedToken = localStorage.getItem('eceme_token');

    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      // Configuramos el token para futuras peticiones a la API
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      // Cabeceras de identidad para la auditoría (quién hace cada acción)
      setAuditHeaders(parsedUser);
    }
    setInitialLoading(false);
  }, []);

  // 3. Función de Login conectada a Node.js + MySQL
  const login = async (identifier, password) => {
    try {
      // Enviamos el identificador (que puede ser correo o código) al backend
      const response = await api.post('/login', {
        identificador: identifier,
        password: password
      });

      const { user, token } = response.data;

      // Guardamos en el estado y en localStorage
      setCurrentUser(user);
      localStorage.setItem('eceme_user', JSON.stringify(user));
      localStorage.setItem('eceme_token', token);

      // Seteamos el token para las cabeceras de Axios
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Cabeceras de identidad para la auditoría (quién hace cada acción)
      setAuditHeaders(user);

      return response.data;
    } catch (err) {
      // Capturamos el error que viene del servidor de Node.js
      const message = err.response?.data?.message || 'ERROR DE CONEXIÓN CON EL SERVIDOR';
      throw new Error(message);
    }
  };

  // 4. Cerrar sesión
  const logout = () => {
    localStorage.removeItem('eceme_user');
    localStorage.removeItem('eceme_token');
    delete api.defaults.headers.common['Authorization'];
    setAuditHeaders(null);
    setCurrentUser(null);
  };

  // 5. Refrescar datos del usuario (útil tras cambio de password)
  const refreshUser = async () => {
    if (!currentUser?.id) return;
    try {
      // Marcamos primer_login como false localmente tras el cambio
      const updated = { ...currentUser, primer_login: 0 };
      setCurrentUser(updated);
      localStorage.setItem('eceme_user', JSON.stringify(updated));
    } catch (e) {
      console.error('Error al refrescar usuario:', e);
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!currentUser,
  };

  // Pantalla de carga con estética militar
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-secondary rounded-sm animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-black tracking-[0.3em] text-xs uppercase">
            ESTADO MAYOR - INICIALIZANDO SISTEMA...
          </p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};