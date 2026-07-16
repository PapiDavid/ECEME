import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { UserCircle, PenTool, Star, Save } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import api from '@/lib/api'; 
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const DocentePage = () => {
  const { currentUser } = useAuth();
  const [docente, setDocente] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState('');
  const [estudiantes, setEstudiantes] = useState([]);
  const [evalAvg, setEvalAvg] = useState(0);

  const [notasInputs, setNotasInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedMateria = materias.find(m => String(m.id) === String(selectedMateriaId));

  // 1. Cargar perfil, estrellas y la lista de materias que dicta el docente
  useEffect(() => {
    const fetchDocente = async () => {
      if (!currentUser?.id) return;
      try {
        setLoading(true);
        const docRes = await api.get(`/docentes/perfil/${currentUser.id}`);
        if (docRes.data) {
          const docData = docRes.data;
          setDocente(docData);

          const [ratingRes, matRes] = await Promise.all([
            api.get(`/docentes/estrellas/${docData.id}`),
            api.get(`/docentes/${docData.id}/materias`)
          ]);
          setEvalAvg(Number(ratingRes.data.promedio) || 0);
          setMaterias(matRes.data);

          // Seleccionamos por defecto la materia activa; si no, la primera
          if (matRes.data.length > 0) {
            const activa = matRes.data.find(m => m.activa === 1);
            setSelectedMateriaId(String((activa || matRes.data[0]).id));
          }
        }
      } catch (err) {
        console.error('Error en Portal Docente:', err);
        toast.error('ERROR AL SINCRONIZAR CON EL SERVIDOR');
      } finally {
        setLoading(false);
      }
    };
    fetchDocente();
  }, [currentUser]);

  // 2. Cargar cursantes + notas cada vez que cambia la materia seleccionada
  useEffect(() => {
    const fetchEstudiantes = async () => {
      if (!docente || !selectedMateriaId) { setEstudiantes([]); setNotasInputs({}); return; }
      try {
        const [estRes, notasRes] = await Promise.all([
          api.get(`/docentes/${docente.id}/materia/${selectedMateriaId}/estudiantes`),
          api.get(`/notas/docente/${docente.id}/${selectedMateriaId}`)
        ]);
        const lista = estRes.data;
        setEstudiantes(lista);

        const inputsMap = {};
        lista.forEach(e => {
          const existing = notasRes.data.find(n => n.estudiante_id === e.id);
          inputsMap[e.id] = {
            parcial_1: existing ? existing.parcial_1 : '',
            parcial_final: existing ? existing.parcial_final : '',
            trabajos: existing ? existing.trabajos : '',
          };
        });
        setNotasInputs(inputsMap);
      } catch (err) {
        console.error(err);
        toast.error('ERROR AL CARGAR CURSANTES DE LA MATERIA');
      }
    };
    fetchEstudiantes();
  }, [docente, selectedMateriaId]);

  const handleNoteChange = (estId, field, value) => {
    // Validamos que la nota no pase de 100
    const val = value === '' ? '' : Math.min(100, Math.max(0, Number(value)));
    setNotasInputs(prev => ({
      ...prev,
      [estId]: { ...prev[estId], [field]: val }
    }));
  };

  const handleSaveNotes = async () => {
    if (!docente || !selectedMateriaId) return;
    setSaving(true);

    try {
      const planilla = estudiantes.map(est => ({
        estudiante_id: est.id,
        docente_id: docente.id,
        materia_id: Number(selectedMateriaId),
        ...notasInputs[est.id]
      })).filter(n => n.parcial_1 !== '' || n.parcial_final !== '' || n.trabajos !== '');

      if (planilla.length === 0) {
        setSaving(false);
        return toast.info('NO HAY NOTAS NUEVAS PARA GUARDAR');
      }

      await api.post('/notas/guardar-planilla', { planilla });
      toast.success('REGISTROS MILITARES ACTUALIZADOS EN MYSQL');
    } catch (err) {
      console.error(err);
      toast.error('ERROR AL GUARDAR EN LA BASE DE DATOS');
    } finally {
      setSaving(false);
    }
  };

  const getRowFinal = (estId) => {
    const data = notasInputs[estId];
    if (!data) return 0;
    const p1 = Number(data.parcial_1) || 0;
    const pf = Number(data.parcial_final) || 0;
    const tr = Number(data.trabajos) || 0;
    return (p1 * 0.3) + (pf * 0.6) + (tr * 0.1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet><title>PORTAL DOCENTE - ECEME</title></Helmet>
      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-20 font-extrabold tracking-widest text-muted-foreground uppercase animate-pulse">Sincronizando con el Estado Mayor...</div>
        ) : !docente ? (
          <div className="bg-destructive/10 border-2 border-destructive p-8 text-center text-destructive font-extrabold tracking-widest uppercase">
            REGISTRO NO ENCONTRADO. CONTACTE AL COMANDO CENTRAL.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* PERFIL Y CALIFICACIÓN */}
            <div className="lg:col-span-4 flex flex-col space-y-8">
              <div className="bg-card border-2 border-border p-6 relative shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                <div className="flex items-center space-x-3 mb-6 border-b-2 border-border pb-4">
                  <UserCircle size={24} className="text-primary" />
                  <h3 className="font-extrabold tracking-widest text-foreground uppercase">DOCENTE ECEME</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">NOMBRE COMPLETO</p>
                    <p className="font-bold text-foreground text-sm uppercase">{docente.grado} {docente.nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">CÓDIGO DE CÁTEDRA</p>
                      <p className="font-bold text-foreground text-sm uppercase">{docente.codigo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">CI</p>
                      <p className="font-bold text-foreground text-sm uppercase">{docente.ci || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t-2 border-border">
                     <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">MATERIA ASIGNADA</p>
                     {materias.length === 0 ? (
                       <p className="font-extrabold text-primary text-sm uppercase">SIN ASIGNACIÓN</p>
                     ) : (
                       <Select value={selectedMateriaId} onValueChange={setSelectedMateriaId}>
                         <SelectTrigger className="font-bold uppercase text-xs border-2 border-primary/40">
                           <SelectValue placeholder="SELECCIONE MATERIA" />
                         </SelectTrigger>
                         <SelectContent>
                           {materias.map(m => (
                             <SelectItem key={m.id} value={String(m.id)} className="uppercase font-bold text-xs">
                               {m.nombre} {m.activa === 1 ? '(EN CURSO)' : ''}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     )}
                  </div>
                </div>
              </div>

              <div className="bg-card border-2 border-border p-6 relative shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary"></div>
                <div className="flex items-center space-x-3 mb-6 border-b-2 border-border pb-4">
                  <Star size={24} className="text-secondary" />
                  <h3 className="font-extrabold tracking-widest text-foreground uppercase">EVALUACIÓN DOCENTE</h3>
                </div>
                <div className="flex flex-col items-center py-4">
                    <div className="text-5xl font-black text-foreground mb-2">
                      {evalAvg.toFixed(1)} <span className="text-xl text-muted-foreground">/ 5</span>
                    </div>
                    <div className="flex space-x-1 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={20} className={s <= Math.round(evalAvg) ? "text-secondary fill-secondary" : "text-border"} />
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Promedio según cursantes</p>
                </div>
              </div>
            </div>

            {/* PLANILLA DE NOTAS */}
            <div className="lg:col-span-8">
              <div className="bg-card border-2 border-border p-6 md:p-8 relative shadow-sm h-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b-2 border-border pb-4 gap-4">
                  <h3 className="font-extrabold tracking-widest text-foreground uppercase flex items-center">
                    <PenTool size={20} className="mr-2 text-accent" /> PLANILLA DE RENDIMIENTO
                  </h3>
                  <Button 
                    onClick={handleSaveNotes} 
                    disabled={saving || estudiantes.length === 0}
                    className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white font-black tracking-widest uppercase px-8 h-12 rounded-none border-b-4 border-yellow-600"
                  >
                    <Save size={18} className="mr-2" /> {saving ? 'SINCRONIZANDO...' : 'GUARDAR MYSQL'}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  {estudiantes.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed font-bold text-muted-foreground uppercase tracking-widest">
                      No hay cursantes registrados en esta materia bajo su mando.
                    </div>
                  ) : (
                    <table className="military-table w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-[10px] tracking-widest uppercase">CURSANTE</th>
                          <th className="w-28 text-center text-[10px] tracking-widest uppercase">P1 (30%)</th>
                          <th className="w-28 text-center text-[10px] tracking-widest uppercase">FINAL (60%)</th>
                          <th className="w-28 text-center text-[10px] tracking-widest uppercase">TRAB (10%)</th>
                          <th className="w-24 text-center text-[10px] tracking-widest uppercase">PROM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-border">
                        {estudiantes.map((est) => {
                          const final = getRowFinal(est.id);
                          return (
                            <tr key={est.id} className="hover:bg-muted/30 transition-colors">
                              <td className="font-bold text-[11px] uppercase py-4">
                                {est.grado} {est.nombre}
                                <p className="text-[9px] text-muted-foreground font-medium">{est.ciclo}</p>
                              </td>
                              <td className="p-2">
                                <Input 
                                  type="number" 
                                  className="h-10 w-full text-center font-black border-2 border-gray-300 text-base bg-white"
                                  value={notasInputs[est.id]?.parcial_1 || ''}
                                  onChange={e => handleNoteChange(est.id, 'parcial_1', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-2">
                                <Input 
                                  type="number" 
                                  className="h-10 w-full text-center font-black border-2 border-gray-300 text-base bg-white"
                                  value={notasInputs[est.id]?.parcial_final || ''}
                                  onChange={e => handleNoteChange(est.id, 'parcial_final', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className="p-2">
                                <Input 
                                  type="number" 
                                  className="h-10 w-full text-center font-black border-2 border-gray-300 text-base bg-white"
                                  value={notasInputs[est.id]?.trabajos || ''}
                                  onChange={e => handleNoteChange(est.id, 'trabajos', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td className={`text-center font-black text-lg ${final >= 51 ? 'text-[#1b5e20]' : 'text-destructive'}`}>
                                {final.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default DocentePage;