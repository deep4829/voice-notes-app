import { Note } from '@/types/note';

/**
 * Semantic Search Engine
 * Uses keyword expansion and semantic relationships to find conceptually related content
 * without requiring heavy NLP models or embeddings
 */

// Semantic relationship mapping: key concept -> related terms
const SEMANTIC_RELATIONSHIPS: Record<string, string[]> = {
  // Financial concepts
  'budget': ['finance', 'money', 'cost', 'expense', 'spending', 'financial', 'invest', 'capital', 'funds'],
  'finance': ['budget', 'money', 'cost', 'expense', 'spending', 'invest', 'capital', 'profit', 'revenue'],
  'expense': ['budget', 'cost', 'spending', 'money', 'finance', 'bill', 'payment', 'invoice'],
  'revenue': ['finance', 'money', 'income', 'profit', 'sales', 'business', 'earnings'],
  'profit': ['revenue', 'finance', 'business', 'income', 'success', 'earnings'],
  'cost': ['expense', 'budget', 'money', 'spending', 'finance', 'price', 'payment'],
  'money': ['budget', 'finance', 'expense', 'cost', 'spending', 'payment', 'income', 'wealth'],
  'salary': ['payment', 'income', 'money', 'compensation', 'wage', 'earnings'],
  'invoice': ['payment', 'bill', 'expense', 'money', 'cost'],
  
  // Meeting/Discussion concepts
  'meeting': ['discussion', 'conversation', 'talk', 'conference', 'presentation', 'call', 'gathering', 'sync'],
  'discussion': ['meeting', 'conversation', 'talk', 'debate', 'topic', 'dialogue'],
  'presentation': ['meeting', 'demo', 'talk', 'pitch', 'showcase', 'show'],
  'call': ['meeting', 'conversation', 'discussion', 'sync', 'conference', 'communication'],
  'sync': ['meeting', 'call', 'check-in', 'update', 'discussion', 'sync-up'],
  
  // Project/Work concepts
  'project': ['task', 'work', 'delivery', 'deadline', 'milestone', 'objective', 'goal'],
  'task': ['project', 'work', 'assignment', 'responsibility', 'to-do', 'item'],
  'deadline': ['project', 'timeline', 'date', 'schedule', 'due', 'time'],
  'milestone': ['project', 'achievement', 'goal', 'target', 'checkpoint'],
  'goal': ['objective', 'target', 'aim', 'purpose', 'milestone', 'outcome'],
  
  // Client/Customer concepts
  'client': ['customer', 'customer-name', 'account', 'business', 'contract', 'relationship'],
  'customer': ['client', 'user', 'account', 'buyer', 'business'],
  
  // Technology concepts
  'technology': ['tech', 'software', 'development', 'code', 'technical', 'system', 'infrastructure'],
  'development': ['technology', 'coding', 'engineering', 'software', 'building', 'creation'],
  'bug': ['issue', 'problem', 'error', 'fix', 'development', 'technical'],
  'feature': ['development', 'functionality', 'capability', 'enhancement', 'build'],
  
  // Marketing/Sales concepts
  'marketing': ['campaign', 'promotion', 'advertising', 'brand', 'strategy', 'outreach', 'engagement'],
  'campaign': ['marketing', 'promotion', 'strategy', 'initiative', 'launch', 'effort'],
  'sales': ['revenue', 'business', 'customer', 'closing', 'deal', 'opportunity', 'pipeline'],
  'deal': ['sales', 'business', 'closing', 'opportunity', 'contract', 'agreement'],
  
  // Action/Status concepts
  'important': ['critical', 'urgent', 'priority', 'key', 'essential', 'significant'],
  'urgent': ['important', 'critical', 'priority', 'rush', 'emergency', 'immediate'],
  'follow-up': ['action', 'task', 'to-do', 'reminder', 'next-step'],
  'decision': ['choice', 'outcome', 'result', 'conclusion', 'direction'],
  
  // Time concepts
  'today': ['date', 'current', 'now', 'immediate', 'schedule'],
  'tomorrow': ['date', 'schedule', 'upcoming', 'future'],
  'week': ['time', 'schedule', 'duration', 'period'],
  'month': ['time', 'quarter', 'period', 'duration', 'schedule'],
  
  // Status concepts
  'complete': ['done', 'finished', 'closed', 'resolved', 'success'],
  'done': ['complete', 'finished', 'success', 'achieved'],
  'pending': ['waiting', 'todo', 'upcoming', 'scheduled', 'in-progress'],
  'in-progress': ['active', 'ongoing', 'working', 'status', 'pending'],
};

export interface SemanticSearchResult {
  note: Note;
  relevanceScore: number;
  matchType: 'exact' | 'keyword' | 'semantic';
  matchedTerms: string[];
  explanation: string;
}

/**
 * Normalize and tokenize search query
 */
const tokenizeQuery = (query: string): string[] => {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .split(/\s+/)
    .filter(token => token.length > 2); // Filter out short words
};

