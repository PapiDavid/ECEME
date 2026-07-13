
import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Star } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const NoteCard = ({ note, onEdit, onDelete }) => {
  return (
    <div className="bg-card rounded-xl p-6 shadow-md border border-border hover:shadow-lg transition-all duration-200 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-card-foreground flex-1">{note.titulo}</h3>
        <div className="flex items-center space-x-1 ml-4">
          <Star size={18} className="text-accent fill-accent" />
          <span className="font-semibold text-card-foreground">{note.calificacion}/10</span>
        </div>
      </div>

      <p className="text-card-foreground/80 mb-4 flex-1 leading-relaxed">{note.descripcion}</p>

      <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
        <span className="text-sm text-muted-foreground">
          {format(new Date(note.fecha), 'dd MMM yyyy', { locale: es })}
        </span>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(note)}
            className="transition-all duration-200 active:scale-95"
          >
            <Pencil size={16} className="mr-1" />
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(note.id)}
            className="transition-all duration-200 active:scale-95"
          >
            <Trash2 size={16} className="mr-1" />
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;
