/**
 * Filler Word Detection and Removal/Highlighting
 * Identifies common filler words like "um", "uh", "like", "you know", etc.
 */

export interface FillerWord {
  word: string;
  startIndex: number;
  endIndex: number;
  category: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase';
}

export interface FillerWordAnalysis {
  originalText: string;
  cleanedText: string; // Text with filler words removed
  highlightedText: Array<{
    text: string;
    isFillerWord: boolean;
    category?: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase';
  }>;
  fillerWords: FillerWord[];
  totalFillerWords: number;
  fillerWordPercentage: number;
  mostCommonFiller: string | null;
  fillerWordFrequency: { [word: string]: number };
  averageFillerWordsPerSentence: number;
}

// Common filler words grouped by category
const FILLER_WORDS = {
  // Verbal hesitations
  verbal: ['um', 'uh', 'err', 'erm', 'hmm', 'huh', 'ah', 'oh', 'aah', 'ooh', 'eeh', 'agh'],

  // Discourse markers
  discourse: [
    'like',
    'you know',
    'i mean',
    'basically',
    'literally',
    'actually',
    'honestly',
    'i think',
    'i feel',
    'sort of',
    'kind of',
    'so',
    'well',
    'right',
    'okay',
  ],

  // Verbal tics
  verbal_tics: [
    'anyway',
    'anyhow',
    'at the end of the day',
    'for sure',
    'you know what',
    'for whatever reason',
    'in terms of',
  ],

  // Common phrases
  phrase: [
    'you know',
    'i mean',
    'sort of',
    'kind of',
    'i think',
    'i feel',
    'at the end of the day',
    'you know what',
    'you know what i mean',
    'for sure',
    'for whatever reason',
  ],
};

