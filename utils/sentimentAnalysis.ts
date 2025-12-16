import { Note } from '@/types/note';

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  compound: number; // -1 to 1, overall sentiment
}

export interface SentimentAnalysis {
  overall: SentimentScore;
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  confidence: number; // 0-1 scale
  sentences: {
    text: string;
    sentiment: SentimentScore;
    sentiment_label: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  }[];
  emotionalTone: string;
  keyPhrases: {
    phrase: string;
    sentiment: 'Positive' | 'Negative' | 'Neutral';
    intensity: number; // 0-1
  }[];
  analysisDate: Date;
}

// Positive words with intensity (0-1)
const POSITIVE_WORDS: { [key: string]: number } = {
  good: 0.7,
  great: 0.9,
  excellent: 0.95,
  amazing: 0.95,
  wonderful: 0.9,
  fantastic: 0.95,
  brilliant: 0.9,
  awesome: 0.95,
  perfect: 0.95,
  beautiful: 0.85,
  love: 0.9,
  happy: 0.85,
  glad: 0.8,
  pleased: 0.8,
  satisfied: 0.75,
  proud: 0.85,
  confident: 0.75,
  successful: 0.85,
  winning: 0.85,
  accomplished: 0.85,
  thrilled: 0.9,
  delighted: 0.9,
  grateful: 0.85,
  appreciate: 0.8,
  inspired: 0.85,
  motivated: 0.8,
  excited: 0.85,
  optimistic: 0.8,
  positive: 0.75,
  improvement: 0.7,
  better: 0.7,
  best: 0.85,
  success: 0.85,
  achieve: 0.75,
  victory: 0.85,
  triumph: 0.85,
  well: 0.6,
  nice: 0.7,
  cool: 0.7,
  enjoyed: 0.8,
  fun: 0.75,
  interesting: 0.65,
  fascinated: 0.8,
};

// Negative words with intensity (0-1)
const NEGATIVE_WORDS: { [key: string]: number } = {
  bad: 0.7,
  terrible: 0.95,
  horrible: 0.95,
  awful: 0.95,
  hate: 0.9,
  angry: 0.85,
  upset: 0.8,
  sad: 0.85,
  depressed: 0.9,
  disappointed: 0.8,
  frustrated: 0.8,
  annoyed: 0.7,
  bored: 0.7,
  tired: 0.65,
  stressed: 0.8,
  anxious: 0.8,
  worried: 0.8,
  afraid: 0.85,
  scared: 0.85,
  difficult: 0.65,
  problem: 0.7,
  issue: 0.65,
  failed: 0.85,
  failure: 0.85,
  loss: 0.8,
  lost: 0.75,
  worst: 0.9,
  wrong: 0.7,
  mistake: 0.65,
  error: 0.65,
  bug: 0.6,
  pain: 0.8,
  hurt: 0.75,
  sick: 0.75,
  ill: 0.7,
  negative: 0.75,
  useless: 0.85,
  worthless: 0.85,
  stupid: 0.85,
  dumb: 0.85,
  ridiculous: 0.8,
  pathetic: 0.85,
  disgusting: 0.9,
  disgusted: 0.85,
  furious: 0.9,
  enraged: 0.95,
  devastated: 0.9,
  miserable: 0.9,
  dreadful: 0.9,
};

// Intensifiers
const INTENSIFIERS = {
  very: 1.2,
  extremely: 1.3,
  so: 1.2,
  really: 1.2,
  quite: 1.1,
  absolutely: 1.3,
  totally: 1.3,
  completely: 1.3,
  utterly: 1.3,
};

// Negations that flip sentiment
const NEGATIONS = ['not', 'no', 'never', 'neither', 'nobody', 'nothing', 'hardly', 'barely', 'rarely'];

/**
 * Tokenize text into sentences
 */
function tokenizeSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Tokenize sentence into words
 */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Extract key phrases (positive/negative multi-word expressions)
 */
