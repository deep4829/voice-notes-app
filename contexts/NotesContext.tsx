import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '@/types/note';
import { cacheNotes, getCachedNotes, cacheAudioFile } from '@/utils/cacheManager';

interface NotesContextType {
  notes: Note[];
  addNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateTitle: (id: string, title: string) => void;
  updateTranscription: (id: string, transcription: string) => void;
  updateFavorite: (id: string, isFavorite: boolean) => void;
  isLoading: boolean;
  isOfflineMode: boolean;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);
const NOTES_STORAGE_KEY = 'notes';

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Load notes from AsyncStorage on mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        setIsLoading(true);
        const stored = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
        if (stored) {
          const parsedNotes = JSON.parse(stored);
          setNotes(parsedNotes);
          // Also update cache
          await cacheNotes(parsedNotes);
          console.log('[NotesContext] Loaded notes from storage');
        }
      } catch (error) {
        console.error('[NotesContext] Error loading notes:', error);
        // Fall back to cache if storage fails
        try {
          const cachedNotes = await getCachedNotes();
          setNotes(cachedNotes);
          setIsOfflineMode(true);
          console.log('[NotesContext] Loaded notes from cache');
        } catch (cacheError) {
          console.error('[NotesContext] Error loading from cache:', cacheError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();
  }, []);

  const saveNotes = useCallback(async (newNotes: Note[]) => {
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(newNotes));
      // Update cache
      await cacheNotes(newNotes);
      setIsOfflineMode(false);
      console.log('[NotesContext] Notes saved');
    } catch (error) {
      console.error('[NotesContext] Error saving notes:', error);
      setIsOfflineMode(true);
    }
  }, []);

  const addNote = useCallback((note: Note) => {
    setNotes(prev => {
      const updated = [note, ...prev];
      saveNotes(updated);
      // Cache audio file for offline access
      cacheAudioFile(note.id, note.audioUri).catch(error => {
        console.error('[NotesContext] Error caching audio:', error);
      });
      return updated;
    });
  }, [saveNotes]);

  const deleteNote = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.filter(note => note.id !== id);
      saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prev => {
      const updated = prev.map(note =>
        note.id === id ? { ...note, ...updates } : note
      );
      saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  const updateTitle = useCallback((id: string, title: string) => {
    setNotes(prev => {
      const updated = prev.map(note =>
        note.id === id ? { ...note, title, updatedAt: Date.now() } : note
      );
      saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  const updateTranscription = useCallback((id: string, transcription: string) => {
    setNotes(prev => {
      const updated = prev.map(note =>
        note.id === id ? { ...note, transcription, updatedAt: Date.now() } : note
      );
      saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  const updateFavorite = useCallback((id: string, isFavorite: boolean) => {
    setNotes(prev => {
      const updated = prev.map(note =>
        note.id === id ? { ...note, isFavorite, updatedAt: Date.now() } : note
      );
      saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  return (
    <NotesContext.Provider value={{ notes, addNote, deleteNote, updateNote, updateTitle, updateTranscription, updateFavorite, isLoading, isOfflineMode }}>
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