// Flatten all filler words for easy lookup
const FILLER_WORDS_SET = new Set<string>();
const FILLER_WORDS_CATEGORY: { [word: string]: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase' } = {};

Object.entries(FILLER_WORDS).forEach(([category, words]) => {
  const cat =
    (category as any) === 'verbal'
      ? 'verbal'
      : (category as any) === 'discourse'
        ? 'discourse'
        : (category as any) === 'verbal_tics'
          ? 'verbal-tics'
          : 'phrase';

  words.forEach((word) => {
    FILLER_WORDS_SET.add(word.toLowerCase());
    FILLER_WORDS_CATEGORY[word.toLowerCase()] = cat;
  });
});

/**
 * Tokenize text into words while preserving word boundaries and punctuation
 */
function tokenizeWithPositions(text: string): Array<{ word: string; start: number; end: number }> {
  const tokens: Array<{ word: string; start: number; end: number }> = [];
  let currentWord = '';
  let wordStart = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isLetter = /[a-zA-Z'-]/.test(char);

    if (isLetter) {
      if (currentWord === '') {
        wordStart = i;
      }
      currentWord += char;
    } else {
      if (currentWord !== '') {
        tokens.push({
          word: currentWord,
          start: wordStart,
          end: i,
        });
        currentWord = '';
      }
    }
  }

  // Don't forget the last word
  if (currentWord !== '') {
    tokens.push({
      word: currentWord,
      start: wordStart,
      end: text.length,
    });
  }

  return tokens;
}

/**
 * Check if a word or phrase is a filler word
 */
function isFillerWord(word: string): boolean {
  const lowerWord = word.toLowerCase().trim();
  return FILLER_WORDS_SET.has(lowerWord);
}

/**
 * Check for multi-word filler phrases
 */
function extractFillerPhrases(text: string): FillerWord[] {
  const fillerWords: FillerWord[] = [];
  const lowerText = text.toLowerCase();

  // Check for multi-word phrases
  const phrasePatterns = [
    'you know what i mean',
    'you know what',
    'i think that',
    'i feel like',
    'i mean like',
    'sort of like',
    'kind of like',
    'at the end of the day',
    'for whatever reason',
  ];

  phrasePatterns.forEach((phrase) => {
    let index = 0;
    while ((index = lowerText.indexOf(phrase, index)) !== -1) {
      fillerWords.push({
        word: text.substring(index, index + phrase.length),
        startIndex: index,
        endIndex: index + phrase.length,
        category: 'phrase',
      });
      index += phrase.length;
    }
  });

  return fillerWords;
}

/**
 * Extract single-word filler words
 */
function extractSingleWordFillers(text: string): FillerWord[] {
  const fillerWords: FillerWord[] = [];
  const tokens = tokenizeWithPositions(text);

  tokens.forEach((token) => {
    if (isFillerWord(token.word)) {
      const category = FILLER_WORDS_CATEGORY[token.word.toLowerCase()] || 'discourse';
      fillerWords.push({
        word: token.word,
        startIndex: token.start,
        endIndex: token.end,
        category,
      });
    }
  });

  return fillerWords;
}

/**
 * Main analysis function to identify and extract filler words
 */
export function analyzeFillerWords(text: string): FillerWordAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      originalText: text,
      cleanedText: text,
      highlightedText: [],
      fillerWords: [],
      totalFillerWords: 0,
      fillerWordPercentage: 0,
      mostCommonFiller: null,
      fillerWordFrequency: {},
      averageFillerWordsPerSentence: 0,
    };
  }

  // Extract both multi-word phrases and single words
  const phraseFillers = extractFillerPhrases(text);
  const singleFillers = extractSingleWordFillers(text);

  // Combine and sort by position
  const allFillers = [...phraseFillers, ...singleFillers].sort((a, b) => a.startIndex - b.startIndex);

  // Remove overlaps (prefer longer phrases over single words)
  const mergedFillers: FillerWord[] = [];
  for (let i = 0; i < allFillers.length; i++) {
    let isOverlap = false;
    for (let j = 0; j < mergedFillers.length; j++) {
      const existing = mergedFillers[j];
      // Check if current filler overlaps with existing
      if (allFillers[i].startIndex >= existing.startIndex && allFillers[i].startIndex < existing.endIndex) {
        isOverlap = true;
        break;
      }
    }
    if (!isOverlap) {
      mergedFillers.push(allFillers[i]);
    }
  }

  // Create cleaned text (remove filler words)
  let cleanedText = text;
  // Process in reverse order to maintain indices
  for (let i = mergedFillers.length - 1; i >= 0; i--) {
    const filler = mergedFillers[i];
    // Replace with space to maintain word boundaries
    cleanedText =
      cleanedText.substring(0, filler.startIndex) +
      ' ' +
      cleanedText.substring(filler.endIndex);
  }

  // Clean up multiple spaces
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  // Create highlighted text segments
  const highlightedText: Array<{ text: string; isFillerWord: boolean; category?: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase' }> = [];
  let lastEnd = 0;

  mergedFillers.forEach((filler) => {
    if (lastEnd < filler.startIndex) {
      highlightedText.push({
        text: text.substring(lastEnd, filler.startIndex),
        isFillerWord: false,
      });
    }
    highlightedText.push({
      text: text.substring(filler.startIndex, filler.endIndex),
      isFillerWord: true,
      category: filler.category,
    });
    lastEnd = filler.endIndex;
  });

  // Add remaining text
  if (lastEnd < text.length) {
    highlightedText.push({
      text: text.substring(lastEnd),
      isFillerWord: false,
    });
  }

  // Calculate frequency
  const fillerWordFrequency: { [word: string]: number } = {};
  mergedFillers.forEach((filler) => {
    const word = filler.word.toLowerCase().trim();
    fillerWordFrequency[word] = (fillerWordFrequency[word] || 0) + 1;
  });

  // Find most common filler
  let mostCommonFiller: string | null = null;
  let maxCount = 0;
  Object.entries(fillerWordFrequency).forEach(([word, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonFiller = word;
    }
  });

  // Count total words
  const totalWords = text.split(/\s+/).length;
  const fillerWordPercentage = totalWords > 0 ? (mergedFillers.length / totalWords) * 100 : 0;

  // Calculate average fillers per sentence
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const averageFillerWordsPerSentence = sentences.length > 0 ? mergedFillers.length / sentences.length : 0;

  return {
    originalText: text,
    cleanedText,
    highlightedText,
    fillerWords: mergedFillers,
    totalFillerWords: mergedFillers.length,
    fillerWordPercentage: Math.round(fillerWordPercentage * 100) / 100,
    mostCommonFiller,
    fillerWordFrequency,
    averageFillerWordsPerSentence: Math.round(averageFillerWordsPerSentence * 100) / 100,
  };
}