function extractKeyPhrases(text: string): { phrase: string; sentiment: 'Positive' | 'Negative'; intensity: number }[] {
  const phrases: { phrase: string; sentiment: 'Positive' | 'Negative'; intensity: number }[] = [];
  const lowerText = text.toLowerCase();

  // Common positive phrases
  const positivePatterns = [
    'very good',
    'really great',
    'so good',
    'so great',
    'absolutely love',
    'really love',
    'great job',
    'well done',
    'impressed with',
    'looking forward',
    'cant wait',
    'excited about',
    'look forward',
    'good news',
    'great idea',
    'brilliant idea',
    'brilliant work',
  ];

  // Common negative phrases
  const negativePatterns = [
    'very bad',
    'really bad',
    'so bad',
    'absolutely hate',
    'hate it',
    'dont like',
    'not good',
    'not great',
    'bad news',
    'bad luck',
    'terrible idea',
    'awful idea',
    'not happy',
    'really upset',
    'very upset',
    'extremely disappointed',
    'totally disappointed',
    'never again',
    'wasted time',
  ];

  positivePatterns.forEach((phrase) => {
    if (lowerText.includes(phrase)) {
      phrases.push({
        phrase,
        sentiment: 'Positive' as const,
        intensity: 0.8,
      });
    }
  });

  negativePatterns.forEach((phrase) => {
    if (lowerText.includes(phrase)) {
      phrases.push({
        phrase,
        sentiment: 'Negative' as const,
        intensity: 0.8,
      });
    }
  });

  return phrases;
}

/**
 * Calculate sentiment score for a piece of text
 */
function calculateSentiment(text: string): SentimentScore {
  const words = tokenizeWords(text);
  let positiveScore = 0;
  let negativeScore = 0;
  let wordCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let score = 0;
    let isPositive = false;
    let isNegative = false;

    // Check if word is positive
    if (POSITIVE_WORDS[word]) {
      score = POSITIVE_WORDS[word];
      isPositive = true;
    } else if (NEGATIVE_WORDS[word]) {
      score = NEGATIVE_WORDS[word];
      isNegative = true;
    }

    if (score > 0) {
      // Check for intensifiers before the word
      if (i > 0 && INTENSIFIERS[words[i - 1] as keyof typeof INTENSIFIERS]) {
        score *= INTENSIFIERS[words[i - 1] as keyof typeof INTENSIFIERS];
      }

      // Check for negations before the word (flip sentiment)
      let hasNegation = false;
      if (i > 0 && NEGATIONS.includes(words[i - 1])) {
        hasNegation = true;
      }

      if (hasNegation) {
        // Flip sentiment
        if (isPositive) {
          negativeScore += score * 0.5;
        } else {
          positiveScore += score * 0.5;
        }
      } else {
        if (isPositive) {
          positiveScore += score;
        } else {
          negativeScore += score;
        }
      }

      wordCount++;
    }
  }

  // Normalize scores
  const totalScore = positiveScore + negativeScore;
  const normalizedPositive = totalScore > 0 ? positiveScore / totalScore : 0;
  const normalizedNegative = totalScore > 0 ? negativeScore / totalScore : 0;
  const neutral = 1 - (normalizedPositive + normalizedNegative);

  // Compound score: -1 (most negative) to 1 (most positive)
  const compound = (positiveScore - negativeScore) / Math.max(totalScore, 1);

  return {
    positive: Math.min(normalizedPositive, 1),
    negative: Math.min(normalizedNegative, 1),
    neutral: Math.max(neutral, 0),
    compound: Math.max(-1, Math.min(1, compound)),
  };
}

/**
 * Classify sentiment from compound score
 */
function classifySentiment(
  compound: number,
  positive: number,
  negative: number
): 'Positive' | 'Negative' | 'Neutral' | 'Mixed' {
  // Check for mixed sentiment
  if (positive > 0.3 && negative > 0.3) {
    return 'Mixed';
  }

  if (compound >= 0.05) {
    return 'Positive';
  } else if (compound <= -0.05) {
    return 'Negative';
  } else {
    return 'Neutral';
  }
}

/**
 * Get emotional tone description
 */
function getEmotionalTone(sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed', compound: number): string {
  if (sentiment === 'Positive') {
    if (compound > 0.5) return 'Very Positive - Highly enthusiastic and optimistic';
    if (compound > 0.2) return 'Positive - Satisfied and content';
    return 'Somewhat Positive - Mildly favorable';
  } else if (sentiment === 'Negative') {
    if (compound < -0.5) return 'Very Negative - Highly critical and upset';
    if (compound < -0.2) return 'Negative - Dissatisfied and concerned';
    return 'Somewhat Negative - Slightly unfavorable';
  } else if (sentiment === 'Mixed') {
    return 'Mixed - Both positive and negative sentiments present';
  } else {
    return 'Neutral - Objective and impartial tone';
  }
}

/**
 * Main sentiment analysis function
 */
