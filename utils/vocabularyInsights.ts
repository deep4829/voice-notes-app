/**
 * Vocabulary Insights Engine
 * Analyzes user's overall recorded vocabulary across all notes
 * Tracks unique words, sentence length, vocabulary richness, and more
 */

import { Note } from '@/types/note';

// Stop words for filtering
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
]);

export interface VocabularyInsights {
  totalWords: number;
  uniqueWords: number;
  uniqueMeaningfulWords: number;
  vocabularyRichness: number; // Ratio of unique to total (0-1)
  averageSentenceLength: number;
  averageWordLength: number;
  totalSentences: number;
  mostCommonWords: Array<{ word: string; frequency: number }>;
  rareWords: Array<{ word: string; frequency: number }>; // Words used only 1-2 times
  readabilityIndex: number; // Flesch-Kincaid estimate
  longestWord: string;
  shortestWord: string;
  analysisDate: number;
  notesAnalyzed: number;
}

/**
 * Tokenize text into words
 */
const tokenizeWords = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^\w'-]/g, ''))
    .filter(word => word.length > 0);
};

/**
 * Tokenize text into sentences
 */
const tokenizeSentences = (text: string): string[] => {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

/**
 * Calculate vocabulary insights from all notes
 */
export const analyzeVocabulary = (notes: Note[]): VocabularyInsights => {
  try {
    if (notes.length === 0) {
      return getEmptyInsights();
    }

    // Combine all transcriptions
    const allText = notes.map(n => n.transcription).join(' ');
    const words = tokenizeWords(allText);
    const sentences = tokenizeSentences(allText);

    if (words.length === 0) {
      return getEmptyInsights();
    }

    // Calculate word frequency
    const wordFrequency = new Map<string, number>();
    let meaningfulWords = 0;

    for (const word of words) {
      if (word.length > 2) {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        if (!STOP_WORDS.has(word)) {
          meaningfulWords++;
        }
      }
    }

    // Get most common words
    const sortedWords = Array.from(wordFrequency.entries())
      .sort((a, b) => b[1] - a[1]);

    const mostCommon = sortedWords
      .slice(0, 10)
      .map(([word, freq]) => ({ word, frequency: freq }));

    // Get rare words (used 1-2 times)
    const rareWords = sortedWords
      .filter(([_, freq]) => freq <= 2)
      .slice(0, 10)
      .map(([word, freq]) => ({ word, frequency: freq }));

    // Calculate metrics
    const uniqueWords = wordFrequency.size;
    const totalWords = words.length;
    const vocabularyRichness = uniqueWords / totalWords;
    const averageSentenceLength = totalWords / (sentences.length || 1);
    const averageWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / totalWords;

    // Find longest and shortest words
    const sortedByLength = sortedWords.sort((a, b) => b[0].length - a[0].length);
    const longestWord = sortedByLength[0]?.[0] || '';
    const shortestWord = sortedByLength[sortedByLength.length - 1]?.[0] || '';

    // Calculate readability (simplified Flesch-Kincaid)
    const avgSentenceLength = averageSentenceLength;
    const avgSyllablesPerWord = estimateAverageSyllables(words);
    const readabilityIndex = Math.max(
      0,
      0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59
    );

    return {
      totalWords,
      uniqueWords,
      uniqueMeaningfulWords: Array.from(wordFrequency.keys()).filter(
        w => !STOP_WORDS.has(w)
      ).length,
      vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
      averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
      averageWordLength: Math.round(averageWordLength * 10) / 10,
      totalSentences: sentences.length,
      mostCommonWords: mostCommon,
      rareWords,
      readabilityIndex: Math.round(readabilityIndex * 10) / 10,
      longestWord,
      shortestWord,
      analysisDate: Date.now(),
      notesAnalyzed: notes.length,
    };
  } catch (error) {
    console.error('[VocabularyInsights] Error analyzing vocabulary:', error);
    return getEmptyInsights();
  }
};

/**
 * Estimate average syllables per word
 */
const estimateAverageSyllables = (words: string[]): number => {
  const totalSyllables = words.reduce((sum, word) => {
    return sum + estimateSyllables(word);
  }, 0);

  return totalSyllables / (words.length || 1);
};

/**
 * Estimate syllables in a word
 */
const estimateSyllables = (word: string): number => {
  const lowerWord = word.toLowerCase();
  let count = 0;

  // Count vowel groups
  let previousWasVowel = false;
  for (const char of lowerWord) {
    const isVowel = 'aeiouy'.includes(char);
    if (isVowel && !previousWasVowel) {
      count++;
    }
    previousWasVowel = isVowel;
  }

  // Adjust for silent e
  if (lowerWord.endsWith('e')) {
    count--;
  }

  // Adjust for le
  if (lowerWord.endsWith('le') && lowerWord.length > 2) {
    count++;
  }

  return Math.max(1, count);
};

/**
 * Get empty insights object
 */
const getEmptyInsights = (): VocabularyInsights => ({
  totalWords: 0,
  uniqueWords: 0,
  uniqueMeaningfulWords: 0,
  vocabularyRichness: 0,
  averageSentenceLength: 0,
  averageWordLength: 0,
  totalSentences: 0,
  mostCommonWords: [],
  rareWords: [],
  readabilityIndex: 0,
  longestWord: '',
  shortestWord: '',
  analysisDate: Date.now(),
  notesAnalyzed: 0,
});

/**
 * Get vocabulary level description
 */
export const getVocabularyLevel = (richness: number): string => {
  if (richness > 0.7) return 'Excellent - Very diverse vocabulary';
  if (richness > 0.5) return 'Good - Solid vocabulary range';
  if (richness > 0.3) return 'Moderate - Fair vocabulary diversity';
  return 'Limited - Consider using more varied words';
};

/**
 * Get readability level description
 */
export const getReadabilityLevel = (index: number): string => {
  if (index < 6) return 'Easy - Elementary school level';
  if (index < 9) return 'Moderate - Middle school level';
  if (index < 13) return 'Good - High school level';
  if (index < 16) return 'Complex - College level';
  return 'Very Complex - Graduate level';
};

/**
 * Compare vocabulary with previous analysis
 */
export const compareVocabulary = (
  current: VocabularyInsights,
  previous: VocabularyInsights | null
): {
  uniqueWordsGrowth: number;
  richnessTrend: 'improving' | 'declining' | 'stable';
  sentenceLengthTrend: 'getting_longer' | 'getting_shorter' | 'stable';
} => {
  if (!previous) {
    return {
      uniqueWordsGrowth: 0,
      richnessTrend: 'stable',
      sentenceLengthTrend: 'stable',
    };
  }

  const uniqueWordsGrowth =
    ((current.uniqueWords - previous.uniqueWords) / previous.uniqueWords) * 100;

  const richnessDiff = current.vocabularyRichness - previous.vocabularyRichness;
  const richnessTrend =
    richnessDiff > 0.02 ? 'improving' : richnessDiff < -0.02 ? 'declining' : 'stable';

  const sentenceDiff =
    current.averageSentenceLength - previous.averageSentenceLength;
  const sentenceLengthTrend =
    sentenceDiff > 1 ? 'getting_longer' : sentenceDiff < -1 ? 'getting_shorter' : 'stable';

  return {
    uniqueWordsGrowth: Math.round(uniqueWordsGrowth * 10) / 10,
    richnessTrend,
    sentenceLengthTrend,
  };
};

/**
 * Get vocabulary insights summary as text
 */
export const getVocabularySummary = (insights: VocabularyInsights): string => {
  return `📊 Vocabulary Analysis (${insights.notesAnalyzed} notes):
• Total Words: ${insights.totalWords}
• Unique Words: ${insights.uniqueWords}
• Vocabulary Richness: ${(insights.vocabularyRichness * 100).toFixed(1)}%
• Avg Sentence: ${insights.averageSentenceLength} words
• Avg Word: ${insights.averageWordLength} letters
• Readability: ${getReadabilityLevel(insights.readabilityIndex)}`;
};