/**
 * Get semantic expansions for a token
 */
const getSemanticExpansions = (token: string): string[] => {
  const expansions = new Set<string>();
  
  // Add the original token
  expansions.add(token);
  
  // Add direct semantic relationships
  const relatedTerms = SEMANTIC_RELATIONSHIPS[token];
  if (relatedTerms) {
    relatedTerms.forEach(term => expansions.add(term));
  }
  
  // Add reverse relationships (if any term maps back to this token)
  for (const [key, values] of Object.entries(SEMANTIC_RELATIONSHIPS)) {
    if (values.includes(token)) {
      expansions.add(key);
    }
  }
  
  return Array.from(expansions);
};

/**
 * Calculate semantic similarity between two strings (0-1 score)
 */
const calculateSimilarity = (text: string, token: string): number => {
  const textLower = text.toLowerCase();
  const tokenExpansions = getSemanticExpansions(token);
  
  let maxScore = 0;
  
  for (const expandedToken of tokenExpansions) {
    // Exact word match
    if (textLower.includes(` ${expandedToken} `) || 
        textLower.startsWith(`${expandedToken} `) ||
        textLower.endsWith(` ${expandedToken}`) ||
        textLower === expandedToken) {
      maxScore = Math.max(maxScore, 1.0);
    }
    // Substring match
    else if (textLower.includes(expandedToken)) {
      maxScore = Math.max(maxScore, 0.7);
    }
    // Partial match
    else if (expandedToken.includes(token) || token.includes(expandedToken)) {
      maxScore = Math.max(maxScore, 0.4);
    }
  }
  
  return maxScore;
};

/**
 * Perform semantic search on notes
 */
