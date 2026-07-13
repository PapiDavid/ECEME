
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';

const NoteForm = ({ note, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    calificacion: 5,
    fecha: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (note) {
      setFormData({
        titulo: note.titulo,
        descripcion: note.descripcion,
        calificacion: note.calificacion,
        fecha: note.fecha,
      });
    }
  }, [note]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'calificacion' ? Number(value) : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titulo || !formData.descripcion) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    if (formData.calificacion < 1 || formData.calificacion > 10) {
      toast.error('La calificación debe estar entre 1 y 10');
      return;
    }

    setLoading(true);

    try {
      const data = {
        ...formData,
        userId: currentUser.id,
      };

      if (note) {
        await pb.collection('notes').update(note.id, data, { $autoCancel: false });
        toast.success('Nota actualizada correctamente');
      } else {
        await pb.collection('notes').create(data, { $autoCancel: false });
        toast.success('Nota creada correctamente');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Error al guardar la nota. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          name="titulo"
          type="text"
          value={formData.titulo}
          onChange={handleChange}
          required
          className="mt-2 text-foreground"
          placeholder="Título de la nota"
        />
      </div>

      <div>
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          required
          rows={4}
          className="mt-2 text-foreground"
          placeholder="Descripción detallada"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="calificacion">Calificación (1-10)</Label>
          <Input
            id="calificacion"
            name="calificacion"
            type="number"
            min="1"
            max="10"
            value={formData.calificacion}
            onChange={handleChange}
            required
            className="mt-2 text-foreground"
          />
        </div>

        <div>
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            value={formData.fecha}
            onChange={handleChange}
            required
            className="mt-2 text-foreground"
          />
        </div>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 transition-all duration-200 active:scale-95"
        >
          {loading ? 'Guardando...' : note ? 'Actualizar nota' : 'Crear nota'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 transition-all duration-200 active:scale-95"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default NoteForm;
