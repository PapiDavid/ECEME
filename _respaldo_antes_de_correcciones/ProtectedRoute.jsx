
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, currentUser } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change on first login
  if (currentUser?.primer_login && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.rol)) {
    // If they go to wrong dashboard, send them to their own
    if (currentUser.rol === 'admin') return <Navigate to="/admin" replace />;
    if (currentUser.rol === 'profesor') return <Navigate to="/docente" replace />;
    if (currentUser.rol === 'alumno') return <Navigate to="/estudiante" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