/**
 * Remove all filler words from text and return cleaned version
 */
export function removeFillerWords(text: string): string {
  const analysis = analyzeFillerWords(text);
  return analysis.cleanedText;
}

/**
 * Get filler word statistics across multiple transcriptions
 */
export function getFillerWordStatistics(transcriptions: string[]): {
  totalFillerWords: number;
  averageFillerPercentage: number;
  mostCommonFiller: string | null;
  fillerWordFrequency: { [word: string]: number };
  transcriptionsAnalyzed: number;
  averageFillerWordsPerTranscript: number;
} {
  if (transcriptions.length === 0) {
    return {
      totalFillerWords: 0,
      averageFillerPercentage: 0,
      mostCommonFiller: null,
      fillerWordFrequency: {},
      transcriptionsAnalyzed: 0,
      averageFillerWordsPerTranscript: 0,
    };
  }

  const analyses = transcriptions.map((t) => analyzeFillerWords(t));

  let totalFillerWords = 0;
  let totalPercentage = 0;
  const combinedFrequency: { [word: string]: number } = {};

  analyses.forEach((analysis) => {
    totalFillerWords += analysis.totalFillerWords;
    totalPercentage += analysis.fillerWordPercentage;
    Object.entries(analysis.fillerWordFrequency).forEach(([word, count]) => {
      combinedFrequency[word] = (combinedFrequency[word] || 0) + count;
    });
  });

  // Find most common filler
  let mostCommonFiller: string | null = null;
  let maxCount = 0;
  Object.entries(combinedFrequency).forEach(([word, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonFiller = word;
    }
  });

  return {
    totalFillerWords,
    averageFillerPercentage: Math.round((totalPercentage / transcriptions.length) * 100) / 100,
    mostCommonFiller,
    fillerWordFrequency: combinedFrequency,
    transcriptionsAnalyzed: transcriptions.length,
    averageFillerWordsPerTranscript: Math.round((totalFillerWords / transcriptions.length) * 100) / 100,
  };
}

/**
 * Get filler word category description
 */
export function getCategoryDescription(category: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase'): string {
  switch (category) {
    case 'verbal':
      return 'Verbal Hesitation';
    case 'discourse':
      return 'Discourse Marker';
    case 'verbal-tics':
      return 'Verbal Tic';
    case 'phrase':
      return 'Filler Phrase';
    default:
      return 'Filler Word';
  }
}

/**
 * Get category color for visualization
 */
export function getCategoryColor(
  category: 'discourse' | 'verbal' | 'verbal-tics' | 'phrase'
): { bg: string; text: string; border: string } {
  switch (category) {
    case 'verbal':
      return { bg: '#7c2d12', text: '#fed7aa', border: '#ea580c' };
    case 'discourse':
      return { bg: '#3b0764', text: '#e9d5ff', border: '#c084fc' };
    case 'verbal-tics':
      return { bg: '#164e63', text: '#cffafe', border: '#06b6d4' };
    case 'phrase':
    default:
      return { bg: '#7c3aed', text: '#ede9fe', border: '#a78bfa' };
  }
}
