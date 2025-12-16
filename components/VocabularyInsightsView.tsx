import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { VocabularyInsights, getVocabularyLevel, getReadabilityLevel } from '@/utils/vocabularyInsights';

interface VocabularyInsightsViewProps {
  insights: VocabularyInsights;
}

/**
 * Vocabulary Insights Dashboard
 */
export const VocabularyInsightsView: React.FC<VocabularyInsightsViewProps> = ({
  insights,
}) => {
  if (insights.notesAnalyzed === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Record some notes to see vocabulary insights</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <StatCard
          label="Total Words"
          value={insights.totalWords.toString()}
          icon="📝"
          color="#3B82F6"
        />
        <StatCard
          label="Unique Words"
          value={insights.uniqueWords.toString()}
          icon="🎯"
          color="#8B5CF6"
        />
        <StatCard
          label="Notes Analyzed"
          value={insights.notesAnalyzed.toString()}
          icon="📚"
          color="#EC4899"
        />
      </View>

      {/* Vocabulary Richness */}
      <MetricCard
        title="Vocabulary Richness"
        value={`${(insights.vocabularyRichness * 100).toFixed(1)}%`}
        description={getVocabularyLevel(insights.vocabularyRichness)}
        icon="🎨"
        color="#10B981"
        progress={insights.vocabularyRichness}
      />

      {/* Sentence Metrics */}
      <View style={styles.metricsRow}>
        <MetricBox
          label="Avg Sentence Length"
          value={`${insights.averageSentenceLength} words`}
          icon="📏"
        />
        <MetricBox
          label="Avg Word Length"
          value={`${insights.averageWordLength} letters`}
          icon="✏️"
        />
      </View>

      {/* Readability Index */}
      <MetricCard
        title="Readability Level"
        value={insights.readabilityIndex.toFixed(1)}
        description={getReadabilityLevel(insights.readabilityIndex)}
        icon="📖"
        color="#F59E0B"
      />

      {/* Word Extremes */}
      <View style={styles.extremesContainer}>
        <View style={styles.extremeBox}>
          <Text style={styles.extremeLabel}>📏 Longest Word</Text>
          <Text style={styles.extremeValue}>{insights.longestWord}</Text>
          <Text style={styles.extremeSubtext}>
            {insights.longestWord.length} letters
          </Text>
        </View>
        <View style={styles.extremeBox}>
          <Text style={styles.extremeLabel}>✨ Shortest Word</Text>
          <Text style={styles.extremeValue}>{insights.shortestWord}</Text>
          <Text style={styles.extremeSubtext}>
            {insights.shortestWord.length} letters
          </Text>
        </View>
      </View>

      {/* Most Common Words */}
      {insights.mostCommonWords.length > 0 && (
        <View style={styles.wordsSection}>
          <Text style={styles.sectionTitle}>🔥 Most Common Words</Text>
          <View style={styles.wordsList}>
            {insights.mostCommonWords.map((item, index) => (
              <View key={index} style={styles.wordItem}>
                <Text style={styles.wordRank}>#{index + 1}</Text>
                <Text style={styles.wordName}>{item.word}</Text>
                <Text style={styles.wordCount}>{item.frequency}x</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Rare Words */}
      {insights.rareWords.length > 0 && (
        <View style={styles.wordsSection}>
          <Text style={styles.sectionTitle}>💎 Rare Words (Used 1-2 Times)</Text>
          <View style={styles.wordsList}>
            {insights.rareWords.map((item, index) => (
              <View key={index} style={[styles.wordItem, styles.rareWordItem]}>
                <Text style={styles.wordName}>{item.word}</Text>
                <Text style={styles.wordCountRare}>{item.frequency}x</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Summary Stats */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>📊 Summary</Text>
        <SummaryLine
          label="Total Sentences"
          value={insights.totalSentences.toString()}
        />
        <SummaryLine
          label="Meaningful Unique Words"
          value={insights.uniqueMeaningfulWords.toString()}
        />
        <SummaryLine
          label="Stop Words Filtered"
          value={`${insights.totalWords - insights.uniqueMeaningfulWords}`}
        />
      </View>
    </ScrollView>
  );
};

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: string;
  color: string;
}> = ({ label, value, icon, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <View style={styles.statContent}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
);

/**
 * Metric Box Component
 */
const MetricBox: React.FC<{
  label: string;
  value: string;
  icon: string;
}> = ({ label, value, icon }) => (
  <View style={styles.metricBox}>
    <Text style={styles.metricIcon}>{icon}</Text>
    <Text style={styles.metricBoxValue}>{value}</Text>
    <Text style={styles.metricBoxLabel}>{label}</Text>
  </View>
);

/**
 * Metric Card Component
 */
const MetricCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: string;
  color: string;
  progress?: number;
}> = ({ title, value, description, icon, color, progress }) => (
  <View style={[styles.metricCard, { borderLeftColor: color }]}>
    <View style={styles.metricHeader}>
      <Text style={styles.metricTitle}>{icon} {title}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
    {progress !== undefined && (
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: color },
          ]}
        />
      </View>
    )}
    <Text style={styles.metricDescription}>{description}</Text>
  </View>
);

/**
 * Summary Line Component
 */
const SummaryLine: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <View style={styles.summaryLine}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 12,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    flexDirection: 'row',
    gap: 8,
  },
  statIcon: {
    fontSize: 24,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  metricBoxLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  metricCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricDescription: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  extremesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  extremeBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  extremeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
  },
  extremeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  extremeSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  wordsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  wordsList: {
    gap: 4,
  },
  wordItem: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rareWordItem: {
    backgroundColor: '#1E293B80',
  },
  wordRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  wordName: {
    flex: 1,
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  wordCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#10B98120',
    borderRadius: 4,
  },
  wordCountRare: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC4899',
  },
  summaryBox: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
});
