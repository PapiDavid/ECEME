import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Shield, Target, Compass, Phone, Mail, MapPin, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
// 1. Importamos nuestra nueva configuración de API (Axios)
import api from '@/lib/api'; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const HomePage = () => {
  const [publishedNotes, setPublishedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const blockchainUrl = `http://${window.location.hostname}:3001/red.html`;

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

  // El tablero se pagina para que la portada no crezca sin fin: cada ciclo
  // muestra de a 15 notas y se avanza con Anterior/Siguiente.
  const NOTAS_POR_PAGINA = 15;
  const [pageCiclo1, setPageCiclo1] = useState(1);
  const [pageCiclo2, setPageCiclo2] = useState(1);

  // Acota la página pedida al total real y devuelve solo las filas visibles
  const paginar = (lista, page) => {
    const totalPages = Math.max(1, Math.ceil(lista.length / NOTAS_POR_PAGINA));
    const currentPage = Math.min(page, totalPages);
    return {
      totalPages,
      currentPage,
      items: lista.slice((currentPage - 1) * NOTAS_POR_PAGINA, currentPage * NOTAS_POR_PAGINA)
    };
  };

  // OJO: no es un componente, es una función que devuelve JSX. Si fuera un
  // componente declarado aquí adentro, React lo volvería a montar en cada
  // render de la página y se perdería la página elegida. Por eso el estado de
  // paginación vive arriba y se pasa como parámetro.
  const renderTablaNotas = ({ data, title, page, setPage }) => {
    const pag = paginar(data, page);
    return (
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
              {pag.items.map((nota, index) => (
                <tr key={index}>
                  <td className="font-bold uppercase text-sm">{`${nota.grado_estudiante || ''} ${nota.nombre_estudiante}`.trim()}</td>
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

      {/* Pie de paginación: los botones solo aparecen si hay más de una página */}
      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {data.length} nota(s)
            {pag.totalPages > 1 && ` · página ${pag.currentPage} de ${pag.totalPages}`}
          </span>
          {pag.totalPages > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pag.currentPage <= 1}
                className="inline-flex items-center gap-1 border-2 border-border bg-card px-4 py-2 font-black text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground">
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(pag.totalPages, p + 1))}
                disabled={pag.currentPage >= pag.totalPages}
                className="inline-flex items-center gap-1 border-2 border-border bg-card px-4 py-2 font-black text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground">
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>ECEME - ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO</title>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* HERO SECTION — queda FIJA (sticky) mientras el resto del contenido
            sube por encima al hacer scroll. Al volver a subir, reaparece. */}
        <section className="sticky top-0 h-[100dvh] flex items-center justify-center overflow-hidden z-0">
          <div className="absolute inset-0 bg-cover bg-center z-0" style={{
            backgroundImage: 'url(/Imagenes/bandera.png)'
          }} />
          {/* Velo más ligero (antes 85%) para que la imagen se vea más clara,
              con un degradado que oscurece solo lo justo detrás del texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/45 via-foreground/55 to-foreground/70 z-10" />
          
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
                ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJERCITO
              </h1>
              <p className="text-sm md:text-base text-background/70 max-w-3xl mx-auto font-bold tracking-[0.2em] leading-relaxed uppercase">
                Formación estratégica para la seguridad y defensa del territorio nacional.
              </p>
              <a
                href={blockchainUrl}
                className="mt-8 inline-flex items-center gap-2 border-2 border-secondary bg-foreground/70 px-6 py-3 text-[11px] font-black tracking-[0.18em] text-secondary uppercase transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Shield size={16} /> Ver centro de integridad blockchain
              </a>
            </motion.div>
          </div>
        </section>

        {/* CAPA DE CONTENIDO — sube POR ENCIMA de la imagen fija. El fondo sólido
            (bg-background) y el z-10 hacen que tape la imagen al bajar; la sombra
            superior da el efecto de que "entra" deslizándose sobre ella. */}
        <div className="relative z-10 bg-background shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.5)]">

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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="order-1 md:order-2 bg-muted h-80 border-2 border-border relative flex items-center justify-center overflow-hidden group shadow-xl">
              <div className="absolute inset-0 bg-[url(/Imagenes/mision.png)] bg-cover bg-center group-hover:scale-105 transition-transform duration-700"></div>
              {/* Degradado sutil para dar profundidad y que el icono resalte, sin teñir toda la foto */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/25 to-transparent"></div>
              <div className="absolute inset-0 ring-1 ring-inset ring-primary/30"></div>
              {/* Placa del icono con el color de la sección */}
              <div className="relative z-10 w-20 h-20 flex items-center justify-center bg-primary border-2 border-background/40 shadow-2xl">
                <Shield size={40} className="text-primary-foreground" />
              </div>
              <span className="absolute bottom-4 left-4 z-10 text-[10px] font-black tracking-[0.3em] uppercase text-background/90">Nuestra Misión</span>
            </motion.div>
          </div>
        </section>

        {/* VISION SECTION */}
        <section id="vision-section" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="bg-muted h-80 border-2 border-border relative flex items-center justify-center overflow-hidden group shadow-xl">
              <div className="absolute inset-0 bg-[url(/Imagenes/vision.png)] bg-cover bg-center group-hover:scale-105 transition-transform duration-700"></div>
              {/* Degradado sutil para dar profundidad y que el icono resalte, sin teñir toda la foto */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/25 to-transparent"></div>
              <div className="absolute inset-0 ring-1 ring-inset ring-accent/30"></div>
              {/* Placa del icono con el color de la sección */}
              <div className="relative z-10 w-20 h-20 flex items-center justify-center bg-accent border-2 border-background/40 shadow-2xl">
                <Compass size={40} className="text-accent-foreground" />
              </div>
              <span className="absolute bottom-4 right-4 z-10 text-[10px] font-black tracking-[0.3em] uppercase text-background/90">Nuestra Visión</span>
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
              className="max-w-5xl mx-auto"
            >
              {/* Mapa interactivo (OpenStreetMap embebido) con marco militar */}
              <div className="border-4 border-card shadow-2xl overflow-hidden rounded-sm relative bg-black">
                {/* Cinta con los colores de la bandera de Bolivia */}
                <div className="h-1.5 w-full flex">
                  <div className="h-full flex-1 bg-[#D52B1E]"></div>
                  <div className="h-full flex-1 bg-[#F9E000]"></div>
                  <div className="h-full flex-1 bg-[#007A33]"></div>
                </div>
                {/* Chapa/etiqueta con la ubicación */}
                <div className="absolute top-6 left-4 z-10 pointer-events-none">
                  <div className="flex items-center gap-2 bg-foreground/90 text-background px-4 py-2 border-l-4 border-primary shadow-lg backdrop-blur-sm">
                    <MapPin size={16} className="text-primary" />
                    <span className="text-[10px] font-black tracking-widest uppercase">Escuela de Comando y Estado Mayor</span>
                  </div>
                </div>
                <iframe
                  title="Ubicación de la ECEME en OpenStreetMap"
                  src="https://www.openstreetmap.org/export/embed?bbox=-66.1630153656006%2C-17.39854810459502%2C-66.15853607654573%2C-17.396357166029812&layer=mapnik&marker=-17.397452638593766%2C-66.16077572107315"
                  className="w-full h-[380px] md:h-[460px] block"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>

              {/* Acciones bajo el mapa */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                <a
                  href="https://www.openstreetmap.org/?mlat=-17.397453&mlon=-66.160776#map=19/-17.397453/-66.160776"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black px-6 py-3 text-xs uppercase tracking-widest border-2 border-black shadow-xl hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink size={16} /> Ver el mapa más grande
                </a>
                <span className="inline-flex items-center gap-2 text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                  <MapPin size={14} className="text-primary" /> Cochabamba · Bolivia
                </span>
              </div>

              {/* Crédito que exige la licencia de OpenStreetMap (ODbL) */}
              <p className="text-center text-[9px] font-bold text-muted-foreground tracking-widest uppercase mt-4">
                Cartografía ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  colaboradores de OpenStreetMap
                </a>
              </p>
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
                {renderTablaNotas({ data: notesCiclo1, title: 'PRIMER CICLO', page: pageCiclo1, setPage: setPageCiclo1 })}
                {renderTablaNotas({ data: notesCiclo2, title: 'SEGUNDO CICLO', page: pageCiclo2, setPage: setPageCiclo2 })}
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
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
