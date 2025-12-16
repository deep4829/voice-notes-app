/**
 * Word Cloud Generation Engine
 * Analyzes note transcriptions to identify frequently used non-stop words
 * and generates word cloud data for visualization
 */

// Comprehensive stop words set (150+ common English words)
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'might',
  'more', 'most', 'must', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'um', 'uh', 'hmm', 'like', 'you know', 'okay',
  'really', 'basically', 'actually', 'sort of', 'kind of', 'just', 'well', 'right',
  'though', 'thing', 'things', 'said', 'say', 'says', 'etc', 'etc.', 'mr', 'mrs',
]);

export interface WordCloudItem {
  word: string;
  frequency: number;
  size: number; // 1-5 scale
  color?: string;
}

export interface WordCloudData {
  words: WordCloudItem[];
  totalWords: number;
  uniqueWords: number;
  generatedAt: number;
}

/**
 * Extract and clean words from text
 */
const tokenizeText = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w'-]/g, '')) // Remove punctuation
    .filter(word => word.length > 2); // Only words with 3+ characters
};

/**
 * Count word frequencies
 */
const calculateWordFrequency = (words: string[]): Map<string, number> => {
  const frequency = new Map<string, number>();

  for (const word of words) {
    if (!STOP_WORDS.has(word)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return frequency;
};

/**
 * Normalize frequencies to size scale (1-5)
 */
const normalizeToSizeScale = (
  frequency: Map<string, number>
): Map<string, number> => {
  const frequencies = Array.from(frequency.values());
  const maxFreq = Math.max(...frequencies);
  const minFreq = Math.min(...frequencies);
  const range = maxFreq - minFreq || 1;

  const normalized = new Map<string, number>();
  for (const [word, freq] of frequency) {
    const normalized_size = ((freq - minFreq) / range) * 4 + 1; // Scale 1-5
    normalized.set(word, Math.round(normalized_size * 10) / 10);
  }

  return normalized;
};

/**
 * Generate color based on word frequency
 */
const generateColor = (size: number): string => {
  // Color gradient: size 1=cool blue, size 5=hot red
  const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'];
  const index = Math.min(Math.floor(size) - 1, 4);
  return colors[index];
};

/**
 * Generate word cloud from transcription text
 */
export const generateWordCloud = (
  text: string,
  maxWords: number = 30
): WordCloudData => {
  try {
    const words = tokenizeText(text);
    const frequency = calculateWordFrequency(words);

    // Sort by frequency and get top N words
    const sortedWords = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords);

    // Normalize sizes
    const sizeMap = normalizeToSizeScale(frequency);

    // Create word cloud items
    const cloudItems: WordCloudItem[] = sortedWords.map(([word, freq]) => ({
      word,
      frequency: freq,
      size: sizeMap.get(word) || 1,
      color: generateColor(sizeMap.get(word) || 1),
    }));

    return {
      words: cloudItems,
      totalWords: words.length,
      uniqueWords: frequency.size,
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error('[WordCloud] Error generating word cloud:', error);
    return {
      words: [],
      totalWords: 0,
      uniqueWords: 0,
      generatedAt: Date.now(),
    };
  }
};

/**
 * Get top N keywords from word cloud
 */
export const getTopKeywords = (
  wordCloudData: WordCloudData,
  limit: number = 5
): string[] => {
  return wordCloudData.words
    .slice(0, limit)
    .map(item => item.word);
};

/**
 * Get word frequency statistics
 */
export const getWordStats = (
  wordCloudData: WordCloudData
): {
  averageFrequency: number;
  maxFrequency: number;
  minFrequency: number;
} => {
  if (wordCloudData.words.length === 0) {
    return {
      averageFrequency: 0,
      maxFrequency: 0,
      minFrequency: 0,
    };
  }

  const frequencies = wordCloudData.words.map(item => item.frequency);
  const sum = frequencies.reduce((a, b) => a + b, 0);

  return {
    averageFrequency: Math.round((sum / frequencies.length) * 10) / 10,
    maxFrequency: Math.max(...frequencies),
    minFrequency: Math.min(...frequencies),
  };
};

/**
 * Extract main topics (multi-word concepts)
 */
export const extractTopics = (wordCloudData: WordCloudData): string[] => {
  // Get top 3 keywords
  return getTopKeywords(wordCloudData, 3);
};

/**
 * Check if text has sufficient content for word cloud
 */
export const hasEnoughContentForWordCloud = (text: string): boolean => {
  const words = tokenizeText(text);
  return words.length >= 20; // At least 20 meaningful words
};
