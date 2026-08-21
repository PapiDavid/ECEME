import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, Users, BookOpen, Settings, FileDown, RefreshCw, Plus, Trash2, Edit3, Save, X, GraduationCap, BookMarked, Search, ChevronLeft, ChevronRight, KeyRound, ScrollText } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import api from '@/lib/api';
import { validarPersona, validarNombreMateria } from '@/lib/validaciones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Escudo institucional para el membrete de los PDF. jsPDF necesita la imagen
// como data URL, así que se lee una sola vez y se guarda en caché (fuera del
// componente, para que sobreviva a los re-renders).
let logoCache;
const cargarLogo = async () => {
  if (logoCache !== undefined) return logoCache;
  try {
    const res = await fetch('/Imagenes/LOGO.png');
    const blob = await res.blob();
    logoCache = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = reject;
      lector.readAsDataURL(blob);
    });
  } catch (e) {
    // Si el escudo no se puede leer, el reporte igual se genera (sin logo)
    console.error('No se pudo cargar el escudo para el PDF:', e);
    logoCache = null;
  }
  return logoCache;
};

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
  // Catálogos oficiales de grados (vienen del backend). Van separados por rol:
  // el cursante es capitán o mayor; el docente es jefe, general o civil con
  // posgrado. Así el desplegable no ofrece grados que no corresponden.
  const [gradosCursante, setGradosCursante] = useState([]);
  const [gradosDocente, setGradosDocente] = useState([]);

  // Estados de formularios (el código se genera automáticamente en el backend)
  const [alumnoForm, setAlumnoForm] = useState({ nombre: '', ci: '', grado: '', ciclo: 'PRIMER CICLO', asignacion_id: '', materia_id: '', docente_id: '' });
  const [docenteForm, setDocenteForm] = useState({ nombre: '', ci: '', grado: '', materia_id: '' });

  const toggleMateria = (arr, id) => (arr || []).includes(id) ? arr.filter(x => x !== id) : [...(arr || []), id];
  // Docentes que ya dictan una materia (según su lista de materia_ids)
  const docentesDeMateria = (materiaId) => docentes.filter(d =>
    d.materia_ids && String(d.materia_ids).split(',').map(Number).includes(Number(materiaId)));
  // Catálogo de grados que corresponde a cada tipo de persona
  const gradosDe = (tipo) => (tipo === 'docente' ? gradosDocente : gradosCursante);
  // Tope de docentes por materia (misma regla que aplica el backend)
  const MAX_DOCENTES = 3;
  const materiaLlena = (materiaId) => docentesDeMateria(materiaId).length >= MAX_DOCENTES;
  // El docente no tiene ciclo propio: lo hereda de las materias que dicta.
  // Si dicta en los dos, se muestran ambos.
  const ciclosDeDocente = (docente) => {
    const ids = String(docente.materia_ids || '').split(',').map(Number).filter(Boolean);
    const ciclos = [...new Set(materias.filter(m => ids.includes(m.id)).map(m => m.ciclo))];
    return ciclos.map(c => c === 'PRIMER CICLO' ? '1ER' : '2DO').join(' · ');
  };
  const [materiaName, setMateriaName] = useState('');
  const [materiaCiclo, setMateriaCiclo] = useState('PRIMER CICLO');
  const [comandanteName, setComandanteName] = useState('');
  // Materia elegida para descargar su acta oficial en PDF (una por cada ciclo,
  // porque ahora el Consolidado tiene un tablero independiente por ciclo)
  const [actaMatPrimer, setActaMatPrimer] = useState('');
  const [actaMatSegundo, setActaMatSegundo] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Directorio de personal: pestaña, buscador y paginación
  const [dirTab, setDirTab] = useState('estudiante');
  const [dirSearch, setDirSearch] = useState('');
  const [dirPage, setDirPage] = useState(1);
  const PAGE_SIZE = 10;

  // Paginación del Consolidado Académico: una por cada tablero de ciclo
  const [consPagePrimer, setConsPagePrimer] = useState(1);
  const [consPageSegundo, setConsPageSegundo] = useState(1);


  const fetchData = async () => {
    setLoading(true);
    try {
      const [matRes, critRes, confRes, notasRes, estRes, docRes, asigRes, catRes] = await Promise.all([
        api.get('/materias'),
        api.get('/criterios'),
        api.get('/configuracion'),
        api.get('/notas/consolidado'),
        api.get('/admin/estudiantes'),
        api.get('/admin/docentes'),
        api.get('/asignaciones'),
        api.get('/catalogos')
      ]);

      setGradosCursante(catRes.data.grados_cursante || []);
      setGradosDocente(catRes.data.grados_docente || []);
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

  // Publica el acta de UN ciclo (PRIMER/SEGUNDO) y la sella como bloque encadenado
  // (SHA-256) — core del proyecto. Cada ciclo genera su propio bloque, pero todos
  // cuelgan de la MISMA cadena: el bloque del 2do ciclo enlaza con el del 1ro.
  const handlePublishNotes = async (ciclo) => {
    if (!window.confirm(`¿PUBLICAR LAS CALIFICACIONES DEL ${ciclo}?\n\nEL ACTA QUEDARÁ SELLADA COMO UN BLOQUE INMUTABLE EN LA CADENA (BLOCKCHAIN).`)) return;
    try {
      const { data } = await api.post('/actas/publicar', { ciclo });
      toast.success(`ACTA DEL ${ciclo} SELLADA EN LA CADENA (BLOQUE #${data.indice})`);
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

  // La edición exige exactamente lo mismo que el alta (nombre y grado válidos);
  // el servidor vuelve a validar, así que no se puede saltar desde el navegador.
  const handleUpdateUser = async () => {
    const error = validarPersona(editForm, gradosDe(editForm.type));
    if (error) return toast.error(error);
    try {
      const endpoint = editForm.type === 'estudiante' ? `/admin/estudiantes/${editingId}` : `/admin/docentes/${editingId}`;
      await api.put(endpoint, editForm);
      toast.success('REGISTRO ACTUALIZADO');
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast.error(mensajeError(err, 'ERROR AL ACTUALIZAR'));
    }
  };

  const handleDeleteUser = async (user) => {
    const quien = `${user.codigo} — ${user.grado || ''} ${user.nombre}`.trim();
    if (!window.confirm(`¿ELIMINAR DEFINITIVAMENTE A ${quien}?\n\nSE BORRARÁ SU USUARIO Y NO SE PUEDE DESHACER.`)) return;
    try {
      const endpoint = user.type === 'estudiante' ? `/admin/estudiantes/${user.id}` : `/admin/docentes/${user.id}`;
      await api.delete(endpoint);
      toast.success('REGISTRO ELIMINADO');
      fetchData();
    } catch (err) {
      toast.error(mensajeError(err, 'ERROR AL ELIMINAR'));
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

  // Mensaje del servidor (ej. "Ya existe un registro con ese CI: DOC-012")
  // en vez de un "ERROR" genérico que no dice qué corregir.
  const mensajeError = (err, porDefecto) =>
    err.response?.data?.message?.toUpperCase?.() || porDefecto;

  const handleAddAlumno = async e => {
    e.preventDefault();
    const error = validarPersona(alumnoForm, gradosCursante, { conCI: true });
    if (error) return toast.error(error);
    if (!alumnoForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    try {
      const res = await api.post('/admin/estudiantes', { ...alumnoForm, password: "ECEME2026" });
      toast.success(`CURSANTE REGISTRADO: ${res.data.codigo}`);
      setAlumnoForm({ nombre: '', ci: '', grado: '', ciclo: 'PRIMER CICLO', asignacion_id: '', materia_id: '', docente_id: '' });
      fetchData();
    } catch (err) { toast.error(mensajeError(err, 'ERROR AL REGISTRAR')); }
  };

  const handleAddDocente = async e => {
    e.preventDefault();
    const error = validarPersona(docenteForm, gradosDocente, { conCI: true });
    if (error) return toast.error(error);
    if (!docenteForm.materia_id) return toast.error('SELECCIONE UNA MATERIA');
    if (materiaLlena(docenteForm.materia_id)) return toast.error(`ESA MATERIA YA TIENE EL MÁXIMO DE ${MAX_DOCENTES} DOCENTES`);
    try {
      const res = await api.post('/admin/docentes', { ...docenteForm, password: "ECEME2026" });
      toast.success(`DOCENTE REGISTRADO: ${res.data.codigo}`);
      setDocenteForm({ nombre: '', ci: '', grado: '', materia_id: '' });
      fetchData();
    } catch (err) { toast.error(mensajeError(err, 'ERROR AL REGISTRAR')); }
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
    const error = validarNombreMateria(materiaName);
    if (error) return toast.error(error);
    // Aviso inmediato del duplicado (el servidor lo rechaza igual)
    const yaExiste = materias.some(m =>
      m.nombre === materiaName.trim().replace(/\s+/g, ' ').toUpperCase() && m.ciclo === materiaCiclo);
    if (yaExiste) return toast.error(`LA MATERIA YA EXISTE EN EL ${materiaCiclo}`);
    try {
      await api.post('/admin/materias', { nombre: materiaName, ciclo: materiaCiclo });
      toast.success('MATERIA CREADA');
      setMateriaName('');
      fetchData();
    } catch (err) { toast.error(mensajeError(err, 'ERROR AL CREAR LA MATERIA')); }
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

  // Consolidado Académico dividido en dos tableros por ciclo. Cada uno con sus
  // notas, sus materias (para el acta) y su propia paginación de 10 filas.
  const notasPrimer = notasPendientes.filter(n => n.ciclo === 'PRIMER CICLO');
  const notasSegundo = notasPendientes.filter(n => n.ciclo === 'SEGUNDO CICLO');
  const materiasPrimer = materias.filter(m => m.ciclo === 'PRIMER CICLO');
  const materiasSegundo = materias.filter(m => m.ciclo === 'SEGUNDO CICLO');

  // Devuelve los datos de paginación de un tablero (página actual acotada al total)
  const paginar = (lista, page) => {
    const totalPages = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const items = lista.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    return { totalPages, currentPage, items };
  };
  const pagPrimer = paginar(notasPrimer, consPagePrimer);
  const pagSegundo = paginar(notasSegundo, consPageSegundo);

  // ============================================================
  //  MÓDULO DE REPORTES — actas oficiales listas para imprimir (jsPDF)
  // ============================================================

  // Umbrales de la clasificación del desempeño docente (fáciles de ajustar)
  const UMBRAL_EXCELENTE = 90;   // promedio >= 90  → EXCELENTE
  const UMBRAL_MUY_BUENO = 75;   // promedio >= 75  → MUY BUENO
  //                                promedio <  75  → REGULAR

  // Membrete institucional (va en TODOS los reportes): escudo arriba a la
  // izquierda con el nombre de la Escuela debajo, y el resto centrado.
  // Devuelve la coordenada Y donde puede empezar el contenido.
  const encabezadoInstitucional = (doc, logo) => {
    const cx = doc.internal.pageSize.getWidth() / 2;

    if (logo) {
      const LOGO_X = 15, LOGO_Y = 12, LOGO_LADO = 22;
      doc.addImage(logo, 'PNG', LOGO_X, LOGO_Y, LOGO_LADO, LOGO_LADO);
      // Nombre de la Escuela justo debajo del escudo. Va alineado a la izquierda
      // sobre el mismo margen (15 mm) que usan las tablas, para que el membrete
      // quede a plomo con el resto del documento.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO',
        LOGO_X, LOGO_Y + LOGO_LADO + 4,
        { maxWidth: 40, lineHeightFactor: 1.3 });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('COMANDO DE INSTITUTOS MILITARES', cx, 18, { align: 'center' });
    doc.text('ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO', cx, 24, { align: 'center' });
    doc.text('"MCAL. ANDRÉS DE SANTA CRUZ"', cx, 30, { align: 'center' });
    doc.text('BOLIVIA', cx, 36, { align: 'center' });
    // El escudo con su leyenda baja más que el bloque centrado
    return logo ? 52 : 48;
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
  const descargarActaOficial = async (materiaId) => {
    if (!materiaId) return toast.error('SELECCIONE UNA MATERIA PARA EL ACTA');
    try {
      const { data } = await api.get(`/reportes/acta/${materiaId}`);
      const logo = await cargarLogo();
      const doc = new jsPDF({ format: 'letter' });
      const cx = doc.internal.pageSize.getWidth() / 2;
      let y = encabezadoInstitucional(doc, logo);

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

      const logo = await cargarLogo();
      const doc = new jsPDF({ format: 'letter' });
      const cx = doc.internal.pageSize.getWidth() / 2;
      let y = encabezadoInstitucional(doc, logo);

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

  // Un tablero del Consolidado (idéntico para cada ciclo). No es un componente:
  // es una función que devuelve JSX, así que todo el estado vive en la página y
  // no hay remontajes. Cada tablero publica y descarga SOLO lo de su ciclo.
  const renderTablero = ({ titulo, ciclo, pag, materiasCiclo, actaMat, setActaMat, setPage, totalNotas }) => (
    <div className="bg-card border-2 border-border p-5 shadow-xl flex flex-col">
      <div className="flex items-center justify-between border-b-2 border-primary pb-3 mb-4 gap-2">
        <h3 className="font-black uppercase tracking-tighter flex items-center text-base md:text-lg">
          <BookOpen className="mr-2 text-primary shrink-0" size={20} /> {titulo}
        </h3>
        <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-1 rounded-sm whitespace-nowrap shrink-0">{totalNotas} nota(s)</span>
      </div>

      {/* Publicar el acta de ESTE ciclo (sella su bloque) + descargar su acta oficial */}
      <div className="flex flex-col gap-2 mb-4">
        <Button onClick={() => handlePublishNotes(ciclo)} className="w-full bg-destructive text-destructive-foreground font-black text-xs uppercase h-11 rounded-none border-b-4 border-black/20">
          <RefreshCw size={16} className="mr-2 shrink-0" /> Publicar acta · {titulo}
        </Button>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={actaMat} onValueChange={setActaMat}>
            <SelectTrigger className="h-11 flex-1 font-bold text-[10px] uppercase border-2 border-primary rounded-none">
              <SelectValue placeholder="MATERIA DEL ACTA..." />
            </SelectTrigger>
            <SelectContent>
              {materiasCiclo.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => descargarActaOficial(actaMat)} variant="outline" className="w-full sm:w-auto border-2 border-primary font-bold text-[11px] uppercase h-11 rounded-none shadow-sm shrink-0">
            <FileDown size={16} className="mr-2 shrink-0" /> Acta oficial
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="military-table w-full">
          <thead>
            <tr>
              <th className="text-[10px] uppercase">CURSANTE</th>
              <th className="text-[10px] uppercase">MATERIA</th>
              <th className="text-center text-[10px] uppercase">NOTA FINAL</th>
            </tr>
          </thead>
          <tbody>
            {pag.items.length === 0 ? (
              <tr><td colSpan="3" className="text-center p-10 font-bold text-muted-foreground tracking-widest uppercase text-[11px]">Sin planillas en este ciclo</td></tr>
            ) : (
              pag.items.map(n => (
                <tr key={n.id} className="hover:bg-muted/30">
                  <td className="font-bold uppercase text-[11px] py-3">{`${n.grado_estudiante || ''} ${n.nombre_estudiante}`.trim()}</td>
                  <td className="uppercase text-[10px] font-bold text-muted-foreground">{n.nombre_materia}</td>
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

      {/* Paginación: 10 filas por página */}
      {pag.items.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t-2 border-border">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Página {pag.currentPage} de {pag.totalPages}
          </span>
          <div className="flex gap-2">
            <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pag.currentPage <= 1} variant="outline" className="h-9 rounded-none border-2 font-black text-xs uppercase disabled:opacity-40">
              <ChevronLeft size={16} className="mr-1" /> Anterior
            </Button>
            <Button onClick={() => setPage(p => Math.min(pag.totalPages, p + 1))} disabled={pag.currentPage >= pag.totalPages} variant="outline" className="h-9 rounded-none border-2 font-black text-xs uppercase disabled:opacity-40">
              Siguiente <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

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
                  <Input placeholder="NOMBRE COMPLETO (SIN EL GRADO)" value={alumnoForm.nombre} onChange={e => setAlumnoForm({...alumnoForm, nombre: e.target.value})} maxLength={80} className="font-bold uppercase" required />
                  <Input placeholder="CARNET DE IDENTIDAD (CI)" inputMode="numeric" value={alumnoForm.ci} onChange={e => setAlumnoForm({...alumnoForm, ci: e.target.value.replace(/\D/g, '')})} maxLength={9} className="font-bold" required />

                  {/* Grados de cursante: capitán o mayor (lista cerrada) */}
                  <Select value={alumnoForm.grado} onValueChange={v => setAlumnoForm({...alumnoForm, grado: v})}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="GRADO" /></SelectTrigger>
                    <SelectContent>
                      {gradosCursante.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>

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
                  <Input placeholder="NOMBRE COMPLETO (SIN EL GRADO)" value={docenteForm.nombre} onChange={e => setDocenteForm({...docenteForm, nombre: e.target.value})} maxLength={80} className="font-bold uppercase" required />
                  <Input placeholder="CARNET DE IDENTIDAD (CI)" inputMode="numeric" value={docenteForm.ci} onChange={e => setDocenteForm({...docenteForm, ci: e.target.value.replace(/\D/g, '')})} maxLength={9} className="font-bold" required />

                  {/* Grados de docente: jefes, generales o civil con posgrado */}
                  <Select value={docenteForm.grado} onValueChange={v => setDocenteForm({...docenteForm, grado: v})}>
                    <SelectTrigger className="font-bold"><SelectValue placeholder="GRADO" /></SelectTrigger>
                    <SelectContent>
                      {gradosDocente.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="space-y-1">
                    <Select value={docenteForm.materia_id} onValueChange={v => setDocenteForm({...docenteForm, materia_id: v})}>
                      <SelectTrigger className="font-bold border-primary/40"><SelectValue placeholder="ASIGNAR MATERIA" /></SelectTrigger>
                      <SelectContent>
                        {/* Las materias que ya llegaron a 3 docentes salen en gris y
                            no se pueden elegir: el aviso llega ANTES de llenar el formulario */}
                        {materias.map(m => {
                          const llena = materiaLlena(m.id);
                          return (
                            <SelectItem key={m.id} value={m.id.toString()} disabled={llena}>
                              {m.nombre} · {m.ciclo === 'PRIMER CICLO' ? '1ER' : '2DO'}
                              {llena && <span className="text-[9px] font-black text-destructive"> · COMPLETA (3/3)</span>}
                            </SelectItem>
                          );
                        })}
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
                      <Input value={materiaName} onChange={e => setMateriaName(e.target.value)} maxLength={60} className="font-bold" placeholder="NOMBRE..." />
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
                              {/* Mismo desplegable que en el alta, según sea cursante o docente */}
                              <Select value={editForm.grado || ''} onValueChange={v => setEditForm({...editForm, grado: v})}>
                                <SelectTrigger className="h-8 text-[10px] font-bold w-32 border-2"><SelectValue placeholder="GRADO" /></SelectTrigger>
                                <SelectContent>
                                  {gradosDe(editForm.type).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input className="h-8 text-xs font-bold" value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} maxLength={80} />
                            </div>
                          ) : (
                            <span className="font-bold uppercase text-xs">{user.grado} {user.nombre}</span>
                          )}
                        </td>
                        <td className="text-xs font-mono font-bold">{user.codigo}</td>
                        <td className="text-xs font-bold">{user.ci || '—'}</td>
                        {/* El docente hereda el ciclo de las materias que dicta */}
                        <td className="text-[10px] font-bold uppercase text-muted-foreground">
                          {user.type === 'docente' ? (ciclosDeDocente(user) || '—') : (user.ciclo || '—')}
                        </td>
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
                              <button onClick={() => handleDeleteUser(user)} title="ELIMINAR REGISTRO" className="text-destructive hover:scale-125 transition-transform"><Trash2 size={18}/></button>
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

            {/* Consolidado Académico — un tablero independiente por ciclo.
                Cada tablero publica y descarga SÓLO su ciclo; ambos sellan sobre
                la MISMA cadena de bloques (el 2do ciclo enlaza con el 1ro). */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b-4 border-primary pb-4">
                <div>
                  <h2 className="font-black uppercase tracking-tighter flex items-center text-lg md:text-xl"><BookOpen className="mr-3 text-primary shrink-0"/> Consolidado Académico</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Un tablero por ciclo · cada uno sella su propia acta en la cadena</p>
                </div>
                <Button onClick={descargarDesempenoDocente} variant="outline" className="w-full sm:w-auto border-2 border-accent font-bold text-xs uppercase h-11 rounded-none shadow-sm shrink-0">
                  <FileDown size={16} className="mr-2 shrink-0" /> Reporte de desempeño docente
                </Button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                {renderTablero({
                  titulo: 'PRIMER CICLO', ciclo: 'PRIMER CICLO', pag: pagPrimer,
                  materiasCiclo: materiasPrimer, totalNotas: notasPrimer.length,
                  actaMat: actaMatPrimer, setActaMat: setActaMatPrimer, setPage: setConsPagePrimer
                })}
                {renderTablero({
                  titulo: 'SEGUNDO CICLO', ciclo: 'SEGUNDO CICLO', pag: pagSegundo,
                  materiasCiclo: materiasSegundo, totalNotas: notasSegundo.length,
                  actaMat: actaMatSegundo, setActaMat: setActaMatSegundo, setPage: setConsPageSegundo
                })}
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