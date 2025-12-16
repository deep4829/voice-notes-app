import React, { createContext, useContext, useState, useCallback } from 'react';
import { Note } from '@/types/note';

interface NotesContextType {
  notes: Note[];
  addNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateTitle: (id: string, title: string) => void;
  updateTranscription: (id: string, transcription: string) => void;
  updateFavorite: (id: string, isFavorite: boolean) => void;
  isLoading: boolean;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addNote = useCallback((note: Note) => {
    setNotes(prev => [note, ...prev]);
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, ...updates } : note
      )
    );
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, title, updatedAt: Date.now() } : note
      )
    );
  }, []);

  const updateTranscription = useCallback((id: string, transcription: string) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, transcription, updatedAt: Date.now() } : note
      )
    );
  }, []);

  const updateFavorite = useCallback((id: string, isFavorite: boolean) => {
    setNotes(prev =>
      prev.map(note =>
        note.id === id ? { ...note, isFavorite, updatedAt: Date.now() } : note
      )
    );
  }, []);

  return (
    <NotesContext.Provider value={{ notes, addNote, deleteNote, updateNote, updateTitle, updateTranscription, updateFavorite, isLoading }}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within NotesProvider');
  }
  return context;
};
