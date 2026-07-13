import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, FileText, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
// 1. Sustituimos PocketBase por nuestra instancia de Axios
import api from '@/lib/api'; 
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import NoteCard from '@/components/NoteCard.jsx';
import NoteForm from '@/components/NoteForm.jsx';

const NotesPage = () => {
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  const fetchNotes = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      // 2. Llamada al endpoint de Node.js + MySQL
      const response = await api.get(`/notes/usuario/${currentUser.id}`);
      setNotes(response.data);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('ERROR AL SINCRONIZAR BITÁCORA PERSONAL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [currentUser]);

  const handleEdit = (note) => {
    setEditingNote(note);
    setDialogOpen(true);
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('¿ELIMINAR ESTA NOTA DE LA BITÁCORA OFICIAL?')) return;

    try {
      // 3. Eliminación en MySQL
      await api.delete(`/notes/${noteId}`);
      toast.success('NOTA ELIMINADA CORRECTAMENTE');
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('ERROR AL ELIMINAR EL REGISTRO');
    }
  };

  const handleFormSuccess = () => {
    setDialogOpen(false);
    setEditingNote(null);
    fetchNotes();
  };

  const handleFormCancel = () => {
    setDialogOpen(false);
    setEditingNote(null);
  };

  const handleAddNew = () => {
    setEditingNote(null);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>BITÁCORA PERSONAL - ECEME</title>
        <meta name="description" content="Gestión de notas personales y apuntes de la ECEME." />
      </Helmet>

      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-between mb-8 border-b-4 border-primary pb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-widest uppercase">Mi Bitácora</h1>
                  <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase">
                    Personal: {currentUser?.nombre || 'USUARIO ECEME'}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAddNew}
                className="bg-primary hover:bg-primary/90 font-black tracking-widest uppercase px-6"
              >
                <Plus size={20} className="mr-2" />
                Nueva entrada
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card border-2 border-border p-6 h-40 animate-pulse">
                    <div className="h-4 bg-muted w-3/4 mb-4"></div>
                    <div className="h-3 bg-muted w-full mb-2"></div>
                    <div className="h-3 bg-muted w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : notes.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 border-2 border-dashed border-border bg-muted/20"
              >
                <FileText size={64} className="text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-black uppercase tracking-widest mb-2">Sin registros</h3>
                <p className="text-xs text-muted-foreground font-bold uppercase mb-8">
                  No hay apuntes personales registrados en su cuenta.
                </p>
                <Button onClick={handleAddNew} variant="outline" className="border-2 font-black uppercase">
                  Crear primera nota
                </Button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.map((note, index) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <NoteCard note={note} onEdit={handleEdit} onDelete={handleDelete} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] border-4 border-primary">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest">
              {editingNote ? 'EDITAR REGISTRO' : 'NUEVA ENTRADA DE BITÁCORA'}
            </DialogTitle>
          </DialogHeader>
          <NoteForm note={editingNote} onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotesPage;