import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import ScrollToTop from './components/ScrollToTop.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import EstudiantePage from './pages/EstudiantePage.jsx';
import DocentePage from './pages/DocentePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import NotesPage from './pages/NotesPage.jsx'; // Asegúrate de tener esta importada

function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Cambio de Contraseña (Protegida) */}
          <Route 
            path="/change-password" 
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            } 
          />

          {/* Dashboards Protegidos */}
          
          {/* 1. ESTUDIANTE: Acepta tanto 'alumno' como 'estudiante' */}
          <Route 
            path="/estudiante" 
            element={
              <ProtectedRoute allowedRoles={['alumno', 'estudiante']}>
                <EstudiantePage />
              </ProtectedRoute>
            } 
          />

          {/* 2. DOCENTE: 
              Cambiamos la ruta a /profesor para que coincida con el navigate 
              y aceptamos el rol 'profe' que viene de MySQL */}
          <Route 
            path="/profesor" 
            element={
              <ProtectedRoute allowedRoles={['profe', 'profesor', 'docente']}>
                <DocentePage />
              </ProtectedRoute>
            } 
          />

          {/* 3. ADMIN */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            } 
          />

          {/* 4. BITÁCORA */}
          <Route 
            path="/notes" 
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            } 
          />

          {/* Fallback - Redirige a Home si la ruta no existe */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;