export function analyzeSentiment(text: string): SentimentAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      overall: { positive: 0, negative: 0, neutral: 1, compound: 0 },
      sentiment: 'Neutral',
      confidence: 0,
      sentences: [],
      emotionalTone: 'No content to analyze',
      keyPhrases: [],
      analysisDate: new Date(),
    };
  }

  // Analyze overall sentiment
  const overallScore = calculateSentiment(text);
  const overallSentiment = classifySentiment(overallScore.positive, overallScore.negative, overallScore.compound);

  // Analyze sentence-level sentiment
  const sentences = tokenizeSentences(text).map((sentence) => {
    const score = calculateSentiment(sentence);
    const sentiment = classifySentiment(score.compound, score.positive, score.negative);

    return {
      text: sentence,
      sentiment: score,
      sentiment_label: sentiment,
    };
  });

  // Extract key phrases
  const keyPhrases = extractKeyPhrases(text);

  // Calculate confidence (based on number of sentiment words found)
  const sentimentWords = tokenizeWords(text).filter(
    (w) => POSITIVE_WORDS[w] || NEGATIVE_WORDS[w] || NEGATIONS.includes(w)
  );
  const confidence = Math.min(sentimentWords.length / Math.max(tokenizeWords(text).length, 1), 1);

  // Get emotional tone
  const emotionalTone = getEmotionalTone(overallSentiment, overallScore.compound);

  return {
    overall: overallScore,
    sentiment: overallSentiment,
    confidence,
    sentences,
    emotionalTone,
    keyPhrases,
    analysisDate: new Date(),
  };
}

/**
 * Analyze sentiment for multiple notes and return aggregated metrics
 */
export function analyzeSentimentTrends(notes: Note[]): {
  averageSentiment: number; // -1 to 1
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  mixedCount: number;
  overallTone: string;
  mostCommonSentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  sentimentDistribution: { [key: string]: number };
  averageConfidence: number;
} {
  if (notes.length === 0) {
    return {
      averageSentiment: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      mixedCount: 0,
      overallTone: 'No notes to analyze',
      mostCommonSentiment: 'Neutral',
      sentimentDistribution: { Positive: 0, Negative: 0, Neutral: 0, Mixed: 0 },
      averageConfidence: 0,
    };
  }

  const analyses = notes.map((note) => analyzeSentiment(note.transcription));

  const sentimentCounts = {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
    Mixed: 0,
  };

  let totalCompound = 0;
  let totalConfidence = 0;

  analyses.forEach((analysis) => {
    sentimentCounts[analysis.sentiment]++;
    totalCompound += analysis.overall.compound;
    totalConfidence += analysis.confidence;
  });

  const averageSentiment = totalCompound / notes.length;
  const averageConfidence = totalConfidence / notes.length;

  const distribution = {
    Positive: sentimentCounts.Positive,
    Negative: sentimentCounts.Negative,
    Neutral: sentimentCounts.Neutral,
    Mixed: sentimentCounts.Mixed,
  };

  const mostCommonSentiment = (Object.keys(distribution) as Array<keyof typeof distribution>).reduce((a, b) =>
    distribution[a] > distribution[b] ? a : b
  );

  const overallTone = getEmotionalTone(mostCommonSentiment, averageSentiment);

  return {
    averageSentiment,
    positiveCount: sentimentCounts.Positive,
    negativeCount: sentimentCounts.Negative,
    neutralCount: sentimentCounts.Neutral,
    mixedCount: sentimentCounts.Mixed,
    overallTone,
    mostCommonSentiment,
    sentimentDistribution: distribution,
    averageConfidence,
  };
}

/**
 * Get sentiment emoji for visual representation
 */
export function getSentimentEmoji(sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed'): string {
  switch (sentiment) {
    case 'Positive':
      return '😊';
    case 'Negative':
      return '😔';
    case 'Mixed':
      return '😐';
    case 'Neutral':
      return '😐';
    default:
      return '😐';
  }
}

/**
 * Get sentiment color for visualization
 */
export function getSentimentColor(
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed'
): { bg: string; text: string; border: string } {
  switch (sentiment) {
    case 'Positive':
      return { bg: '#1a472a', text: '#4ade80', border: '#22c55e' };
    case 'Negative':
      return { bg: '#472020', text: '#f87171', border: '#ef4444' };
    case 'Mixed':
      return { bg: '#403a1a', text: '#facc15', border: '#eab308' };
    case 'Neutral':
    default:
      return { bg: '#2d3748', text: '#cbd5e0', border: '#718096' };
  }
}
