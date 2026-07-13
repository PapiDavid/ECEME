import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { UserSquare, FileText, Star, Send } from 'lucide-react';
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

  const fetchData = async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      
      // 2. Cargamos Perfil, Notas y Criterios desde MySQL
      const [estRes, notasRes, critRes] = await Promise.all([
        api.get(`/estudiantes/perfil/${currentUser.id}`),
        api.get(`/notas/estudiante/${currentUser.id}`),
        api.get('/admin/criterios')
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

  const handleSubmitEval = async () => {
    if (!estudiante || !activeMateriaId) return toast.error('NO HAY MATERIA ACTIVA PARA EVALUAR');
    
    setSubmittingEval(true);
    try {
      // 3. Enviamos la evaluación al servidor de Node.js
      await api.post('/estudiantes/evaluar-docente', {
        estudiante_id: estudiante.id,
        materia_id: activeMateriaId,
        calificaciones: evaluaciones // Objeto { criterio_id: puntuacion }
      });
      
      toast.success('EVALUACIÓN ENVIADA AL COMANDO. GRACIAS POR SU APORTE.');
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
                    
                    <div className="space-y-6">
                      {criterios.map((c, idx) => (
                        <div key={c.id} className="border-b-2 border-border pb-6 last:border-0">
                          <p className="text-sm font-bold text-foreground mb-4 uppercase">{idx + 1}. {c.pregunta}</p>
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

                    <div className="pt-6">
                      <Button 
                        onClick={handleSubmitEval} 
                        disabled={submittingEval || !activeMateriaId}
                        className="w-full md:w-auto bg-accent text-accent-foreground font-black tracking-widest h-14 px-10 uppercase"
                      >
                        {submittingEval ? 'ENVIANDO...' : 'CONFIRMAR Y ENVIAR EVALUACIÓN'}
                      </Button>
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