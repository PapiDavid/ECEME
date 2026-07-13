import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { Shield } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // Este método ahora debe llamar a tu API de Node.js
  
  const [step, setStep] = useState(1);
  const [rol, setRol] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!rol || !identifier) {
      toast.error('POR FAVOR, SELECCIONE ROL E INGRESE IDENTIFICADOR');
      return;
    }
    setStep(2);
  };

const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const result = await login(identifier, password);

    if (result && result.user) {
      const userRol = result.user.rol.toLowerCase(); // Forzamos minúsculas para evitar errores

      if (result.user.primer_login) {
        navigate('/change-password');
      } else {
        // REDIRECCIÓN MAESTRA
        if (userRol === 'admin') {
          navigate('/admin');
        } else if (userRol === 'profe' || userRol === 'profesor' || userRol === 'docente') {
          navigate('/profesor'); // <--- Asegúrate que esto coincida con App.jsx
        } else if (userRol === 'alumno' || userRol === 'estudiante') {
          navigate('/estudiante');
        } else {
          navigate('/'); // Por si no reconoce el rol
      }
      }
    }
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>ACCESO AL SISTEMA - ECEME</title>
      </Helmet>
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Elemento estético de fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-card border-2 border-border shadow-2xl overflow-hidden relative">
            {/* Barra de colores institucionales */}
            <div className="absolute top-0 left-0 w-full h-2 flex">
              <div className="h-full flex-1 bg-[#D52B1E]"></div>
              <div className="h-full flex-1 bg-[#F9E000]"></div>
              <div className="h-full flex-1 bg-[#007A33]"></div>
            </div>

            <div className="p-8 sm:p-10">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center rounded-sm mb-4 border border-secondary shadow-md">
                  <Shield size={32} />
                </div>
                <h1 className="text-2xl font-extrabold mb-1 text-foreground tracking-widest uppercase">ECEME</h1>
                <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase">SISTEMA DE GESTIÓN ACADÉMICA</p>
              </div>

              <div className="relative min-h-[280px]">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.form
                      key="step1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      onSubmit={handleStep1}
                      className="space-y-6 absolute w-full"
                    >
                      <div>
                        <Label className="font-bold tracking-widest text-[10px] text-muted-foreground uppercase">TIPO DE PERSONAL</Label>
                        <Select value={rol} onValueChange={setRol} required>
                          <SelectTrigger className="mt-2 border-2 border-border focus:ring-primary text-foreground font-bold h-12 uppercase">
                            <SelectValue placeholder="SELECCIONE PERFIL" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alumno" className="font-bold text-xs uppercase">CURSANTE</SelectItem>
                            <SelectItem value="profesor" className="font-bold text-xs uppercase">DOCENTE</SelectItem>
                            <SelectItem value="admin" className="font-bold text-xs uppercase">ADMINISTRADOR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="font-bold tracking-widest text-[10px] text-muted-foreground uppercase">
                          {rol === 'admin' ? 'CORREO ELECTRÓNICO' : 'CÓDIGO INSTITUCIONAL'}
                        </Label>
                        <Input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                          className="mt-2 border-2 border-border focus-visible:ring-primary text-foreground font-bold h-12 uppercase"
                          placeholder={rol === 'admin' ? 'admin@eceme.edu.bo' : 'EJ: ALU-1001'}
                          disabled={!rol}
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-black tracking-widest h-12 uppercase"
                      >
                        CONTINUAR
                      </Button>
                    </motion.form>
                  )}

                  {step === 2 && (
                    <motion.form
                      key="step2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      onSubmit={handleLogin}
                      className="space-y-6 absolute w-full"
                    >
                      <div className="bg-muted p-4 rounded-sm border border-border flex justify-between items-center mb-4">
                        <div>
                          <p className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">IDENTIDAD VERIFICADA</p>
                          <p className="font-black text-xs text-foreground uppercase">{identifier}</p>
                        </div>
                        <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black text-primary hover:underline tracking-widest uppercase">
                          CAMBIAR
                        </button>
                      </div>

                      <div>
                        <Label className="font-bold tracking-widest text-[10px] text-muted-foreground uppercase">CONTRASEÑA DEL PORTAL</Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoFocus
                          className="mt-2 border-2 border-border focus-visible:ring-primary text-foreground font-bold h-12"
                          placeholder="••••••••"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all font-black tracking-widest h-12 uppercase"
                      >
                        {loading ? 'AUTENTICANDO...' : 'INGRESAR AL SISTEMA'}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LoginPage;