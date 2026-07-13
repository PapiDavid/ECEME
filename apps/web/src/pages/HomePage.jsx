import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Shield, Target, Compass, Phone, Mail } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
// 1. Importamos nuestra nueva configuración de API (Axios)
import api from '@/lib/api'; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const HomePage = () => {
  const [publishedNotes, setPublishedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    const fetchPublishedNotes = async () => {
      try {
        setLoadingNotes(true);
        // 2. Llamada al endpoint de MySQL
        const response = await api.get('/home/notas');
        setPublishedNotes(response.data);
      } catch (err) {
        console.error('Error al cargar tablero oficial:', err);
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchPublishedNotes();
  }, []);

  // 3. Filtrado por ciclos (Primer y Segundo Ciclo)
  const notesCiclo1 = publishedNotes.filter(n => n.ciclo === 'PRIMER CICLO');
  const notesCiclo2 = publishedNotes.filter(n => n.ciclo === 'SEGUNDO CICLO');

  const NoteTable = ({ data, title }) => (
    <div className="mb-12">
      <div className="bg-primary text-primary-foreground py-3 px-6 border-2 border-border border-b-0 inline-block font-extrabold tracking-widest text-xs uppercase">
        {title}
      </div>
      <div className="overflow-x-auto border-2 border-border bg-card">
        {data.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground font-bold tracking-widest uppercase text-xs">
              NO HAY RESOLUCIONES DE NOTAS PUBLICADAS PARA ESTE CICLO
            </p>
          </div>
        ) : (
          <table className="military-table">
            <thead>
              <tr>
                <th className="text-left">CURSANTE (GRADO Y NOMBRE)</th>
                <th className="text-left">MATERIA ACTUAL</th>
                <th className="text-right">CALIFICACIÓN FINAL</th>
              </tr>
            </thead>
            <tbody>
              {data.map((nota, index) => (
                <tr key={index}>
                  <td className="font-bold uppercase text-sm">{nota.nombre_estudiante}</td>
                  <td className="text-muted-foreground font-bold text-xs uppercase">{nota.nombre_materia}</td>
                  <td className="text-right">
                    <span className={`military-badge ${nota.nota_final >= 51 ? 'border-primary text-primary' : 'border-destructive text-destructive'}`}>
                      {Number(nota.nota_final).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>ECEME - ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO</title>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative min-h-[85dvh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center z-0" style={{
            backgroundImage: 'url(/Imagenes/bandera.png)'
          }} />
          <div className="absolute inset-0 bg-foreground/85 z-10" />
          
          <div className="relative z-20 max-w-7xl mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="inline-flex flex-col items-center mb-8">
                <div className="flex h-1 w-32 mb-6">
                  <div className="h-full flex-1 bg-[#D52B1E]"></div>
                  <div className="h-full flex-1 bg-[#F9E000]"></div>
                  <div className="h-full flex-1 bg-[#007A33]"></div>
                </div>
                <span className="military-badge border-secondary text-secondary mb-6 bg-secondary/5 px-6 py-1 text-[10px] font-bold tracking-[0.3em]">
                  ESTADO PLURINACIONAL DE BOLIVIA
                </span>
              </div>
              <h1 className="text-background text-4xl md:text-6xl font-black tracking-tighter mb-6 uppercase">
                ESCUELA DE COMANDO Y ESTADO MAYOR
              </h1>
              <p className="text-sm md:text-base text-background/70 max-w-3xl mx-auto font-bold tracking-[0.2em] leading-relaxed uppercase">
                Formación estratégica para la seguridad y defensa del territorio nacional.
              </p>
            </motion.div>
          </div>
        </section>

        {/* MISSION SECTION */}
        <section id="mision-section" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-24">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }} className="order-2 md:order-1">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border-2 border-primary">
                  <Target size={24} className="text-primary" />
                </div>
                <h2 className="text-foreground tracking-widest border-b-4 border-secondary pb-2 uppercase">MISIÓN</h2>
              </div>
              <p className="text-muted-foreground font-medium text-lg leading-relaxed uppercase border-l-4 border-primary pl-6">
                FORMAR OFICIALES SUPERIORES CON LAS COMPETENCIAS PROFESIONALES, ÉTICAS Y MORALES NECESARIAS PARA EJERCER EL COMANDO Y DESEMPEÑARSE EN LOS ESTADOS MAYORES DE LAS UNIDADES DEL EJÉRCITO.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="order-1 md:order-2 bg-muted h-80 border-2 border-border relative flex items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-[url(/Imagenes/mision.png)] bg-cover bg-center opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-700"></div>
              <div className="absolute inset-0 bg-primary mix-blend-color opacity-60"></div>
              <Shield size={80} className="text-background/50 relative z-10" />
            </motion.div>
          </div>
        </section>

        {/* VISION SECTION */}
        <section id="vision-section" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="bg-muted h-80 border-2 border-border relative flex items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-[url(/Imagenes/vision.png)] bg-cover bg-center opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-700"></div>
              <div className="absolute inset-0 bg-accent mix-blend-color opacity-60"></div>
              <Compass size={80} className="text-background/50 relative z-10" />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-100px" }}>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-accent/10 flex items-center justify-center border-2 border-accent">
                  <Compass size={24} className="text-accent" />
                </div>
                <h2 className="text-foreground tracking-widest border-b-4 border-secondary pb-2 uppercase">VISIÓN</h2>
              </div>
              <p className="text-muted-foreground font-medium text-lg leading-relaxed uppercase border-l-4 border-accent pl-6">
                SER RECONOCIDOS COMO EL CENTRO DE EXCELENCIA EN FORMACIÓN DE LÍDERES MILITARES ESTRATÉGICOS EN AMÉRICA LATINA.
              </p>
            </motion.div>
          </div>
        </section>

        {/* UBICACIÓN DE LA ECEME SECTION (RESTORED) */}
        <section className="py-24 bg-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-foreground tracking-widest uppercase mb-4 font-black text-2xl">UBICACIÓN DE LA ECEME</h2>
              <div className="h-1 w-24 bg-primary mx-auto mb-6"></div>
              <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">
                ENCUÉNTRANOS EN NUESTRA SEDE PRINCIPAL
              </p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ duration: 0.6 }} 
              className="flex flex-col lg:flex-row items-center justify-center gap-12 max-w-5xl mx-auto"
            >
              {/* Contenedor de la Imagen del Mapa */}
              <div className="w-full lg:w-3/5 h-[400px] border-4 border-card shadow-2xl overflow-hidden grayscale hover:grayscale-0 transition-all duration-700 relative group rounded-sm bg-black">
                <img 
                  // ⚠️ Pon una captura clara del mapa de la zona en tu carpeta public
                  src="/Imagenes/Mapa.png" 
                  alt="Mapa de Ubicación ECEME" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-primary/10 mix-blend-color pointer-events-none"></div>
                
                {/* Capa de acción rápida al pasar el mouse */}
                <a 
                  href="https://maps.app.goo.gl/ymYVu2m7FvL6aBtb9"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <span className="bg-primary text-primary-foreground font-black px-6 py-3 text-xs uppercase tracking-widest border-2 border-black shadow-xl">
                    Abrir en Google Maps
                  </span>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* PUBLIC GRADES SECTION */}
        <section id="notas-section" className="py-24 bg-card">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-black tracking-[0.4em] uppercase mb-4">TABLERO OFICIAL DE NOTAS</h2>
              <div className="h-1.5 w-24 bg-primary mx-auto mb-6"></div>
              <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">
                CALIFICACIONES FINALES PROCESADAS POR EL DEPARTAMENTO ACADÉMICO
              </p>
            </div>

            {loadingNotes ? (
              <div className="text-center py-20 font-black tracking-widest text-muted-foreground uppercase animate-pulse">
                Sincronizando con el servidor central...
              </div>
            ) : (
              <div className="space-y-12">
                <NoteTable data={notesCiclo1} title="PRIMER CICLO" />
                <NoteTable data={notesCiclo2} title="SEGUNDO CICLO" />
              </div>
            )}
          </div>
        </section>

        {/* CONTACTOS SECTION */}
        <section className="py-20 bg-foreground text-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-black tracking-[0.5em] uppercase mb-12">CANALES DE COMUNICACIÓN</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="border-2 border-background/10 p-10">
                <Phone size={32} className="text-primary mx-auto mb-4" />
                <h4 className="font-black tracking-widest mb-2 text-accent">CENTRAL TELEFÓNICA</h4>
                <p className="text-xs font-bold tracking-widest text-background/60">+591 2 2223344</p>
              </div>
              <div className="border-2 border-background/10 p-10">
                <Mail size={32} className="text-primary mx-auto mb-4" />
                <h4 className="font-black tracking-widest mb-2 text-accent">CORREO OFICIAL</h4>
                <p className="text-xs font-bold tracking-widest text-background/60">CONTACTO@ECEME.EDU.BO</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;