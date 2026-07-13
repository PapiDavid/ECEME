import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ShieldAlert, Users, BookOpen, Settings, FileDown, RefreshCw, Plus, Trash2, Edit3, Save, X, GraduationCap, BookMarked } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import api from '@/lib/api'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AdminPage = () => {
  const [materias, setMaterias] = useState([]);
  const [criterios, setCriterios] = useState([]);
  const [config, setConfig] = useState(null);
  const [notasPendientes, setNotasPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [estudiantes, setEstudiantes] = useState([]);
  const [docentes, setDocentes] = useState([]);

  // Estados de formularios inicializados con materia_id
  const [alumnoForm, setAlumnoForm] = useState({ nombre: '', codigo: '', grado: '', ciclo: 'PRIMER CICLO', materia_id: '' });
  const [docenteForm, setDocenteForm] = useState({ nombre: '', codigo: '', grado: '', materia_id: '' });
  const [materiaName, setMateriaName] = useState('');
  const [comandanteName, setComandanteName] = useState('');

  const [editingId, setEditingId] = useState(null); 
  const [editForm, setEditForm] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, critRes, confRes, notasRes, estRes, docRes] = await Promise.all([
        api.get('/materias'),
        api.get('/criterios'),
        api.get('/configuracion'),
        api.get('/notas/consolidado'),
        api.get('/admin/estudiantes'),
        api.get('/admin/docentes')
      ]);

      setMaterias(matRes.data);
      setCriterios(critRes.data);
      if (confRes.data) { setConfig(confRes.data); setComandanteName(confRes.data.comandante_nombre || ''); }
      setNotasPendientes(notasRes.data);
      setEstudiantes(estRes.data);
      setDocentes(docRes.data);
    } catch (err) {
      console.error(err);
      toast.error('ERROR AL SINCRONIZAR DATOS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePublishNotes = async () => {
    if (!window.confirm('¿PUBLICAR CALIFICACIONES EN EL TABLERO OFICIAL?')) return;
    try {
      await api.post('/notas/publicar-lote');
      toast.success('CALIFICACIONES PUBLICADAS CON ÉXITO');
      fetchData();
    } catch (err) {
      toast.error('ERROR AL PUBLICAR');
    }
  };

  const handleEditClick = (user, type) => {
    setEditingId(user.id);
    // Convertimos materia_id a string para que el componente Select lo reconozca
    setEditForm({ ...user, type, materia_id: user.materia_id?.toString() || "" });
  };

  const handleUpdateUser = async () => {
    try {
      const endpoint = editForm.type === 'estudiante' ? `/admin/estudiantes/${editingId}` : `/admin/docentes/${editingId}`;
      await api.put(endpoint, editForm);
      toast.success('REGISTRO ACTUALIZADO');
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error('ERROR AL ACTUALIZAR');
    }
  };

  const handleDeleteUser = async (id, type) => {
    if (!window.confirm('¿ESTÁ SEGURO DE ELIMINAR ESTE REGISTRO?')) return;
    try {
      const endpoint = type === 'estudiante' ? `/admin/estudiantes/${id}` : `/admin/docentes/${id}`;
      await api.delete(endpoint);
      toast.success('REGISTRO ELIMINADO');
      fetchData();
    } catch (err) {
      toast.error('ERROR AL ELIMINAR');
    }
  };

  const handleAddAlumno = async e => {
    e.preventDefault();
    if (!alumnoForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    try {
      await api.post('/admin/estudiantes', { ...alumnoForm, password: "ECEME2026" });
      toast.success(`CURSANTE REGISTRADO CORRECTAMENTE`);
      setAlumnoForm({ nombre: '', codigo: '', grado: '', ciclo: 'PRIMER CICLO', materia_id: '' });
      fetchData();
    } catch (err) { toast.error('ERROR AL REGISTRAR'); }
  };

  const handleAddDocente = async e => {
    e.preventDefault();
    if (!docenteForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    try {
      await api.post('/admin/docentes', { ...docenteForm, password: "ECEME2026" });
      toast.success(`DOCENTE REGISTRADO CORRECTAMENTE`);
      setDocenteForm({ nombre: '', codigo: '', grado: '', materia_id: '' });
      fetchData();
    } catch (err) { toast.error('ERROR AL REGISTRAR'); }
  };

  const handleUpdateComandante = async () => {
    try {
      await api.post('/configuracion', { comandante_nombre: comandanteName });
      toast.success('COMANDANTE ACTUALIZADO');
      fetchData();
    } catch (err) { toast.error('ERROR'); }
  };

  const handleAddMateria = async () => {
    if (!materiaName) return;
    try {
      await api.post('/admin/materias', { nombre: materiaName });
      toast.success('MATERIA CREADA');
      setMateriaName('');
      fetchData();
    } catch (err) { toast.error('ERROR'); }
  };

  const generateNominalPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO", 105, 20, { align: "center" });
    doc.save("Resolucion_Nominal_ECEME.pdf");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet><title>ADMINISTRACIÓN - ECEME</title></Helmet>
      <Header />

      <main className="flex-1 py-12 px-4 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-20 font-black animate-pulse">SINCRONIZANDO CON MYSQL...</div>
        ) : (
          <div className="space-y-12">
            <div className="flex items-center space-x-4 border-b-4 border-primary pb-6">
              <ShieldAlert size={32} className="text-primary" />
              <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Comando Administrativo</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Registro Estudiantes */}
              <div className="bg-card border-2 border-border p-6 relative shadow-md">
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary"></div>
                <h3 className="font-black mb-6 uppercase text-xs tracking-widest text-muted-foreground">Registro de Cursante</h3>
                <form onSubmit={handleAddAlumno} className="space-y-4">
                  <Input placeholder="NOMBRE COMPLETO" value={alumnoForm.nombre} onChange={e => setAlumnoForm({...alumnoForm, nombre: e.target.value})} className="font-bold uppercase" required />
                  <Input placeholder="CÓDIGO" value={alumnoForm.codigo} onChange={e => setAlumnoForm({...alumnoForm, codigo: e.target.value})} className="font-bold uppercase" required />
                  <Input placeholder="GRADO" value={alumnoForm.grado} onChange={e => setAlumnoForm({...alumnoForm, grado: e.target.value})} className="font-bold uppercase" required />
                  
                  <Select value={alumnoForm.ciclo} onValueChange={v => setAlumnoForm({...alumnoForm, ciclo: v})}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="CICLO" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PRIMER CICLO">PRIMER CICLO</SelectItem>
                        <SelectItem value="SEGUNDO CICLO">SEGUNDO CICLO</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={alumnoForm.materia_id} onValueChange={v => setAlumnoForm({...alumnoForm, materia_id: v})}>
                    <SelectTrigger className="font-bold border-primary/40"><SelectValue placeholder="ASIGNAR MATERIA" /></SelectTrigger>
                    <SelectContent>
                      {materias.map(m => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button type="submit" className="w-full bg-secondary text-secondary-foreground font-black uppercase shadow-lg">Registrar</Button>
                </form>
              </div>

              {/* Registro Docente */}
              <div className="bg-card border-2 border-border p-6 relative shadow-md">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
                <h3 className="font-black mb-6 uppercase text-xs tracking-widest text-muted-foreground">Registro de Docente</h3>
                <form onSubmit={handleAddDocente} className="space-y-4">
                  <Input placeholder="NOMBRE COMPLETO" value={docenteForm.nombre} onChange={e => setDocenteForm({...docenteForm, nombre: e.target.value})} className="font-bold uppercase" required />
                  <Input placeholder="CÓDIGO" value={docenteForm.codigo} onChange={e => setDocenteForm({...docenteForm, codigo: e.target.value})} className="font-bold uppercase" required />
                  <Input placeholder="GRADO" value={docenteForm.grado} onChange={e => setDocenteForm({...docenteForm, grado: e.target.value})} className="font-bold uppercase" required />
                  
                  <Select value={docenteForm.materia_id} onValueChange={v => setDocenteForm({...docenteForm, materia_id: v})}>
                    <SelectTrigger className="font-bold border-primary/40"><SelectValue placeholder="ASIGNAR MATERIA" /></SelectTrigger>
                    <SelectContent>
                      {materias.map(m => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button type="submit" className="w-full bg-accent text-accent-foreground font-black uppercase shadow-lg">Registrar</Button>
                </form>
              </div>

              {/* Configuraciones */}
              <div className="space-y-6">
                <div className="bg-card border-2 border-border p-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Comandante Actual</Label>
                  <div className="flex space-x-2">
                    <Input value={comandanteName} onChange={e => setComandanteName(e.target.value)} className="font-bold" />
                    <Button onClick={handleUpdateComandante} className="bg-primary">OK</Button>
                  </div>
                </div>
                <div className="bg-card border-2 border-border p-6">
                  <Label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Nueva Materia Académica</Label>
                  <div className="flex space-x-2">
                    <Input value={materiaName} onChange={e => setMateriaName(e.target.value)} className="font-bold" placeholder="NOMBRE..." />
                    <Button onClick={handleAddMateria} className="bg-primary"><Plus/></Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Directorio de Personal Militar */}
            <div className="bg-card border-2 border-border p-6 shadow-xl">
              <h2 className="font-black uppercase mb-8 flex items-center text-xl tracking-tighter">
                <Users className="mr-3 text-primary" size={28}/> Directorio de Personal
              </h2>
              <div className="overflow-x-auto">
                <table className="military-table w-full">
                  <thead>
                    <tr>
                      <th className="text-[10px] uppercase">TIPO</th>
                      <th className="text-left">GRADO Y NOMBRE COMPLETO</th>
                      <th className="text-left">CÓDIGO</th>
                      <th className="text-left">MATERIA ASIGNADA</th>
                      <th className="text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...docentes.map(d => ({...d, type: 'docente'})), ...estudiantes.map(e => ({...e, type: 'estudiante'}))].map(user => (
                      <tr key={`${user.type}-${user.id}`} className="hover:bg-muted/30 transition-colors">
                        <td className="text-[9px] font-black uppercase text-muted-foreground">{user.type}</td>
                        <td className="py-4">
                          {editingId === user.id ? (
                            <div className="flex space-x-2">
                              <Input className="h-8 text-xs font-bold w-24" value={editForm.grado} onChange={e => setEditForm({...editForm, grado: e.target.value})} />
                              <Input className="h-8 text-xs font-bold" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} />
                            </div>
                          ) : (
                            <span className="font-bold uppercase text-xs">{user.grado} {user.nombre}</span>
                          )}
                        </td>
                        <td className="text-xs font-mono font-bold">{user.codigo}</td>
                        <td>
                           {editingId === user.id ? (
                             <Select value={editForm.materia_id} onValueChange={v => setEditForm({...editForm, materia_id: v})}>
                                <SelectTrigger className="h-8 text-[10px] font-black uppercase border-2">
                                    <SelectValue placeholder="CAMBIAR MATERIA" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materias.map(m => (
                                        <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                          ) : (
                            <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded-sm">
                                {materias.find(m => m.id == user.materia_id)?.nombre || 'SIN ASIGNACIÓN'}
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {editingId === user.id ? (
                            <div className="flex justify-center space-x-2">
                              <button onClick={handleUpdateUser} className="text-primary p-1 bg-primary/10 rounded-md hover:bg-primary hover:text-white transition-all"><Save size={16}/></button>
                              <button onClick={() => setEditingId(null)} className="text-destructive p-1 bg-destructive/10 rounded-md hover:bg-destructive hover:text-white transition-all"><X size={16}/></button>
                            </div>
                          ) : (
                            <div className="flex justify-center space-x-4">
                              <button onClick={() => handleEditClick(user, user.type)} className="text-primary hover:scale-125 transition-transform"><Edit3 size={18}/></button>
                              <button onClick={() => handleDeleteUser(user.id, user.type)} className="text-destructive hover:scale-125 transition-transform"><Trash2 size={18}/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Consolidado Académico */}
            <div className="bg-card border-2 border-border p-6 shadow-xl">
               <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                 <div>
                   <h2 className="font-black uppercase tracking-tighter flex items-center text-xl"><BookOpen className="mr-3 text-primary"/> Consolidado Académico</h2>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control centralizado de calificaciones MySQL</p>
                 </div>
                 <div className="flex gap-3">
                   <Button onClick={handlePublishNotes} className="bg-destructive text-destructive-foreground font-black text-xs uppercase h-11 px-8 rounded-none border-b-4 border-black/20">
                     <RefreshCw size={16} className="mr-2" /> Publicar Tablero
                   </Button>
                   <Button onClick={generateNominalPDF} variant="outline" className="border-2 border-primary font-bold text-xs uppercase h-11 rounded-none shadow-sm">
                     <FileDown size={16} className="mr-2" /> Descargar PDF
                   </Button>
                 </div>
               </div>
               <div className="overflow-x-auto">
                  <table className="military-table w-full">
                    <thead>
                      <tr>
                        <th className="text-[10px] uppercase">CURSANTE</th>
                        <th className="text-[10px] uppercase">MATERIA</th>
                        <th className="text-[10px] uppercase">CICLO</th>
                        <th className="text-center text-[10px] uppercase">NOTA FINAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notasPendientes.length === 0 ? (
                        <tr><td colSpan="4" className="text-center p-12 font-bold text-muted-foreground tracking-widest uppercase">No existen planillas publicadas</td></tr>
                      ) : (
                        notasPendientes.map(n => (
                          <tr key={n.id} className="hover:bg-muted/30">
                            <td className="font-bold uppercase text-[11px] py-3">{n.nombre_estudiante}</td>
                            <td className="uppercase text-[10px] font-bold text-muted-foreground">{n.nombre_materia}</td>
                            <td className="text-muted-foreground uppercase text-[10px] font-medium">{n.ciclo}</td>
                            <td className="text-center font-black">
                               <span className={`px-2 py-1 rounded-sm ${n.nota_final >= 51 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                                 {Number(n.nota_final).toFixed(2)}
                               </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminPage;