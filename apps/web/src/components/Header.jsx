
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, currentUser, logout } = useAuth();

  const getDashboardLink = () => {
    if (!currentUser) return '/';
    if (currentUser.rol === 'admin') return '/admin';
    if (currentUser.rol === 'profesor') return '/docente';
    if (currentUser.rol === 'alumno') return '/estudiante';
    return '/';
  };

  const handleSmoothScroll = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { name: 'MISIÓN', action: () => handleSmoothScroll('mision-section') },
    { name: 'VISIÓN', action: () => handleSmoothScroll('vision-section') },
    { name: 'TABLEROS DE NOTAS', action: () => handleSmoothScroll('notas-section') },
  ];
  
  // Header.jsx
  const handlePortalRedirect = () => {
    if (!currentUser) return;
    const userRol = currentUser.rol.toLowerCase();
  
      if (userRol === 'admin') navigate('/admin');
      else if (userRol === 'profe' || userRol === 'profesor') navigate('/profesor');
      else if (userRol === 'alumno' || userRol === 'estudiante') navigate('/estudiante');
    };

  return (
    <header className="bg-foreground text-background sticky top-0 z-50 shadow-md border-b-4 border-primary">
      {/* Top thin Bolivian flag decoration */}
      <div className="h-1 w-full flex">
        <div className="h-full flex-1 bg-[#D52B1E]"></div>
        <div className="h-full flex-1 bg-[#F9E000]"></div>
        <div className="h-full flex-1 bg-[#007A33]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          <div className="flex items-center h-full">
            <Link to="/" className="flex items-center space-x-3 group">
              <img 
                src="https://horizons-cdn.hostinger.com/f24a0552-55d7-4463-8f2a-a3fa6802b1d4/93aaf264b84890a793999dcf951dc7f9.png" 
                alt="ECEME Logo" 
                className="w-10 h-10 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="text-xl font-extrabold tracking-widest text-background">ECEME</span>
            </Link>
          </div>

          <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center space-x-8">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={link.action}
                className={`font-bold tracking-widest text-sm px-2 py-1 transition-colors duration-300 cursor-pointer ${
                  'text-background hover:text-primary'
                }`}
              >
                {link.name}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <Link to={getDashboardLink()} className="flex items-center space-x-2 text-accent hover:text-secondary transition-colors">
                  <UserCircle size={20} />
                  <span className="font-bold tracking-widest text-xs hidden lg:inline-block">{currentUser.nombre}</span>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={logout} 
                  className="border-border text-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive font-bold tracking-widest text-xs bg-card"
                >
                  <LogOut size={16} className="mr-2" /> SALIR
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold tracking-widest border border-primary-foreground/20"
                >
                  INICIAR SESIÓN
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded hover:bg-background/10 transition-colors text-background"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-background/10 bg-foreground absolute w-full left-0 px-4 shadow-xl top-[84px]">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={link.action}
                  className="font-bold tracking-widest text-background hover:text-secondary transition-colors text-left"
                >
                  {link.name}
                </button>
              ))}
              <div className="h-px bg-background/10 w-full my-2"></div>
              {isAuthenticated ? (
                <>
                  <p className="text-xs text-muted-foreground font-bold tracking-widest">SESIÓN INICIADA COMO {currentUser.rol}</p>
                  <Button 
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="w-full bg-destructive text-destructive-foreground font-bold tracking-widest"
                  >
                    CERRAR SESIÓN
                  </Button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-primary text-primary-foreground font-bold tracking-widest">
                    INICIAR SESIÓN
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
