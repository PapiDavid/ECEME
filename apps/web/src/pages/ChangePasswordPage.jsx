import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import api from '@/lib/api'; 
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { currentUser, refreshUser } = useAuth();
  const [formData, setFormData] = useState({ password: '', passwordConfirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.passwordConfirm) {
      toast.error('LAS CONTRASEÑAS NO COINCIDEN');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES');
      return;
    }

    setLoading(true);
    try {
      // 1. Petición al backend de Node.js para actualizar en MySQL
      await api.post('/usuarios/cambiar-password', {
        usuario_id: currentUser.id,
        nueva_password: formData.password
      });
      
      // 2. Actualizamos el estado local (primer_login -> 0)
      // ChangePasswordPage.jsx - Dentro de handleSubmit
      await refreshUser();
      toast.success('CONTRASEÑA PERSONALIZADA CORRECTAMENTE');

      const userRol = currentUser.rol.toLowerCase();

      if (userRol === 'admin') {
        navigate('/admin');
      } else if (userRol === 'profe' || userRol === 'profesor' || userRol === 'docente') {
        navigate('/profesor'); // <--- Aquí es donde fallaba antes
      } else if (userRol === 'alumno' || userRol === 'estudiante') {
        navigate('/estudiante');
      } else {
        navigate('/');
      }
      
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error.response?.data?.message || 'ERROR AL GUARDAR EN EL SERVIDOR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet><title>SEGURIDAD - ECEME</title></Helmet>
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-card border-2 border-border shadow-2xl p-8 md:p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 flex">
            <div className="h-full flex-1 bg-[#D52B1E]"></div>
            <div className="h-full flex-1 bg-[#F9E000]"></div>
            <div className="h-full flex-1 bg-[#007A33]"></div>
          </div>
          
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-20 h-20 bg-primary/10 text-primary flex items-center justify-center rounded-sm mb-6 border-2 border-primary">
              <ShieldAlert size={40} />
            </div>
            <h1 className="text-2xl font-black mb-3 text-foreground tracking-tighter uppercase">Actualización Obligatoria</h1>
            <p className="text-muted-foreground font-bold text-[10px] max-w-sm uppercase tracking-widest leading-relaxed">
              Detección de primer ingreso. Por seguridad del Estado Mayor, debe establecer una contraseña privada antes de acceder a su panel académico.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="font-black tracking-widest text-[10px] text-muted-foreground uppercase">Nueva Clave de Acceso</Label>
              <Input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="mt-2 border-2 border-border font-bold h-12"
                placeholder="MÍNIMO 8 CARACTERES"
              />
            </div>

            <div>
              <Label className="font-black tracking-widest text-[10px] text-muted-foreground uppercase">Confirmar Clave</Label>
              <Input
                name="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                className="mt-2 border-2 border-border font-bold h-12"
                placeholder="REPITA SU NUEVA CLAVE"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-black tracking-[0.2em] h-14 uppercase mt-4 shadow-lg"
            >
              {loading ? 'PROCESANDO CAMBIO...' : <><CheckCircle2 className="mr-2" size={18}/> GUARDAR Y ENTRAR AL PORTAL</>}
            </Button>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default ChangePasswordPage;