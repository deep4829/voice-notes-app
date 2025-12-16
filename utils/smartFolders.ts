import { Note } from '@/types/note';

export interface SmartFolder {
  id: string;
  name: string;
  primaryTag: string;
  noteIds: string[];
  notesCount: number;
  color: string;
  createdAt: number;
  lastModified: number;
  description: string;
  subFolders?: SmartFolder[];
}

export interface FolderStructure {
  folders: SmartFolder[];
  ungrouped: string[]; // Note IDs not in any folder
  folderMap: Record<string, SmartFolder>;
}

// Tag-to-color mapping for visual distinction
const TAG_COLORS: Record<string, string> = {
  'meeting': '#3B82F6',      // Blue
  'finance': '#10B981',      // Green
  'marketing': '#F59E0B',    // Amber
  'project': '#8B5CF6',      // Purple
  'client': '#EC4899',       // Pink
  'research': '#06B6D4',     // Cyan
  'sales': '#EF4444',        // Red
  'hr': '#14B8A6',           // Teal
  'technology': '#6366F1',   // Indigo
  'important': '#DC2626',    // Dark Red
};

/**
 * Get color for a tag
 */
export const getColorForTag = (tag: string): string => {
  const lowerTag = tag.toLowerCase();
  return TAG_COLORS[lowerTag] || '#64748B'; // Default gray
};

/**
 * Get all unique primary tags from notes
 */
const getPrimaryTags = (notes: Note[]): string[] => {
  const tags = new Set<string>();
  
  for (const note of notes) {
    if (note.tags && note.tags.length > 0) {
      // First tag is considered primary
      const primaryTag = note.tags[0].toLowerCase();
      
      // Check if it's a known category tag
      if (Object.keys(TAG_COLORS).includes(primaryTag)) {
        tags.add(note.tags[0]);
      }
    }
  }
  
  return Array.from(tags).sort();
};

/**
 * Group notes by primary tag
 */
const groupByPrimaryTag = (
  notes: Note[],
  primaryTag: string
): Note[] => {
  return notes.filter(note => {
    if (!note.tags || note.tags.length === 0) return false;
    return note.tags[0].toLowerCase() === primaryTag.toLowerCase();
  });
};

/**
 * Extract secondary grouping key (sub-folder identifier)
 * e.g., client name, date pattern, person name
 */
const extractSecondaryKey = (note: Note): string | null => {
  if (!note.tags || note.tags.length < 2) return null;
  
  // Look for common secondary identifiers
  for (const tag of note.tags) {
    const lowerTag = tag.toLowerCase();
    
    // Skip primary tags
    if (Object.keys(TAG_COLORS).includes(lowerTag)) {
      continue;
    }
    
    // If it's a proper noun (capitalized) or date pattern, use it as secondary key
    if (tag[0] === tag[0].toUpperCase() || /^\d+\/\d+/.test(tag)) {
      return tag;
    }
  }
  
  return null;
};

/**
 * Create smart folders from notes
 */
export const createSmartFolders = (notes: Note[]): FolderStructure => {
  const folders: SmartFolder[] = [];
  const folderMap: Record<string, SmartFolder> = {};
  const processedNoteIds = new Set<string>();
  
  if (notes.length === 0) {
    return {
      folders: [],
      ungrouped: [],
      folderMap: {},
    };
  }
  
  // Get primary tags and create folders
  const primaryTags = getPrimaryTags(notes);
  
  for (const primaryTag of primaryTags) {
    const notesInTag = groupByPrimaryTag(notes, primaryTag);
    
    if (notesInTag.length === 0) continue;
    
    // Check if we should create sub-folders based on secondary keys
    const secondaryGroups = new Map<string | null, Note[]>();
    
    for (const note of notesInTag) {
      const secondaryKey = extractSecondaryKey(note);
      if (!secondaryGroups.has(secondaryKey)) {
        secondaryGroups.set(secondaryKey, []);
      }
      secondaryGroups.get(secondaryKey)!.push(note);
    }
    
    // Create main folder
    const folderId = primaryTag.toLowerCase().replace(/\s+/g, '_');
    const mainFolder: SmartFolder = {
      id: folderId,
      name: primaryTag,
      primaryTag: primaryTag,
      noteIds: notesInTag.map(n => n.id),
      notesCount: notesInTag.length,
      color: getColorForTag(primaryTag),
      createdAt: Date.now(),
      lastModified: Math.max(...notesInTag.map(n => n.createdAt)),
      description: `${notesInTag.length} note${notesInTag.length !== 1 ? 's' : ''} tagged "${primaryTag}"`,
      subFolders: [],
    };
    
    // Create sub-folders if there are secondary groupings and at least 3 notes
    if (secondaryGroups.size > 1 && notesInTag.length >= 3) {
      const subFolders: SmartFolder[] = [];
      
      for (const [secondaryKey, subNotes] of secondaryGroups) {
        if (secondaryKey === null) continue; // Skip ungrouped notes in subfolder creation
        if (subNotes.length < 2) continue; // Only create subfolder if 2+ notes
        
        const subFolderId = `${folderId}_${secondaryKey.toLowerCase().replace(/\s+/g, '_')}`;
        const subFolder: SmartFolder = {
          id: subFolderId,
          name: secondaryKey,
          primaryTag: primaryTag,
          noteIds: subNotes.map(n => n.id),
          notesCount: subNotes.length,
          color: getColorForTag(primaryTag),
          createdAt: Date.now(),
          lastModified: Math.max(...subNotes.map(n => n.createdAt)),
          description: `${subNotes.length} note${subNotes.length !== 1 ? 's' : ''} with "${secondaryKey}"`,
        };
        
        subFolders.push(subFolder);
        folderMap[subFolderId] = subFolder;
      }
      
      mainFolder.subFolders = subFolders;
    }
    
    folders.push(mainFolder);
    folderMap[folderId] = mainFolder;
    
    // Track processed notes
    notesInTag.forEach(n => processedNoteIds.add(n.id));
  }
  
  // Find ungrouped notes
  const ungrouped = notes
    .filter(n => !processedNoteIds.has(n.id))
    .map(n => n.id);
  
  return {
    folders: folders.sort((a, b) => b.notesCount - a.notesCount),
    ungrouped,
    folderMap,
  };
};

