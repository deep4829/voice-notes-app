import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Note } from '@/types/note';

const CACHE_KEY = 'notes_cache';
const CACHE_METADATA_KEY = 'cache_metadata';
const CACHE_AUDIO_DIR = `${FileSystem.documentDirectory}audio_cache/`;

export interface CacheMetadata {
  lastSyncAt: number;
  cachedNotesCount: number;
  totalCacheSize: number;
  version: string;
}

/**
 * Initialize cache directories
 */
export const initializeCache = async (): Promise<void> => {
  try {
    // Create audio cache directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(CACHE_AUDIO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_AUDIO_DIR, { intermediates: true });
      console.log('[Cache] Audio cache directory created');
    }
  } catch (error) {
    console.error('[Cache] Error initializing cache:', error);
  }
};

/**
 * Cache notes to local storage
 */
export const cacheNotes = async (notes: Note[]): Promise<void> => {
  try {
    // Store notes in AsyncStorage
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(notes));

    // Update cache metadata
    const metadata: CacheMetadata = {
      lastSyncAt: Date.now(),
      cachedNotesCount: notes.length,
      totalCacheSize: JSON.stringify(notes).length,
      version: '1.0',
    };
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));

    console.log(`[Cache] Cached ${notes.length} notes`);
  } catch (error) {
    console.error('[Cache] Error caching notes:', error);
  }
};

/**
 * Retrieve cached notes
 */
export const getCachedNotes = async (): Promise<Note[]> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) {
      return [];
    }
    console.log('[Cache] Retrieved notes from cache');
    return JSON.parse(cached);
  } catch (error) {
    console.error('[Cache] Error retrieving cached notes:', error);
    return [];
  }
};

/**
 * Cache a single note's audio file to local filesystem
 * This allows offline access to the raw audio
 */
export const cacheAudioFile = async (
  noteId: string,
  audioUri: string
): Promise<string | null> => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      console.warn('[Cache] Audio file not found:', audioUri);
      return null;
    }

    // Copy file to cache directory
    const cachedPath = `${CACHE_AUDIO_DIR}${noteId}.m4a`;

    // Check if already cached
    const cachedInfo = await FileSystem.getInfoAsync(cachedPath);
    if (cachedInfo.exists) {
      console.log('[Cache] Audio already cached:', noteId);
      return cachedPath;
    }

    // Copy the file
    await FileSystem.copyAsync({
      from: audioUri,
      to: cachedPath,
    });

    console.log('[Cache] Audio cached:', noteId);
    return cachedPath;
  } catch (error) {
    console.error('[Cache] Error caching audio:', error);
    return null;
  }
};

/**
 * Get cached audio file path
 */
export const getCachedAudioPath = async (noteId: string): Promise<string | null> => {
  try {
    const cachedPath = `${CACHE_AUDIO_DIR}${noteId}.m4a`;
    const fileInfo = await FileSystem.getInfoAsync(cachedPath);

    if (fileInfo.exists) {
      console.log('[Cache] Found cached audio:', noteId);
      return cachedPath;
    }

    return null;
  } catch (error) {
    console.error('[Cache] Error getting cached audio:', error);
    return null;
  }
};

/**
 * Update note in cache (for read-only mode operations)
 * Cannot create new notes in offline mode, only update existing ones
 */
export const updateNoteInCache = async (noteId: string, updates: Partial<Note>): Promise<Note | null> => {
  try {
    const notes = await getCachedNotes();
    const noteIndex = notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      console.warn('[Cache] Note not found in cache:', noteId);
      return null;
    }

    // Update the note (read-only fields like title, favorite status)
    notes[noteIndex] = {
      ...notes[noteIndex],
      ...updates,
      id: noteId, // Prevent ID changes
      createdAt: notes[noteIndex].createdAt, // Prevent date changes
      audioUri: notes[noteIndex].audioUri, // Prevent audio URI changes
    };

    await cacheNotes(notes);
    console.log('[Cache] Note updated in cache:', noteId);
    return notes[noteIndex];
  } catch (error) {
    console.error('[Cache] Error updating note in cache:', error);
    return null;
  }
};

/**
 * Get cache metadata
 */
export const getCacheMetadata = async (): Promise<CacheMetadata | null> => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('[Cache] Error getting metadata:', error);
    return null;
  }
};

/**
 * Calculate cache size
 */
export const calculateCacheSize = async (): Promise<number> => {
  try {
    let totalSize = 0;

    // Get notes cache size
    const notesCached = await AsyncStorage.getItem(CACHE_KEY);
    if (notesCached) {
      totalSize += notesCached.length;
    }

    // Get audio files cache size
    const audioFiles = await FileSystem.readDirectoryAsync(CACHE_AUDIO_DIR);
    for (const file of audioFiles) {
      const filePath = `${CACHE_AUDIO_DIR}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists && fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('[Cache] Error calculating cache size:', error);
    return 0;
  }
};

/**
 * Clear audio cache (keep notes cache intact)
 * Useful for freeing up space
 */
export const clearAudioCache = async (): Promise<void> => {
  try {
    const audioFiles = await FileSystem.readDirectoryAsync(CACHE_AUDIO_DIR);

    for (const file of audioFiles) {
      const filePath = `${CACHE_AUDIO_DIR}${file}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }

    console.log('[Cache] Audio cache cleared');
  } catch (error) {
    console.error('[Cache] Error clearing audio cache:', error);
  }
};

/**
 * Clear all cache
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    await clearAudioCache();
    console.log('[Cache] All cache cleared');
  } catch (error) {
    console.error('[Cache] Error clearing all cache:', error);
  }
};

/**
 * Get cache diagnostics
 */
export const getCacheDiagnostics = async (): Promise<Record<string, any>> => {
  try {
    const metadata = await getCacheMetadata();
    const cacheSize = await calculateCacheSize();
    const notes = await getCachedNotes();

    return {
      metadata,
      cacheSize: `${(cacheSize / 1024 / 1024).toFixed(2)} MB`,
      notesInCache: notes.length,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Cache] Error getting diagnostics:', error);
    return { error: String(error) };
  }
};

/**
 * Sync cache when connectivity is restored
 * In a real app, this would compare cache with server and update
 */
export const syncCacheOnConnectivity = async (
  serverNotes: Note[]
): Promise<{ added: number; updated: number; deleted: number }> => {
  try {
    const cachedNotes = await getCachedNotes();
    let added = 0;
    let updated = 0;
    let deleted = 0;

    // Find new notes from server
    for (const serverNote of serverNotes) {
      const cached = cachedNotes.find(n => n.id === serverNote.id);
      if (!cached) {
        // New note from server
        added++;
      } else if (serverNote.createdAt > cached.createdAt) {
        // Note was updated on server
        updated++;
      }
    }

    // Find deleted notes
    for (const cachedNote of cachedNotes) {
      if (!serverNotes.find(n => n.id === cachedNote.id)) {
        deleted++;
      }
    }

    // Update cache with server notes
    await cacheNotes(serverNotes);

    console.log('[Cache] Sync complete:', { added, updated, deleted });
    return { added, updated, deleted };
  } catch (error) {
    console.error('[Cache] Error syncing cache:', error);
    return { added: 0, updated: 0, deleted: 0 };
  }
};
