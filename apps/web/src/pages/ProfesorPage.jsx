
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BookMarked } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';

const ProfesorPage = () => {
  const { currentUser } = useAuth();
  const [docenteId, setDocenteId] = useState(null);
  const [estudiantes, setEstudiantes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [notasGuardadas, setNotasGuardadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    estudiante_id: '',
    materia_id: '',
    parcial1: '',
    parcial_final: '',
    trabajos: ''
  });

  const fetchData = async () => {
    try {
      // Find the docente record associated with this user
      const docentesRes = await pb.collection('docentes').getList(1, 1, {
        filter: `nombre = "${currentUser.nombre}"`,
        $autoCancel: false
      });
      let currentDocenteId = null;
      if (docentesRes.items.length > 0) {
        currentDocenteId = docentesRes.items[0].id;
        setDocenteId(currentDocenteId);
      } else {
        toast.error('NO SE ENCONTRÓ REGISTRO DE DOCENTE PARA ESTE USUARIO.');
      }

      const estRes = await pb.collection('estudiantes').getFullList({ sort: 'nombre', $autoCancel: false });
      setEstudiantes(estRes);

      const matRes = await pb.collection('materias').getFullList({ sort: 'nombre', $autoCancel: false });
      setMaterias(matRes);

      if (currentDocenteId) {
        const notasRes = await pb.collection('notas').getFullList({
          filter: `docente_id = "${currentDocenteId}"`,
          expand: 'estudiante_id,materia_id',
          sort: '-updated',
          $autoCancel: false
        });
        setNotasGuardadas(notasRes);
      }
    } catch (error) {
      console.error('Error fetching data', error);
      toast.error('ERROR CARGANDO DATOS.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!docenteId) {
      toast.error('NO TIENE PERMISOS DE DOCENTE VINCULADOS.');
      return;
    }

    if (!formData.estudiante_id || !formData.materia_id || formData.parcial1 === '' || formData.parcial_final === '' || formData.trabajos === '') {
      toast.error('COMPLETE TODOS LOS CAMPOS.');
      return;
    }

    const p1 = Number(formData.parcial1);
    const pf = Number(formData.parcial_final);
    const tb = Number(formData.trabajos);

    if (p1 < 0 || p1 > 100 || pf < 0 || pf > 100 || tb < 0 || tb > 100) {
      toast.error('LAS NOTAS DEBEN ESTAR ENTRE 0 Y 100.');
      return;
    }

    setLoading(true);

    try {
      const estudiante = estudiantes.find(e => e.id === formData.estudiante_id);
      
      const payload = {
        estudiante_id: formData.estudiante_id,
        docente_id: docenteId,
        materia_id: formData.materia_id,
        parcial1: p1,
        parcial_final: pf,
        trabajos: tb,
        ciclo: estudiante?.ciclo || 'PRIMER CICLO'
      };

      await pb.collection('notas').create(payload, { $autoCancel: false });
      toast.success('NOTA GUARDADA CORRECTAMENTE');
      setFormData({ estudiante_id: '', materia_id: '', parcial1: '', parcial_final: '', trabajos: '' });
      fetchData(); // Refresh list
    } catch (error) {
      console.error('Submit note error:', error);
      toast.error('ERROR AL GUARDAR LA NOTA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>PORTAL DOCENTE - ECEME</title>
      </Helmet>
      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <BookMarked size={24} />
            </div>
            <div>
              <h1 className="text-3xl text-primary tracking-widest">PORTAL DOCENTE</h1>
              <p className="text-muted-foreground font-bold tracking-widest">INGRESAR CALIFICACIONES ACADÉMICAS</p>
            </div>
          </div>

          {fetching ? (
            <div className="text-center py-12 font-bold tracking-widest">CARGANDO DATOS...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form Section */}
              <div className="lg:col-span-1">
                <div className="bg-card p-6 rounded-sm shadow-md border-t-4 border-primary">
                  <h3 className="font-extrabold mb-6 tracking-widest text-foreground">NUEVO REGISTRO</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label className="font-bold tracking-widest">ESTUDIANTE</Label>
                      <Select onValueChange={(val) => setFormData({ ...formData, estudiante_id: val })} value={formData.estudiante_id}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="SELECCIONE ESTUDIANTE" />
                        </SelectTrigger>
                        <SelectContent>
                          {estudiantes.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre} ({e.ciclo})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="font-bold tracking-widest">MATERIA</Label>
                      <Select onValueChange={(val) => setFormData({ ...formData, materia_id: val })} value={formData.materia_id}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="SELECCIONE MATERIA" />
                        </SelectTrigger>
                        <SelectContent>
                          {materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="parcial1" className="font-bold tracking-widest">NOTA 1ER PARCIAL (0-100)</Label>
                      <Input
                        id="parcial1" name="parcial1" type="number" min="0" max="100"
                        value={formData.parcial1} onChange={handleChange} required className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="parcial_final" className="font-bold tracking-widest">NOTA PARCIAL FINAL (0-100)</Label>
                      <Input
                        id="parcial_final" name="parcial_final" type="number" min="0" max="100"
                        value={formData.parcial_final} onChange={handleChange} required className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="trabajos" className="font-bold tracking-widest">NOTA TRABAJOS (0-100)</Label>
                      <Input
                        id="trabajos" name="trabajos" type="number" min="0" max="100"
                        value={formData.trabajos} onChange={handleChange} required className="mt-1"
                      />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold tracking-widest mt-4">
                      {loading ? 'GUARDANDO...' : 'GUARDAR NOTA'}
                    </Button>
                  </form>
                </div>
              </div>

              {/* Table Section */}
              <div className="lg:col-span-2">
                <div className="bg-card rounded-sm shadow-md border border-border p-6 overflow-x-auto">
                  <h3 className="font-extrabold mb-6 tracking-widest text-foreground">REGISTROS RECIENTES</h3>
                  {notasGuardadas.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground font-bold tracking-widest">NO HAY REGISTROS PREVIOS.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-primary">
                          <TableHead className="font-extrabold text-foreground">ALUMNO</TableHead>
                          <TableHead className="font-extrabold text-foreground">MATERIA</TableHead>
                          <TableHead className="font-extrabold text-foreground text-center">P1</TableHead>
                          <TableHead className="font-extrabold text-foreground text-center">PF</TableHead>
                          <TableHead className="font-extrabold text-foreground text-center">TR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notasGuardadas.map((nota) => (
                          <TableRow key={nota.id}>
                            <TableCell className="font-bold text-foreground py-3">{nota.expand?.estudiante_id?.nombre}</TableCell>
                            <TableCell className="text-muted-foreground py-3">{nota.expand?.materia_id?.nombre}</TableCell>
                            <TableCell className="text-center py-3">{nota.parcial1}</TableCell>
                            <TableCell className="text-center py-3">{nota.parcial_final}</TableCell>
                            <TableCell className="text-center py-3">{nota.trabajos}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfesorPage;
