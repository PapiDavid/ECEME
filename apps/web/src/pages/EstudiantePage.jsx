import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { UserSquare, FileText, Star, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
// 1. Importamos la nueva API de Axios
import api from '@/lib/api'; 
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EstudiantePage = () => {
  const { currentUser } = useAuth();
  const [estudiante, setEstudiante] = useState(null);
  const [notas, setNotas] = useState([]);
  const [criterios, setCriterios] = useState([]);
  
  const [selectedMateriaId, setSelectedMateriaId] = useState('');
  const [activeMateriaId, setActiveMateriaId] = useState('');
  const [activeMateriaName, setActiveMateriaName] = useState('');
  
  const [evaluaciones, setEvaluaciones] = useState({});
  const [submittingEval, setSubmittingEval] = useState(false);
  const [loading, setLoading] = useState(true);

  // La evaluación se responde por páginas, como un formulario normal:
  // el cursante ve pocas preguntas a la vez y avanza con Anterior/Siguiente.
  const PREGUNTAS_POR_PAGINA = 5;
  const [evalPage, setEvalPage] = useState(0);

  const fetchData = async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      
      // 2. Cargamos Perfil, Notas y Criterios desde MySQL
      const [estRes, notasRes, critRes] = await Promise.all([
        api.get(`/estudiantes/perfil/${currentUser.id}`),
        api.get(`/notas/estudiante/${currentUser.id}`),
        // Ruta publica de criterios: /admin/* exige rol admin y el cursante no lo es
        api.get('/criterios')
      ]);
      
      if (estRes.data) {
        const estData = estRes.data;
        setEstudiante(estData);
        
        // La materia "activa" es la que el estudiante está cursando actualmente
        // (Según tu lógica, el admin o docente define cuál es la actual)
        setActiveMateriaId(estData.materia_id);
        setActiveMateriaName(estData.nombre_materia_activa);
        
        setNotas(notasRes.data);
        // Seleccionamos por defecto la materia actual en el visor de notas
        if (estData.materia_id) setSelectedMateriaId(estData.materia_id.toString());
      }

      setCriterios(critRes.data);

      // Inicializar estado de evaluación (valor 3 por defecto)
      const initialEvals = {};
      critRes.data.forEach(c => initialEvals[c.id] = 3);
      setEvaluaciones(initialEvals);

    } catch (err) {
      console.error('Error al cargar datos de MySQL:', err);
      toast.error('ERROR AL SINCRONIZAR EXPEDIENTE ACADÉMICO');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleEvalChange = (critId, val) => {
    setEvaluaciones(prev => ({ ...prev, [critId]: val }));
  };

  // --- Paginación de la evaluación ---
  const totalPaginas = Math.max(1, Math.ceil(criterios.length / PREGUNTAS_POR_PAGINA));
  const paginaActual = Math.min(evalPage, totalPaginas - 1);
  const criteriosPagina = criterios.slice(paginaActual * PREGUNTAS_POR_PAGINA, (paginaActual + 1) * PREGUNTAS_POR_PAGINA);
  const respondidas = criterios.filter(c => evaluaciones[c.id]).length;
  const faltanEnPagina = criteriosPagina.some(c => !evaluaciones[c.id]);

  // No se puede avanzar dejando preguntas en blanco (así la evaluación
  // llega completa y no hay que revisar al final qué faltó).
  const irSiguiente = () => {
    if (faltanEnPagina) return toast.error('RESPONDA LA PREGUNTA ANTES DE CONTINUAR');
    setEvalPage(p => Math.min(totalPaginas - 1, p + 1));
  };
  const irAnterior = () => setEvalPage(p => Math.max(0, p - 1));

  const handleSubmitEval = async () => {
    if (!estudiante || !activeMateriaId) return toast.error('NO HAY MATERIA ACTIVA PARA EVALUAR');

    // Si quedó alguna sin responder, lo llevamos a esa página
    const faltante = criterios.findIndex(c => !evaluaciones[c.id]);
    if (faltante !== -1) {
      setEvalPage(Math.floor(faltante / PREGUNTAS_POR_PAGINA));
      return toast.error('DEBE RESPONDER TODAS LAS PREGUNTAS ANTES DE ENVIAR');
    }

    setSubmittingEval(true);
    try {
      // 3. Enviamos la evaluación al servidor de Node.js
      await api.post('/estudiantes/evaluar-docente', {
        estudiante_id: estudiante.id,
        materia_id: activeMateriaId,
        calificaciones: evaluaciones // Objeto { criterio_id: puntuacion }
      });
      
      toast.success('EVALUACIÓN ENVIADA AL COMANDO. GRACIAS POR SU APORTE.');
      setEvalPage(0);
    } catch (err) {
      console.error(err);
      toast.error('ERROR AL REGISTRAR LA EVALUACIÓN.');
    } finally {
      setSubmittingEval(false);
    }
  };

  // Buscamos la nota de la materia seleccionada en el visor
  const currentNota = notas.find(n => n.materia_id.toString() === selectedMateriaId);
  const notaFinalCalc = currentNota ? Number(currentNota.nota_final) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet><title>PORTAL CURSANTE - ECEME</title></Helmet>
      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-20 font-black tracking-[0.3em] text-muted-foreground uppercase animate-pulse">Sincronizando con el servidor...</div>
        ) : !estudiante ? (
          <div className="bg-destructive/10 border-2 border-destructive p-8 text-center text-destructive font-extrabold tracking-widest uppercase">
            REGISTRO NO ENCONTRADO. CONSULTE CON EL ADMINISTRADOR DEL SISTEMA.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* COLUMNA IZQUIERDA: PERFIL Y VISOR DE NOTAS */}
            <div className="lg:col-span-4 flex flex-col space-y-8">
              
              <div className="bg-card border-2 border-border shadow-md p-6 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                <div className="flex items-center space-x-3 mb-6 border-b-2 border-border pb-4">
                  <UserSquare size={24} className="text-primary" />
                  <h3 className="font-extrabold tracking-widest text-foreground uppercase">DATOS DEL CURSANTE</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">NOMBRE COMPLETO</p>
                    <p className="font-bold text-foreground text-sm uppercase">{estudiante.grado} {estudiante.nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">CÓDIGO</p>
                      <p className="font-bold text-foreground text-sm uppercase">{estudiante.codigo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">CI</p>
                      <p className="font-bold text-foreground text-sm uppercase">{estudiante.ci || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t-2 border-border">
                     <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">MATERIA EN CURSO</p>
                     <p className="font-extrabold text-primary text-sm uppercase">{activeMateriaName || 'NINGUNA'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border-2 border-border shadow-md p-6 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary"></div>
                <div className="flex items-center justify-between mb-6 border-b-2 border-border pb-4">
                  <div className="flex items-center space-x-3">
                    <FileText size={24} className="text-secondary" />
                    <h3 className="font-extrabold tracking-widest text-foreground uppercase">HISTORIAL DE NOTAS</h3>
                  </div>
                </div>

                <Select value={selectedMateriaId} onValueChange={setSelectedMateriaId}>
                  <SelectTrigger className="border-2 border-border uppercase font-bold text-xs mb-6">
                    <SelectValue placeholder="SELECCIONE MATERIA" />
                  </SelectTrigger>
                  <SelectContent>
                    {notas.map(n => (
                      <SelectItem key={n.materia_id} value={n.materia_id.toString()} className="uppercase font-bold text-xs">
                        {n.nombre_materia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currentNota ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">1ER PARCIAL (30%)</span>
                       <span className="font-black text-foreground">{currentNota.parcial_1}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">FINAL (60%)</span>
                       <span className="font-black text-foreground">{currentNota.parcial_final}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">TRABAJOS (10%)</span>
                       <span className="font-black text-foreground">{currentNota.trabajos}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 bg-muted/50 p-3 border-2 border-border">
                       <span className="text-xs font-black text-foreground uppercase">NOTA FINAL</span>
                       <span className={`text-xl font-black ${notaFinalCalc >= 51 ? 'text-primary' : 'text-destructive'}`}>
                         {notaFinalCalc.toFixed(2)}
                       </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground font-bold text-[10px] uppercase">
                    SIN REGISTROS PARA ESTA MATERIA.
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: EVALUACIÓN DOCENTE (OBLIGATORIA) */}
            <div className="lg:col-span-8">
              <div className="bg-card border-2 border-border shadow-md p-6 md:p-10 relative h-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
                <div className="flex items-center space-x-3 mb-8 border-b-2 border-border pb-4">
                  <Star size={24} className="text-accent" />
                  <div>
                    <h3 className="font-extrabold tracking-widest text-foreground uppercase">EVALUACIÓN DOCENTE</h3>
                    <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase mt-1">DOCENTE: {estudiante.nombre_docente_actual || 'NO ASIGNADO'}</p>
                  </div>
                </div>

                {criterios.length === 0 ? (
                  <p className="text-sm font-bold text-muted-foreground uppercase text-center py-10">CARGANDO CRITERIOS DE EVALUACIÓN...</p>
                ) : (
                  <div className="space-y-8">
                    <p className="text-[11px] font-bold text-foreground uppercase bg-muted p-4 border-l-4 border-accent">
                      ESCALA: 1 (NUNCA) - 5 (SIEMPRE). SU OPINIÓN ES FUNDAMENTAL PARA LA CALIDAD ACADÉMICA.
                    </p>

                    {/* Avance: cuántas preguntas van respondidas de todas */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          PÁGINA {paginaActual + 1} DE {totalPaginas}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                          {respondidas} DE {criterios.length} RESPONDIDAS
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted border border-border">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${(respondidas / criterios.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Solo las preguntas de esta página */}
                    <div className="space-y-6 min-h-[150px]">
                      {criteriosPagina.map((c, idx) => (
                        <div key={c.id} className="border-b-2 border-border pb-6 last:border-0">
                          <p className="text-sm font-bold text-foreground mb-4 uppercase">
                            {paginaActual * PREGUNTAS_POR_PAGINA + idx + 1}. {c.pregunta}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {[1, 2, 3, 4, 5].map(val => (
                              <button
                                key={val}
                                onClick={() => handleEvalChange(c.id, val)}
                                className={`w-12 h-12 flex items-center justify-center border-2 font-black transition-transform active:scale-95 ${
                                  evaluaciones[c.id] === val
                                    ? 'bg-accent border-accent text-accent-foreground scale-110'
                                    : 'bg-background border-border text-muted-foreground hover:border-accent'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Navegación: el botón de enviar solo aparece en la última página */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t-2 border-border">
                      <Button
                        onClick={irAnterior}
                        disabled={paginaActual === 0}
                        variant="outline"
                        className="w-full sm:w-auto border-2 font-black tracking-widest h-12 px-8 uppercase rounded-none disabled:opacity-40"
                      >
                        <ChevronLeft size={18} className="mr-2" /> Anterior
                      </Button>

                      {/* Puntitos: dónde está y cuáles ya respondió */}
                      <div className="flex gap-2 order-first sm:order-none">
                        {Array.from({ length: totalPaginas }).map((_, i) => {
                          const completa = criterios
                            .slice(i * PREGUNTAS_POR_PAGINA, (i + 1) * PREGUNTAS_POR_PAGINA)
                            .every(c => evaluaciones[c.id]);
                          return (
                            <span
                              key={i}
                              title={`PÁGINA ${i + 1}`}
                              className={`w-3 h-3 border-2 ${
                                i === paginaActual ? 'bg-accent border-accent'
                                  : completa ? 'bg-accent/40 border-accent/40'
                                  : 'bg-background border-border'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {paginaActual < totalPaginas - 1 ? (
                        <Button
                          onClick={irSiguiente}
                          className="w-full sm:w-auto bg-accent text-accent-foreground font-black tracking-widest h-12 px-8 uppercase rounded-none"
                        >
                          Siguiente <ChevronRight size={18} className="ml-2" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSubmitEval}
                          disabled={submittingEval || !activeMateriaId}
                          className="w-full sm:w-auto bg-accent text-accent-foreground font-black tracking-widest h-12 px-8 uppercase rounded-none"
                        >
                          <Send size={16} className="mr-2" /> {submittingEval ? 'ENVIANDO...' : 'ENVIAR EVALUACIÓN'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default EstudiantePage;