export const semanticSearch = (
  notes: Note[],
  query: string,
  threshold: number = 0.3
): SemanticSearchResult[] => {
  if (!query.trim()) {
    return [];
  }
  
  const tokens = tokenizeQuery(query);
  const results: SemanticSearchResult[] = [];
  
  for (const note of notes) {
    let totalScore = 0;
    const matchedTerms = new Set<string>();
    let matchType: 'exact' | 'keyword' | 'semantic' = 'semantic';
    
    // Check title
    if (note.title) {
      const titleLower = note.title.toLowerCase();
      for (const token of tokens) {
        const score = calculateSimilarity(note.title, token);
        if (score > 0) {
          totalScore += score;
          matchedTerms.add(token);
          if (score === 1.0) matchType = 'exact';
          else if (score >= 0.7) matchType = 'keyword';
        }
      }
    }
    
    // Check transcription
    for (const token of tokens) {
      const score = calculateSimilarity(note.transcription, token);
      if (score > 0) {
        totalScore += score * 0.8; // Weight transcription slightly less than title
        matchedTerms.add(token);
        if (score === 1.0 && matchType !== 'exact') matchType = 'exact';
        else if (score >= 0.7 && matchType === 'semantic') matchType = 'keyword';
      }
    }
    
    // Check tags
    if (note.tags) {
      for (const tag of note.tags) {
        for (const token of tokens) {
          const score = calculateSimilarity(tag, token);
          if (score > 0) {
            totalScore += score * 1.2; // Weight tags higher
            matchedTerms.add(token);
            if (score === 1.0) matchType = 'exact';
          }
        }
      }
    }
    
    // Normalize score
    const relevanceScore = tokens.length > 0 ? totalScore / tokens.length : 0;
    
    if (relevanceScore >= threshold) {
      const explanation = generateExplanation(Array.from(matchedTerms), query);
      results.push({
        note,
        relevanceScore,
        matchType,
        matchedTerms: Array.from(matchedTerms),
        explanation,
      });
    }
  }
  
  // Sort by relevance score (highest first)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

/**
 * Generate human-readable explanation for why a note matched
 */
const generateExplanation = (matchedTerms: string[], query: string): string => {
  if (matchedTerms.length === 0) {
    return 'Semantic match';
  }
  
  const displayTerms = matchedTerms.slice(0, 2).join(', ');
  return `Matched: ${displayTerms}`;
};

/**
 * Suggest alternative search terms based on semantic relationships
 */
export const getSuggestedSearchTerms = (query: string): string[] => {
  const tokens = tokenizeQuery(query);
  const suggestions = new Set<string>();
  
  for (const token of tokens) {
    const expansions = getSemanticExpansions(token);
    // Add up to 3 related terms per token
    expansions.slice(1, 4).forEach(term => suggestions.add(term));
  }
  
  return Array.from(suggestions).slice(0, 5);
};

/**
 * Advanced semantic search with filters
 */
export const advancedSemanticSearch = (
  notes: Note[],
  query: string,
  options?: {
    tags?: string[];
    dateRange?: { from: number; to: number };
    favoriteOnly?: boolean;
    threshold?: number;
  }
): SemanticSearchResult[] => {
  let filtered = notes;
  
  // Apply filters
  if (options?.tags && options.tags.length > 0) {
    filtered = filtered.filter(note =>
      note.tags?.some(tag => options.tags!.includes(tag.toLowerCase()))
    );
  }
  
  if (options?.dateRange) {
    filtered = filtered.filter(note =>
      note.createdAt >= options.dateRange!.from &&
      note.createdAt <= options.dateRange!.to
    );
  }
  
  if (options?.favoriteOnly) {
    filtered = filtered.filter(note => (note as any).isFavorite === true);
  }
  
  // Perform semantic search
  return semanticSearch(filtered, query, options?.threshold || 0.3);
};

/**
 * Get semantic search diagnostics
 */
export const getSemanticSearchDiagnostics = (): Record<string, any> => {
  return {
    semanticRelationshipsCount: Object.keys(SEMANTIC_RELATIONSHIPS).length,
    totalMappings: Object.values(SEMANTIC_RELATIONSHIPS).reduce((sum, arr) => sum + arr.length, 0),
    categories: {
      financial: Object.keys(SEMANTIC_RELATIONSHIPS).filter(k => 
        ['budget', 'finance', 'expense', 'revenue', 'profit', 'cost', 'money'].includes(k)
      ).length,
      meetings: Object.keys(SEMANTIC_RELATIONSHIPS).filter(k =>
        ['meeting', 'discussion', 'presentation', 'call', 'sync'].includes(k)
      ).length,
      projects: Object.keys(SEMANTIC_RELATIONSHIPS).filter(k =>
        ['project', 'task', 'deadline', 'milestone', 'goal'].includes(k)
      ).length,
      technology: Object.keys(SEMANTIC_RELATIONSHIPS).filter(k =>
        ['technology', 'development', 'bug', 'feature'].includes(k)
      ).length,
    },
    timestamp: Date.now(),
  };
};

/**
 * Build a semantic search index for faster lookups
 */
export interface SemanticIndex {
  tokenToNotes: Map<string, Set<string>>;
  noteIds: Set<string>;
}

export const buildSemanticIndex = (notes: Note[]): SemanticIndex => {
  const tokenToNotes = new Map<string, Set<string>>();
  const noteIds = new Set<string>();
  
  for (const note of notes) {
    noteIds.add(note.id);
    
    // Index title tokens
    if (note.title) {
      const titleTokens = tokenizeQuery(note.title);
      for (const token of titleTokens) {
        const expansions = getSemanticExpansions(token);
        for (const expansion of expansions) {
          if (!tokenToNotes.has(expansion)) {
            tokenToNotes.set(expansion, new Set());
          }
          tokenToNotes.get(expansion)!.add(note.id);
        }
      }
    }
    
    // Index transcription tokens (sampled for performance)
    const transcriptionTokens = tokenizeQuery(note.transcription);
    const sampledTokens = transcriptionTokens.slice(0, 50); // Limit to first 50 tokens
    for (const token of sampledTokens) {
      const expansions = getSemanticExpansions(token);
      for (const expansion of expansions) {
        if (!tokenToNotes.has(expansion)) {
          tokenToNotes.set(expansion, new Set());
        }
        tokenToNotes.get(expansion)!.add(note.id);
      }
    }
    
    // Index tags
    if (note.tags) {
      for (const tag of note.tags) {
        const tagTokens = tokenizeQuery(tag);
        for (const token of tagTokens) {
          const expansions = getSemanticExpansions(token);
          for (const expansion of expansions) {
            if (!tokenToNotes.has(expansion)) {
              tokenToNotes.set(expansion, new Set());
            }
            tokenToNotes.get(expansion)!.add(note.id);
          }
        }
      }
    }
  }
  
  return { tokenToNotes, noteIds };
};

/**
 * Fast semantic search using index
 */
export const fastSemanticSearch = (
  notes: Note[],
  query: string,
  index: SemanticIndex
): SemanticSearchResult[] => {
  const tokens = tokenizeQuery(query);
  const matchedNoteIds = new Map<string, number>();
  
  // Find notes matching any semantic expansion
  for (const token of tokens) {
    const expansions = getSemanticExpansions(token);
    for (const expansion of expansions) {
      const noteIds = index.tokenToNotes.get(expansion);
      if (noteIds) {
        for (const noteId of noteIds) {
          matchedNoteIds.set(noteId, (matchedNoteIds.get(noteId) || 0) + 1);
        }
      }
    }
  }
  
  // Convert matched notes and rank by frequency + relevance
  const matchedNotes = Array.from(matchedNoteIds.entries())
    .map(([noteId, frequency]) => {
      const note = notes.find(n => n.id === noteId);
      if (!note) return null;
      const relevanceScore = frequency / tokens.length;
      return {
        note,
        relevanceScore,
        matchType: 'semantic' as const,
        matchedTerms: [],
        explanation: `Semantic match (frequency: ${frequency})`,
      };
    })
    .filter((result): result is SemanticSearchResult => result !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return matchedNotes;
};