/**
 * Get notes for a specific folder
 */
export const getNotesInFolder = (
  notes: Note[],
  folder: SmartFolder
): Note[] => {
  return notes.filter(n => folder.noteIds.includes(n.id));
};

/**
 * Get folder statistics
 */
export const getFolderStats = (
  notes: Note[],
  folder: SmartFolder
): {
  totalNotes: number;
  totalDuration: number;
  dateRange: { oldest: number; newest: number } | null;
  averageDuration: number;
} => {
  const folderNotes = getNotesInFolder(notes, folder);
  
  if (folderNotes.length === 0) {
    return {
      totalNotes: 0,
      totalDuration: 0,
      dateRange: null,
      averageDuration: 0,
    };
  }
  
  const totalDuration = folderNotes.reduce((sum, n) => sum + (n.duration || 0), 0);
  const durations = folderNotes.map(n => n.createdAt);
  const dateRange =
    durations.length > 0
      ? { oldest: Math.min(...durations), newest: Math.max(...durations) }
      : null;
  
  return {
    totalNotes: folderNotes.length,
    totalDuration,
    dateRange,
    averageDuration: totalDuration / folderNotes.length,
  };
};

/**
 * Find which folder(s) a note belongs to
 */
export const findFoldersForNote = (
  foldersStructure: FolderStructure,
  noteId: string
): SmartFolder[] => {
  const result: SmartFolder[] = [];
  
  for (const folder of foldersStructure.folders) {
    if (folder.noteIds.includes(noteId)) {
      result.push(folder);
    }
    
    if (folder.subFolders) {
      for (const subFolder of folder.subFolders) {
        if (subFolder.noteIds.includes(noteId)) {
          result.push(subFolder);
        }
      }
    }
  }
  
  return result;
};

/**
 * Get breadcrumb path for a note in folder hierarchy
 */
export const getFolderBreadcrumb = (
  foldersStructure: FolderStructure,
  noteId: string
): { primary: SmartFolder; secondary?: SmartFolder } | null => {
  for (const folder of foldersStructure.folders) {
    if (folder.noteIds.includes(noteId)) {
      return { primary: folder };
    }
    
    if (folder.subFolders) {
      for (const subFolder of folder.subFolders) {
        if (subFolder.noteIds.includes(noteId)) {
          return { primary: folder, secondary: subFolder };
        }
      }
    }
  }
  
  return null;
};

/**
 * Search notes within a folder
 */
export const searchInFolder = (
  notes: Note[],
  folder: SmartFolder,
  searchQuery: string
): Note[] => {
  const folderNotes = getNotesInFolder(notes, folder);
  const lowerQuery = searchQuery.toLowerCase();
  
  return folderNotes.filter(note =>
    (note.title?.toLowerCase().includes(lowerQuery) || false) ||
    note.transcription.toLowerCase().includes(lowerQuery) ||
    (note.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) || false)
  );
};

/**
 * Get folder diagnostics
 */
export const getFolderDiagnostics = (
  notes: Note[],
  structure: FolderStructure
): Record<string, any> => {
  const folderStats = structure.folders.map(folder => {
    const stats = getFolderStats(notes, folder);
    return {
      name: folder.name,
      noteCount: folder.notesCount,
      ...stats,
    };
  });
  
  return {
    totalFolders: structure.folders.length,
    totalUngrouped: structure.ungrouped.length,
    folderStats,
    timestamp: Date.now(),
  };
};
