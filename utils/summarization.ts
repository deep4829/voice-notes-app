/**
 * Quick Summary Generation Engine
 * Generates 2-3 sentence summaries from transcriptions using extractive summarization
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'can', 'may', 'might', 'must', 'shall', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'where', 'when', 'why', 'how'
]);

// Important keywords that indicate significant content
const SIGNIFICANCE_KEYWORDS: Record<string, number> = {
  'important': 3,
  'critical': 3,
  'urgent': 3,
  'key': 2,
  'must': 2,
  'need': 2,
  'issue': 2,
  'problem': 2,
  'solution': 2,
  'result': 2,
  'decision': 2,
  'action': 2,
  'meeting': 1.5,
  'discussion': 1.5,
  'agreed': 2,
  'decided': 2,
  'completed': 1.5,
  'deadline': 2,
  'goal': 1.5,
  'budget': 1.5,
  'revenue': 1.5,
  'client': 1.5,
  'customer': 1.5,
};

export interface SummaryInfo {
  summary: string;
  sentences: string[];
  wordCount: number;
  generatedAt: number;
}

/**
 * Sentence tokenization
 */
const tokenizeSentences = (text: string): string[] => {
  // Split by common sentence endings
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 10) // Filter very short sentences
    .map(s => s.trim());
  
  return sentences;
};

/**
 * Tokenize text into words
 */
const tokenizeWords = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
};

/**
 * Calculate word frequency in text
 */
const calculateWordFrequency = (text: string): Map<string, number> => {
  const words = tokenizeWords(text);
  const frequency = new Map<string, number>();
  
  for (const word of words) {
    if (!STOP_WORDS.has(word)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }
  
  return frequency;
};

/**
 * Calculate sentence score based on word frequency and significance
 */
const calculateSentenceScore = (
  sentence: string,
  wordFrequency: Map<string, number>,
  position: number,
  totalSentences: number
): number => {
  const words = tokenizeWords(sentence);
  let score = 0;
  
  // Add word frequency score
  for (const word of words) {
    const freq = wordFrequency.get(word) || 0;
    score += freq;
  }
  
  // Add significance keywords bonus
  for (const word of words) {
    const significance = SIGNIFICANCE_KEYWORDS[word] || 0;
    score += significance;
  }
  
  // Boost first and last sentences slightly (important positions)
  if (position === 0 || position === totalSentences - 1) {
    score *= 1.15;
  }
  
  // Penalize very short sentences
  if (words.length < 5) {
    score *= 0.7;
  }
  
  // Penalize very long sentences (likely complex)
  if (words.length > 30) {
    score *= 0.85;
  }
  
  return score;
};

/**
 * Generate a quick 2-3 sentence summary
 */
export const generateSummary = (
  text: string,
  targetSentences: number = 2
): SummaryInfo => {
  const sentences = tokenizeSentences(text);
  
  if (sentences.length === 0) {
    return {
      summary: 'No content to summarize.',
      sentences: [],
      wordCount: 0,
      generatedAt: Date.now(),
    };
  }
  
  // If text has fewer sentences than target, return all
  if (sentences.length <= targetSentences) {
    return {
      summary: sentences.join(' '),
      sentences,
      wordCount: tokenizeWords(text).length,
      generatedAt: Date.now(),
    };
  }
  
  // Calculate word frequency for scoring
  const wordFrequency = calculateWordFrequency(text);
  
  // Score each sentence
  const scoredSentences = sentences.map((sentence, index) => ({
    sentence,
    score: calculateSentenceScore(sentence, wordFrequency, index, sentences.length),
    originalIndex: index,
  }));
  
  // Select top sentences by score
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, targetSentences)
    .sort((a, b) => a.originalIndex - b.originalIndex) // Restore original order
    .map(s => s.sentence);
  
  const summary = topSentences.join(' ');
  
  return {
    summary,
    sentences: topSentences,
    wordCount: tokenizeWords(text).length,
    generatedAt: Date.now(),
  };
};

/**
 * Generate multi-length summaries
 */
export const generateMultiLengthSummaries = (
  text: string
): { brief: string; short: string; medium: string } => {
  const brief = generateSummary(text, 1);
  const short = generateSummary(text, 2);
  const medium = generateSummary(text, 3);
  
  return {
    brief: brief.summary,
    short: short.summary,
    medium: medium.summary,
  };
};

/**
 * Extract key entities/keywords from text
 */
export const extractKeywords = (
  text: string,
  limit: number = 5
): string[] => {
  const wordFrequency = calculateWordFrequency(text);
  
  // Sort by frequency
  const keywords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
  
  return keywords;
};

/**
 * Extract main topics from text
 */
export const extractMainTopics = (text: string): string[] => {
  const words = tokenizeWords(text);
  const capitalized = new Set<string>();
  
  // Find capitalized words (potential proper nouns)
  const originalText = text.split(/\s+/);
  for (let i = 0; i < originalText.length; i++) {
    const word = originalText[i].replace(/[^\w]/g, '');
    if (word.length > 0 && word[0] === word[0].toUpperCase() && !['The', 'A', 'An', 'I'].includes(word)) {
      capitalized.add(word.toLowerCase());
    }
  }
  
  // Combine with significance keywords
  const topics = new Set<string>();
  
  for (const [keyword, significance] of Object.entries(SIGNIFICANCE_KEYWORDS)) {
    if (significance >= 2 && words.includes(keyword)) {
      topics.add(keyword);
    }
  }
  
  // Add capitalized words
  Array.from(capitalized).slice(0, 3).forEach(word => topics.add(word));
  
  return Array.from(topics).slice(0, 5);
};

/**
 * Calculate readability metrics
 */
export const getReadabilityMetrics = (text: string): {
  wordCount: number;
  sentenceCount: number;
  averageWordLength: number;
  averageSentenceLength: number;
  readingTimeMinutes: number;
} => {
  const words = tokenizeWords(text);
  const sentences = tokenizeSentences(text);
  
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const averageWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount || 0;
  const averageSentenceLength = wordCount / sentenceCount || 0;
  
  // Approximate reading time: 200 words per minute average
  const readingTimeMinutes = Math.ceil(wordCount / 200);
  
  return {
    wordCount,
    sentenceCount,
    averageWordLength: Math.round(averageWordLength * 100) / 100,
    averageSentenceLength: Math.round(averageSentenceLength * 100) / 100,
    readingTimeMinutes,
  };
};

/**
 * Generate a summary with all metadata
 */
export const generateComprehensiveSummary = (text: string): {
  summary: SummaryInfo;
  keywords: string[];
  topics: string[];
  readability: ReturnType<typeof getReadabilityMetrics>;
  multiLength: ReturnType<typeof generateMultiLengthSummaries>;
} => {
  return {
    summary: generateSummary(text, 2),
    keywords: extractKeywords(text),
    topics: extractMainTopics(text),
    readability: getReadabilityMetrics(text),
    multiLength: generateMultiLengthSummaries(text),
  };
};

/**
 * Get summary diagnostics
 */
export const getSummaryDiagnostics = (): Record<string, any> => {
  return {
    stopWordsCount: STOP_WORDS.size,
    significanceKeywordsCount: Object.keys(SIGNIFICANCE_KEYWORDS).length,
    defaultTargetSentences: 2,
    timestamp: Date.now(),
  };
};
