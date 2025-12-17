import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Text, Dimensions } from 'react-native';
import { SentimentAnalysis, analyzeSentiment, analyzeSentimentTrends, getSentimentColor, getSentimentEmoji } from '@/utils/sentimentAnalysis';
import { Note } from '@/types/note';

const { width } = Dimensions.get('window');

interface SentimentViewProps {
  analysis?: SentimentAnalysis;
  notes?: Note[];
}

const SentimentAnalysisView: React.FC<SentimentViewProps> = ({ analysis, notes = [] }) => {
  const effectiveAnalysis = useMemo(() => {
    if (analysis) {
      return analysis;
    }

    if (notes.length > 0) {
      const combinedTranscript = notes
        .map((note) => note.transcription)
        .filter((text) => text && text.trim().length > 0)
        .join('\n');

      if (combinedTranscript.length > 0) {
        return analyzeSentiment(combinedTranscript);
      }
    }

    return null;
  }, [analysis, notes]);

  const trends = useMemo(() => (notes.length > 0 ? analyzeSentimentTrends(notes) : null), [notes]);
  const sentimentColor = effectiveAnalysis ? getSentimentColor(effectiveAnalysis.sentiment) : getSentimentColor('Neutral');

  if (!effectiveAnalysis || notes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📊 No sentiment data available</Text>
          <Text style={styles.emptySubtext}>Create or select a note to analyze sentiment</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section - Overall Sentiment */}
      <View style={styles.section}>
        <View style={[styles.sentimentCard, { backgroundColor: sentimentColor.bg, borderColor: sentimentColor.border }]}>
          <Text style={styles.sentimentEmoji}>{getSentimentEmoji(effectiveAnalysis.sentiment)}</Text>
          <Text style={[styles.sentimentLabel, { color: sentimentColor.text }]}>{effectiveAnalysis.sentiment}</Text>
          <Text style={styles.emotionalTone}>{effectiveAnalysis.emotionalTone}</Text>

          <View style={styles.scoreContainer}>
            <View style={styles.scoreBar}>
              <Text style={styles.scoreLabel}>Overall Score</Text>
              <View style={styles.compoundScaleContainer}>
                <View
                  style={[
                    styles.compoundBar,
                    {
                      width: `${((effectiveAnalysis.overall.compound + 1) / 2) * 100}%`,
                      backgroundColor:
                        effectiveAnalysis.overall.compound > 0
                          ? '#4ade80'
                          : effectiveAnalysis.overall.compound < 0
                            ? '#f87171'
                            : '#facc15',
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreValue}>{(effectiveAnalysis.overall.compound * 100).toFixed(0)}%</Text>
            </View>

            <View style={styles.confidenceBar}>
              <Text style={styles.scoreLabel}>Analysis Confidence</Text>
              <View style={styles.confidenceScaleContainer}>
                <View
                  style={[
                    styles.confidenceIndicator,
                    {
                      width: `${effectiveAnalysis.confidence * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreValue}>{(effectiveAnalysis.confidence * 100).toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sentiment Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Sentiment Breakdown</Text>
        <View style={styles.breakdownContainer}>
          <StatBox
            label="Positive"
            value={`${(effectiveAnalysis.overall.positive * 100).toFixed(0)}%`}
            color="#4ade80"
            emoji="😊"
          />
          <StatBox
            label="Negative"
            value={`${(effectiveAnalysis.overall.negative * 100).toFixed(0)}%`}
            color="#f87171"
            emoji="😔"
          />
          <StatBox
            label="Neutral"
            value={`${(effectiveAnalysis.overall.neutral * 100).toFixed(0)}%`}
            color="#facc15"
            emoji="😐"
          />
        </View>
      </View>

      {/* Key Phrases */}
      {effectiveAnalysis.keyPhrases && effectiveAnalysis.keyPhrases.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Key Phrases</Text>
          <View style={styles.phrasesContainer}>
            {effectiveAnalysis.keyPhrases.slice(0, 8).map((phrase, index) => {
              const phraseColor = phrase.sentiment === 'Positive' ? '#4ade80' : '#f87171';
              return (
                <View key={index} style={[styles.phraseTag, { borderColor: phraseColor }]}>
                  <Text style={[styles.phraseText, { color: phraseColor }]}>
                    {phrase.sentiment === 'Positive' ? '✓' : '✕'} {phrase.phrase}
                  </Text>
                  <Text style={[styles.phraseIntensity, { color: phraseColor }]}>
                    {(phrase.intensity * 100).toFixed(0)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Sentence-level Analysis */}
      {effectiveAnalysis.sentences && effectiveAnalysis.sentences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Sentence Analysis (Top 5)</Text>
          <View style={styles.sentencesContainer}>
            {effectiveAnalysis.sentences.slice(0, 5).map((sentence, index) => {
              const sentenceColor = getSentimentColor(sentence.sentiment_label);
              return (
                <View key={index} style={[styles.sentenceBox, { borderLeftColor: sentenceColor.border, borderLeftWidth: 3 }]}>
                  <View style={styles.sentenceHeader}>
                    <Text style={styles.sentenceNum}>Sentence {index + 1}</Text>
                    <View style={[styles.sentimentBadge, { backgroundColor: sentenceColor.bg }]}>
                      <Text style={[styles.sentimentBadgeText, { color: sentenceColor.text }]}>
                        {getSentimentEmoji(sentence.sentiment_label)} {sentence.sentiment_label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sentenceText}>{sentence.text}</Text>
                  <View style={styles.sentenceScores}>
                    <ScoreIndicator label="+" value={sentence.sentiment.positive} color="#4ade80" />
                    <ScoreIndicator label="-" value={sentence.sentiment.negative} color="#f87171" />
                    <ScoreIndicator label="=" value={sentence.sentiment.neutral} color="#facc15" />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Trends Analysis (if multiple notes) */}
      {trends && notes.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Sentiment Trends (All Notes)</Text>
          <View style={styles.trendsContainer}>
            <View style={styles.trendBox}>
              <Text style={styles.trendLabel}>Total Notes Analyzed</Text>
              <Text style={styles.trendValue}>{notes.length}</Text>
            </View>

            <View style={styles.distributionContainer}>
              <DistributionBar
                label="Positive"
                count={trends.positiveCount}
                total={notes.length}
                color="#4ade80"
              />
              <DistributionBar
                label="Negative"
                count={trends.negativeCount}
                total={notes.length}
                color="#f87171"
              />
              <DistributionBar
                label="Neutral"
                count={trends.neutralCount}
                total={notes.length}
                color="#facc15"
              />
              <DistributionBar
                label="Mixed"
                count={trends.mixedCount}
                total={notes.length}
                color="#a78bfa"
              />
            </View>

            <View style={styles.trendBox}>
              <Text style={styles.trendLabel}>Average Sentiment Compound</Text>
              <Text style={[styles.trendValue, { color: trends.averageSentiment > 0 ? '#4ade80' : '#f87171' }]}>
                {(trends.averageSentiment * 100).toFixed(0)}%
              </Text>
            </View>

            <View style={styles.trendBox}>
              <Text style={styles.trendLabel}>Most Common Sentiment</Text>
              <Text style={styles.trendValue}>
                {getSentimentEmoji(trends.mostCommonSentiment)} {trends.mostCommonSentiment}
              </Text>
            </View>

            <View style={[styles.trendBox, { borderTopWidth: 1, borderTopColor: '#4a5568', marginTop: 12 }]}>
              <Text style={styles.trendLabel}>Overall Tone</Text>
              <Text style={styles.trendDescription}>{trends.overallTone}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Single Note Summary */}
      {notes.length === 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Note Summary</Text>
          <View style={styles.summaryBox}>
            <SummaryLine label="Sentiment Sentences" value={`${effectiveAnalysis.sentences.length}`} />
            <SummaryLine label="Key Phrases Found" value={`${effectiveAnalysis.keyPhrases.length}`} />
            <SummaryLine label="Analysis Confidence" value={`${(effectiveAnalysis.confidence * 100).toFixed(0)}%`} />
          </View>
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
};

interface StatBoxProps {
  label: string;
  value: string;
  color: string;
  emoji: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, color, emoji }) => (
  <View style={styles.statBox}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface ScoreIndicatorProps {
  label: string;
  value: number;
  color: string;
}

const ScoreIndicator: React.FC<ScoreIndicatorProps> = ({ label, value, color }) => (
  <View style={styles.scoreIndicator}>
    <Text style={[styles.scoreIndicatorLabel, { color }]}>{label}</Text>
    <View style={styles.scoreIndicatorBar}>
      <View
        style={[
          styles.scoreIndicatorFill,
          {
            width: `${value * 100}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
    <Text style={styles.scoreIndicatorValue}>{(value * 100).toFixed(0)}%</Text>
  </View>
);

interface DistributionBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const DistributionBar: React.FC<DistributionBarProps> = ({ label, count, total, color }) => (
  <View style={styles.distributionItem}>
    <View style={styles.distributionLabel}>
      <Text style={styles.distributionLabelText}>{label}</Text>
      <Text style={styles.distributionCount}>
        {count}/{total}
      </Text>
    </View>
    <View style={styles.distributionBarContainer}>
      <View
        style={[
          styles.distributionBarFill,
          {
            width: `${(count / total) * 100}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  </View>
);

interface SummaryLineProps {
  label: string;
  value: string;
}

const SummaryLine: React.FC<SummaryLineProps> = ({ label, value }) => (
  <View style={styles.summaryLine}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a202c',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0aec0',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  sentimentCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  sentimentEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  sentimentLabel: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emotionalTone: {
    fontSize: 13,
    color: '#cbd5e0',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  scoreContainer: {
    width: '100%',
  },
  scoreBar: {
    marginBottom: 16,
  },
  confidenceBar: {
    marginBottom: 0,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: 8,
  },
  compoundScaleContainer: {
    height: 8,
    backgroundColor: '#2d3748',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  compoundBar: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceScaleContainer: {
    height: 8,
    backgroundColor: '#2d3748',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  confidenceIndicator: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e0',
    textAlign: 'right',
  },
  breakdownContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#a0aec0',
  },
  phrasesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phraseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d3748',
    borderWidth: 1,
    marginBottom: 8,
  },
  phraseText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  phraseIntensity: {
    fontSize: 11,
    fontWeight: '600',
  },
  sentencesContainer: {
    gap: 12,
  },
  sentenceBox: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  sentenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentenceNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0aec0',
  },
  sentimentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sentimentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sentenceText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
    marginBottom: 10,
  },
  sentenceScores: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreIndicator: {
    flex: 1,
  },
  scoreIndicatorLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreIndicatorBar: {
    height: 4,
    backgroundColor: '#4a5568',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  scoreIndicatorFill: {
    height: '100%',
    borderRadius: 2,
  },
  scoreIndicatorValue: {
    fontSize: 10,
    color: '#cbd5e0',
  },
  trendsContainer: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
  },
  trendBox: {
    marginBottom: 16,
    paddingBottom: 16,
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: 6,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  trendDescription: {
    fontSize: 13,
    color: '#cbd5e0',
    lineHeight: 18,
  },
  distributionContainer: {
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  distributionItem: {
    gap: 8,
  },
  distributionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e0',
  },
  distributionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0aec0',
  },
  distributionBarContainer: {
    height: 6,
    backgroundColor: '#1a202c',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryBox: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e0',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a0aec0',
  },
  spacer: {
    height: 24,
  },
});

export default SentimentAnalysisView;
