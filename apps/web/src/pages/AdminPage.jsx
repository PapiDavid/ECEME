import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, Users, BookOpen, Settings, FileDown, RefreshCw, Plus, Trash2, Edit3, Save, X, GraduationCap, BookMarked, Search, ChevronLeft, ChevronRight, KeyRound, ScrollText } from 'lucide-react';
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
  const navigate = useNavigate();
  const [materias, setMaterias] = useState([]);
  const [criterios, setCriterios] = useState([]);
  const [config, setConfig] = useState(null);
  const [notasPendientes, setNotasPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [estudiantes, setEstudiantes] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [materiaToDelete, setMateriaToDelete] = useState('');

  // Estados de formularios (el código se genera automáticamente en el backend)
  const [alumnoForm, setAlumnoForm] = useState({ nombre: '', ci: '', grado: '', ciclo: 'PRIMER CICLO', asignacion_id: '', materia_id: '', docente_id: '' });
  const [docenteForm, setDocenteForm] = useState({ nombre: '', ci: '', grado: '', materia_id: '' });

  const toggleMateria = (arr, id) => (arr || []).includes(id) ? arr.filter(x => x !== id) : [...(arr || []), id];
  // Docentes que ya dictan una materia (según su lista de materia_ids)
  const docentesDeMateria = (materiaId) => docentes.filter(d =>
    d.materia_ids && String(d.materia_ids).split(',').map(Number).includes(Number(materiaId)));
  const [materiaName, setMateriaName] = useState('');
  const [materiaCiclo, setMateriaCiclo] = useState('PRIMER CICLO');
  const [comandanteName, setComandanteName] = useState('');
  // Materia elegida para descargar su acta oficial en PDF
  const [actaMateriaId, setActaMateriaId] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Directorio de personal: pestaña, buscador y paginación
  const [dirTab, setDirTab] = useState('estudiante');
  const [dirSearch, setDirSearch] = useState('');
  const [dirPage, setDirPage] = useState(1);
  const PAGE_SIZE = 10;


  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, critRes, confRes, notasRes, estRes, docRes, asigRes] = await Promise.all([
        api.get('/materias'),
        api.get('/criterios'),
        api.get('/configuracion'),
        api.get('/notas/consolidado'),
        api.get('/admin/estudiantes'),
        api.get('/admin/docentes'),
        api.get('/asignaciones')
      ]);

      setMaterias(matRes.data);
      setCriterios(critRes.data);
      if (confRes.data) { setConfig(confRes.data); setComandanteName(confRes.data.comandante_nombre || ''); }
      setNotasPendientes(notasRes.data);
      setEstudiantes(estRes.data);
      setDocentes(docRes.data);
      setAsignaciones(asigRes.data);
    } catch (err) {
      console.error(err);
      toast.error('ERROR AL SINCRONIZAR DATOS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handlePublishNotes = async () => {
    if (!window.confirm('¿PUBLICAR CALIFICACIONES EN EL TABLERO OFICIAL?\n\nEL ACTA QUEDARÁ SELLADA COMO UN BLOQUE INMUTABLE EN LA CADENA (BLOCKCHAIN).')) return;
    try {
      // Publica el acta y la sella como bloque encadenado (SHA-256) — core del proyecto
      const { data } = await api.post('/actas/publicar', {});
      toast.success(`ACTA PUBLICADA Y SELLADA EN LA CADENA (BLOQUE #${data.indice})`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message?.toUpperCase?.() || 'ERROR AL PUBLICAR');
    }
  };

  const handleEditClick = (user, type) => {
    setEditingId(user.id);
    // Convertimos materia_id a string para que el componente Select lo reconozca
    const materiaIds = type === 'docente' && user.materia_ids
      ? String(user.materia_ids).split(',').map(Number)
      : [];
    setEditForm({ ...user, type, materia_id: user.materia_id?.toString() || "", materia_ids: materiaIds });
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

  // Recuperación de credenciales: restablece la clave del usuario a la genérica
  // institucional y lo obliga a cambiarla en su próximo ingreso (primer_login = 1).
  const handleResetPassword = async (user) => {
    if (!window.confirm(`¿RESTABLECER LA CONTRASEÑA DE ${user.grado || ''} ${user.nombre}?\n\nSE ASIGNARÁ LA CLAVE INSTITUCIONAL Y DEBERÁ CAMBIARLA EN SU PRÓXIMO INGRESO.`)) return;
    try {
      const { data } = await api.post(`/admin/usuarios/${user.usuario_id}/reset-password`);
      toast.success(`CLAVE TEMPORAL DE ${user.codigo}: ${data.password_temporal}`, { duration: 10000 });
    } catch (err) {
      toast.error('ERROR AL RESTABLECER LA CONTRASEÑA');
    }
  };

  const ciValido = (ci) => /^\d{6,9}$/.test(ci);

  const handleAddAlumno = async e => {
    e.preventDefault();
    if (!ciValido(alumnoForm.ci)) return toast.error('EL CI DEBE TENER ENTRE 6 Y 9 DÍGITOS');
    if (!alumnoForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    try {
      const res = await api.post('/admin/estudiantes', { ...alumnoForm, password: "ECEME2026" });
      toast.success(`CURSANTE REGISTRADO: ${res.data.codigo}`);
      setAlumnoForm({ nombre: '', ci: '', grado: '', ciclo: 'PRIMER CICLO', asignacion_id: '', materia_id: '', docente_id: '' });
      fetchData();
    } catch (err) { toast.error('ERROR AL REGISTRAR'); }
  };

  const handleAddDocente = async e => {
    e.preventDefault();
    if (!ciValido(docenteForm.ci)) return toast.error('EL CI DEBE TENER ENTRE 6 Y 9 DÍGITOS');
    if (!docenteForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    try {
      const res = await api.post('/admin/docentes', { ...docenteForm, password: "ECEME2026" });
      toast.success(`DOCENTE REGISTRADO: ${res.data.codigo}`);
      setDocenteForm({ nombre: '', ci: '', grado: '', materia_id: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'ERROR AL REGISTRAR'); }
  };

  const handleDeleteMateria = async (id) => {
    if (!window.confirm('¿ELIMINAR ESTA MATERIA? SE BORRARÁN SUS NOTAS Y EVALUACIONES ASOCIADAS.')) return;
    try {
      await api.delete(`/admin/materias/${id}`);
      toast.success('MATERIA ELIMINADA');
      fetchData();
    } catch (err) { toast.error('ERROR AL ELIMINAR'); }
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
      await api.post('/admin/materias', { nombre: materiaName, ciclo: materiaCiclo });
      toast.success('MATERIA CREADA');
      setMateriaName('');
      fetchData();
    } catch (err) { toast.error('ERROR'); }
  };

  // --- Directorio: filtrado por pestaña + buscador + paginación (10 por página) ---
  const dirSource = dirTab === 'docente'
    ? docentes.map(d => ({ ...d, type: 'docente' }))
    : estudiantes.map(e => ({ ...e, type: 'estudiante' }));
  const materiaTextoDe = (u) => u.type === 'docente'
    ? (u.materias_nombres || '')
    : (materias.find(m => m.id == u.materia_id)?.nombre || '');
  const dirFiltered = dirSource.filter(u => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return true;
    return (u.nombre || '').toLowerCase().includes(q)
      || (u.codigo || '').toLowerCase().includes(q)
      || (u.ci || '').toLowerCase().includes(q)
      || (u.ciclo || '').toLowerCase().includes(q)
      || materiaTextoDe(u).toLowerCase().includes(q);
  });
  const dirTotalPages = Math.max(1, Math.ceil(dirFiltered.length / PAGE_SIZE));
  const dirCurrentPage = Math.min(dirPage, dirTotalPages);
  const dirPageItems = dirFiltered.slice((dirCurrentPage - 1) * PAGE_SIZE, dirCurrentPage * PAGE_SIZE);

  const changeDirTab = (tab) => { setDirTab(tab); setDirPage(1); };
  const changeDirSearch = (v) => { setDirSearch(v); setDirPage(1); };

  // ============================================================
  //  MÓDULO DE REPORTES — actas oficiales listas para imprimir (jsPDF)
  // ============================================================

  // Umbrales de la clasificación del desempeño docente (fáciles de ajustar)
  const UMBRAL_EXCELENTE = 90;   // promedio >= 90  → EXCELENTE
  const UMBRAL_MUY_BUENO = 75;   // promedio >= 75  → MUY BUENO
  //                                promedio <  75  → REGULAR

  // Encabezado institucional centrado (va en TODOS los reportes).
  // Devuelve la coordenada Y donde puede empezar el contenido.
  const encabezadoInstitucional = (doc) => {
    const cx = doc.internal.pageSize.getWidth() / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('COMANDO DE INSTITUTOS MILITARES', cx, 18, { align: 'center' });
    doc.text('ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO', cx, 24, { align: 'center' });
    doc.text('"MCAL. ANDRÉS DE SANTA CRUZ"', cx, 30, { align: 'center' });
    doc.text('BOLIVIA', cx, 36, { align: 'center' });
    return 48;
  };

  // Bloque de firma centrado (va al pie de TODOS los reportes).
  // Si no queda espacio en la página, salta a una nueva.
  const bloqueFirma = (doc, y, comandante) => {
    const cx = doc.internal.pageSize.getWidth() / 2;
    const alto = doc.internal.pageSize.getHeight();
    if (y + 40 > alto - 15) { doc.addPage(); y = 30; }
    y += 30;
    doc.setLineWidth(0.3);
    doc.line(cx - 40, y, cx + 40, y); // línea para la firma
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text((comandante || 'POR ASIGNAR').toUpperCase(), cx, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('COMANDANTE DE LA ECEME.', cx, y + 12, { align: 'center' });
  };

  const nota2 = (v) => Number(v).toFixed(2);

  // --- Reporte 1: ACTA OFICIAL DE CALIFICACIONES (materia elegida) ---
  const descargarActaOficial = async () => {
    if (!actaMateriaId) return toast.error('SELECCIONE UNA MATERIA PARA EL ACTA');
    try {
      const { data } = await api.get(`/reportes/acta/${actaMateriaId}`);
      const doc = new jsPDF({ format: 'letter' });
      const cx = doc.internal.pageSize.getWidth() / 2;
      let y = encabezadoInstitucional(doc);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('ACTA OFICIAL DE CALIFICACIONES', cx, y, { align: 'center' });
      y += 7;
      doc.setFontSize(10);
      doc.text(`MATERIA: ${data.materia}  ·  ${data.ciclo || ''}  ·  GESTIÓN ${data.gestion}`, cx, y, { align: 'center' });
      y += 6;

      doc.autoTable({
        startY: y,
        head: [['N°', 'CÓDIGO', 'CURSANTE', 'GRADO', '1ER PARCIAL\n30%', 'EXAMEN FINAL\n60%', 'TRABAJOS\n10%', 'NOTA\nFINAL']],
        // Orden de mérito: el backend ya manda la lista de mayor a menor
        body: data.registros.map((r, i) => [
          i + 1, r.codigo, r.nombre, r.grado || '—',
          nota2(r.parcial_1), nota2(r.parcial_final), nota2(r.trabajos), nota2(r.nota_final)
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, halign: 'center', cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: { 2: { halign: 'left' } },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}`, 15, y);
      y += 6;
      // Si el acta ya fue sellada como bloque en la cadena, se deja constancia
      if (data.sello) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(`Documento sellado en la cadena, bloque N° ${data.sello.bloque}, hash: ${data.sello.hash}`, 15, y, { maxWidth: 185 });
        y += 8;
      }

      bloqueFirma(doc, y, data.comandante);
      doc.save(`Acta_Oficial_${data.materia.replaceAll(' ', '_')}.pdf`);
      toast.success('ACTA OFICIAL GENERADA');
    } catch (err) {
      toast.error(err.response?.data?.message?.toUpperCase?.() || 'ERROR AL GENERAR EL ACTA');
    }
  };

  // --- Reporte 2: DESEMPEÑO DEL PERSONAL DE DOCENTES ---
  const descargarDesempenoDocente = async () => {
    try {
      const { data } = await api.get('/reportes/desempeno-docente');
      if (!data.docentes || data.docentes.length === 0) return toast.error('AÚN NO HAY EVALUACIONES DOCENTES REGISTRADAS');

      const doc = new jsPDF({ format: 'letter' });
      const cx = doc.internal.pageSize.getWidth() / 2;
      let y = encabezadoInstitucional(doc);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('DESEMPEÑO DEL PERSONAL DE DOCENTES DE LA ECEME.', cx, y, { align: 'center' });
      y += 6;
      doc.setFontSize(10);
      doc.text(`GESTIÓN ${data.gestion}`, cx, y, { align: 'center' });
      y += 8;

      // Salta de página si no queda espacio para el siguiente bloque
      const asegurarEspacio = (necesario) => {
        if (y + necesario > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 25; }
      };

      // ---------- I. Desempeño específico por materias ----------
      doc.setFontSize(11);
      doc.text('I. DESEMPEÑO ESPECÍFICO POR MATERIAS', 15, y);
      y += 4;
      // Cuadro con la lista de criterios reales del sistema y su descripción
      doc.autoTable({
        startY: y,
        head: [['N°', 'CRITERIO DE EVALUACIÓN']],
        body: data.criterios.map((c, i) => [`C${i + 1}`, c.pregunta]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'center', cellWidth: 14 } },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 6;

      // Por cada docente: tabla con sus materias, la nota de cada criterio y el TOTAL
      const encabezadoCriterios = ['MATERIA', ...data.criterios.map((c, i) => `C${i + 1}`), 'TOTAL'];
      data.docentes.forEach(d => {
        asegurarEspacio(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${d.grado || ''} ${d.docente}`.trim().toUpperCase(), 15, y);
        y += 2;
        doc.autoTable({
          startY: y,
          head: [encabezadoCriterios],
          body: d.materias.map(m => [
            m.materia,
            ...data.criterios.map(c => m.notas[c.id] != null ? nota2(m.notas[c.id]) : '—'),
            nota2(m.total)
          ]),
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, halign: 'center', cellPadding: 1.5 },
          headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { halign: 'left' } },
          margin: { left: 15, right: 15 }
        });
        y = doc.lastAutoTable.finalY + 6;
      });

      // ---------- II. Desempeño de los docentes en general ----------
      asegurarEspacio(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('II. DESEMPEÑO DE LOS DOCENTES EN GENERAL', 15, y);
      y += 4;
      const cuerpoGeneral = [];
      data.docentes.forEach(d => {
        d.materias.forEach((m, i) => {
          cuerpoGeneral.push([i === 0 ? `${d.grado || ''} ${d.docente}`.trim() : '', m.materia, nota2(m.total)]);
        });
        cuerpoGeneral.push([{ content: 'PROMEDIO GENERAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                            { content: nota2(d.promedio_general), styles: { fontStyle: 'bold' } }]);
      });
      doc.autoTable({
        startY: y,
        head: [['DOCENTE', 'MATERIA', 'NOTA /100']],
        body: cuerpoGeneral,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 2: { halign: 'center' } },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 8;

      // ---------- III. Desempeño general (clasificación) ----------
      const clasificar = (p) => p >= UMBRAL_EXCELENTE ? 'EXCELENTE' : p >= UMBRAL_MUY_BUENO ? 'MUY BUENO' : 'REGULAR';
      const conteo = { 'EXCELENTE': 0, 'MUY BUENO': 0, 'REGULAR': 0 };
      data.docentes.forEach(d => { conteo[clasificar(d.promedio_general)]++; });

      asegurarEspacio(50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('III. DESEMPEÑO GENERAL', 15, y);
      y += 4;
      doc.autoTable({
        startY: y,
        head: [['DOCENTE', 'PROMEDIO /100', 'CLASIFICACIÓN']],
        body: [
          ...data.docentes.map(d => [`${d.grado || ''} ${d.docente}`.trim(), nota2(d.promedio_general), clasificar(d.promedio_general)]),
          [{ content: `RESUMEN: EXCELENTE (>= ${UMBRAL_EXCELENTE}): ${conteo['EXCELENTE']}  ·  MUY BUENO (>= ${UMBRAL_MUY_BUENO}): ${conteo['MUY BUENO']}  ·  REGULAR: ${conteo['REGULAR']}`,
             colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } }]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 4;

      bloqueFirma(doc, y, data.comandante);
      doc.save('Desempeno_Docentes_ECEME.pdf');
      toast.success('REPORTE DE DESEMPEÑO GENERADO');
    } catch (err) {
      toast.error(err.response?.data?.message?.toUpperCase?.() || 'ERROR AL GENERAR EL REPORTE');
    }
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
                  <Input placeholder="CARNET DE IDENTIDAD (CI)" inputMode="numeric" value={alumnoForm.ci} onChange={e => setAlumnoForm({...alumnoForm, ci: e.target.value.replace(/\D/g, '')})} maxLength={9} className="font-bold" required />
                  <Input placeholder="GRADO" value={alumnoForm.grado} onChange={e => setAlumnoForm({...alumnoForm, grado: e.target.value})} className="font-bold uppercase" required />

                  <Select value={alumnoForm.ciclo} onValueChange={v => setAlumnoForm({...alumnoForm, ciclo: v, asignacion_id: '', materia_id: '', docente_id: ''})}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="CICLO" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PRIMER CICLO">PRIMER CICLO</SelectItem>
                        <SelectItem value="SEGUNDO CICLO">SEGUNDO CICLO</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={alumnoForm.asignacion_id}
                    onValueChange={v => {
                      const a = asignaciones.find(x => String(x.dm_id) === v);
                      setAlumnoForm({...alumnoForm, asignacion_id: v, materia_id: a ? String(a.materia_id) : '', docente_id: a ? String(a.docente_id) : ''});
                    }}>
                    <SelectTrigger className="font-bold border-primary/40 h-auto"><SelectValue placeholder="ASIGNAR MATERIA Y DOCENTE" /></SelectTrigger>
                    <SelectContent>
                      {asignaciones.filter(a => a.ciclo === alumnoForm.ciclo).length === 0 ? (
                        <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase">SIN MATERIAS CON DOCENTE EN ESTE CICLO</div>
                      ) : asignaciones.filter(a => a.ciclo === alumnoForm.ciclo).map(a => (
                        <SelectItem key={a.dm_id} value={String(a.dm_id)}>
                          <div className="flex flex-col text-left">
                            <span className="font-bold uppercase text-xs">{a.materia}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">→ {a.docente}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">El código (CUR-XXX) se genera automáticamente</p>
                  <Button type="submit" className="w-full bg-secondary text-secondary-foreground font-black uppercase shadow-lg">Registrar</Button>
                </form>
              </div>

              {/* Registro Docente */}
              <div className="bg-card border-2 border-border p-6 relative shadow-md">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
                <h3 className="font-black mb-6 uppercase text-xs tracking-widest text-muted-foreground">Registro de Docente</h3>
                <form onSubmit={handleAddDocente} className="space-y-4">
                  <Input placeholder="NOMBRE COMPLETO" value={docenteForm.nombre} onChange={e => setDocenteForm({...docenteForm, nombre: e.target.value})} className="font-bold uppercase" required />
                  <Input placeholder="CARNET DE IDENTIDAD (CI)" inputMode="numeric" value={docenteForm.ci} onChange={e => setDocenteForm({...docenteForm, ci: e.target.value.replace(/\D/g, '')})} maxLength={9} className="font-bold" required />
                  <Input placeholder="GRADO" value={docenteForm.grado} onChange={e => setDocenteForm({...docenteForm, grado: e.target.value})} className="font-bold uppercase" required />

                  <div className="space-y-1">
                    <Select value={docenteForm.materia_id} onValueChange={v => setDocenteForm({...docenteForm, materia_id: v})}>
                      <SelectTrigger className="font-bold border-primary/40"><SelectValue placeholder="ASIGNAR MATERIA" /></SelectTrigger>
                      <SelectContent>
                        {materias.map(m => (
                          <SelectItem key={m.id} value={m.id.toString()}>
                            {m.nombre} · {m.ciclo === 'PRIMER CICLO' ? '1ER' : '2DO'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {docenteForm.materia_id && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground pl-1">
                        {docentesDeMateria(docenteForm.materia_id).length > 0
                          ? `DOCENTE(S): ${docentesDeMateria(docenteForm.materia_id).map(d => d.nombre).join(', ')} (${docentesDeMateria(docenteForm.materia_id).length}/3)`
                          : 'DOCENTE AÚN SIN ASIGNAR'}
                      </p>
                    )}
                  </div>

                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">El código (DOC-XXX) se genera automáticamente</p>
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
                  <div className="space-y-2">
                    <Select value={materiaCiclo} onValueChange={setMateriaCiclo}>
                      <SelectTrigger className="font-bold"><SelectValue placeholder="CICLO" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIMER CICLO">PRIMER CICLO</SelectItem>
                        <SelectItem value="SEGUNDO CICLO">SEGUNDO CICLO</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex space-x-2">
                      <Input value={materiaName} onChange={e => setMateriaName(e.target.value)} className="font-bold" placeholder="NOMBRE..." />
                      <Button onClick={handleAddMateria} className="bg-primary"><Plus/></Button>
                    </div>

                    {materias.length > 0 && (
                      <div className="pt-2 border-t-2 border-border flex space-x-2">
                        <Select value={materiaToDelete} onValueChange={setMateriaToDelete}>
                          <SelectTrigger className="font-bold text-xs"><SelectValue placeholder="ELIMINAR MATERIA..." /></SelectTrigger>
                          <SelectContent>
                            {materias.map(m => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.nombre} · {m.ciclo === 'PRIMER CICLO' ? '1ER' : '2DO'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => { if (materiaToDelete) { handleDeleteMateria(Number(materiaToDelete)); setMateriaToDelete(''); } }}
                          disabled={!materiaToDelete}
                          className="bg-destructive shrink-0 disabled:opacity-40">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Directorio de Personal Militar */}
            <div className="bg-card border-2 border-border p-6 shadow-xl">
              <h2 className="font-black uppercase mb-6 flex items-center text-xl tracking-tighter">
                <Users className="mr-3 text-primary" size={28}/> Directorio de Personal
              </h2>

              {/* Controles: pestañas + buscador */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex gap-2">
                  <Button
                    onClick={() => changeDirTab('estudiante')}
                    className={`font-black text-xs uppercase h-10 rounded-none ${dirTab === 'estudiante' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <GraduationCap size={16} className="mr-2" /> Cursantes ({estudiantes.length})
                  </Button>
                  <Button
                    onClick={() => changeDirTab('docente')}
                    className={`font-black text-xs uppercase h-10 rounded-none ${dirTab === 'docente' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <BookMarked size={16} className="mr-2" /> Docentes ({docentes.length})
                  </Button>
                </div>
                <div className="relative w-full md:w-72">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={dirSearch}
                    onChange={e => changeDirSearch(e.target.value)}
                    placeholder="BUSCAR POR NOMBRE, CÓDIGO, CI, MATERIA O CICLO..."
                    className="pl-9 font-bold text-xs uppercase" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="military-table w-full">
                  <thead>
                    <tr>
                      <th className="text-[10px] uppercase">TIPO</th>
                      <th className="text-left">GRADO Y NOMBRE COMPLETO</th>
                      <th className="text-left">CÓDIGO</th>
                      <th className="text-left">CI</th>
                      <th className="text-left">CICLO</th>
                      <th className="text-left">MATERIA ASIGNADA</th>
                      <th className="text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dirPageItems.length === 0 ? (
                      <tr><td colSpan="7" className="text-center p-12 font-bold text-muted-foreground tracking-widest uppercase">Sin resultados</td></tr>
                    ) : dirPageItems.map(user => (
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
                        <td className="text-xs font-bold">{user.ci || '—'}</td>
                        <td className="text-[10px] font-bold uppercase text-muted-foreground">{user.type === 'docente' ? '—' : (user.ciclo || '—')}</td>
                        <td>
                           {editingId === user.id ? (
                             editForm.type === 'docente' ? (
                               <div className="flex flex-wrap gap-1 max-w-[240px]">
                                 {materias.map(m => {
                                   const active = (editForm.materia_ids || []).includes(m.id);
                                   return (
                                     <button
                                       type="button"
                                       key={m.id}
                                       onClick={() => setEditForm({...editForm, materia_ids: toggleMateria(editForm.materia_ids, m.id)})}
                                       className={`text-[8px] font-black uppercase px-2 py-1 border-2 ${active ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border'}`}>
                                       {m.nombre}
                                     </button>
                                   );
                                 })}
                               </div>
                             ) : (
                               <Select value={editForm.materia_id} onValueChange={v => setEditForm({...editForm, materia_id: v})}>
                                  <SelectTrigger className="h-8 text-[10px] font-black uppercase border-2">
                                      <SelectValue placeholder="CAMBIAR MATERIA" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {materias.filter(m => m.ciclo === editForm.ciclo).map(m => (
                                          <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                                      ))}
                                  </SelectContent>
                               </Select>
                             )
                          ) : (
                            <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded-sm">
                                {user.type === 'docente'
                                  ? (user.materias_nombres || 'SIN ASIGNACIÓN')
                                  : (materias.find(m => m.id == user.materia_id)?.nombre || 'SIN ASIGNACIÓN')}
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
                              <button onClick={() => handleResetPassword(user)} title="RESTABLECER CONTRASEÑA" className="text-amber-600 hover:scale-125 transition-transform"><KeyRound size={18}/></button>
                              <button onClick={() => handleDeleteUser(user.id, user.type)} className="text-destructive hover:scale-125 transition-transform"><Trash2 size={18}/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t-2 border-border">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {dirFiltered.length} registro(s) · Página {dirCurrentPage} de {dirTotalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setDirPage(p => Math.max(1, p - 1))}
                    disabled={dirCurrentPage <= 1}
                    variant="outline"
                    className="h-9 rounded-none border-2 font-black text-xs uppercase disabled:opacity-40">
                    <ChevronLeft size={16} className="mr-1" /> Anterior
                  </Button>
                  <Button
                    onClick={() => setDirPage(p => Math.min(dirTotalPages, p + 1))}
                    disabled={dirCurrentPage >= dirTotalPages}
                    variant="outline"
                    className="h-9 rounded-none border-2 font-black text-xs uppercase disabled:opacity-40">
                    Siguiente <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Consolidado Académico */}
            <div className="bg-card border-2 border-border p-6 shadow-xl">
               <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                 <div>
                   <h2 className="font-black uppercase tracking-tighter flex items-center text-xl"><BookOpen className="mr-3 text-primary"/> Consolidado Académico</h2>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control centralizado de calificaciones MySQL</p>
                 </div>
                 <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                   <Button onClick={handlePublishNotes} className="bg-destructive text-destructive-foreground font-black text-xs uppercase h-11 px-8 rounded-none border-b-4 border-black/20">
                     <RefreshCw size={16} className="mr-2" /> Publicar Tablero
                   </Button>
                   {/* Módulo de reportes: acta oficial (por materia) y desempeño docente */}
                   <div className="flex gap-2 items-center">
                     <Select value={actaMateriaId} onValueChange={setActaMateriaId}>
                       <SelectTrigger className="h-11 w-56 font-bold text-[10px] uppercase border-2 border-primary rounded-none">
                         <SelectValue placeholder="MATERIA DEL ACTA..." />
                       </SelectTrigger>
                       <SelectContent>
                         {materias.map(m => (
                           <SelectItem key={m.id} value={String(m.id)}>
                             {m.nombre} · {m.ciclo === 'PRIMER CICLO' ? '1ER' : '2DO'}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <Button onClick={descargarActaOficial} variant="outline" className="border-2 border-primary font-bold text-xs uppercase h-11 rounded-none shadow-sm">
                       <FileDown size={16} className="mr-2" /> Descargar acta oficial
                     </Button>
                   </div>
                   <Button onClick={descargarDesempenoDocente} variant="outline" className="border-2 border-accent font-bold text-xs uppercase h-11 rounded-none shadow-sm">
                     <FileDown size={16} className="mr-2" /> Reporte de desempeño docente
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

            {/* Acceso a la página de Auditoría (logs de actividad de usuarios) */}
            <div className="flex justify-center pt-2">
              <Button
                onClick={() => navigate('/admin/auditoria')}
                className="bg-primary text-primary-foreground font-black text-xs uppercase h-12 px-10 rounded-none border-b-4 border-black/20 shadow-lg">
                <ScrollText size={18} className="mr-3" /> Auditoría
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminPage;