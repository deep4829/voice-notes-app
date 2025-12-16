import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import { FillerWordAnalysis, getCategoryDescription, getCategoryColor } from '@/utils/fillerWordRemoval';

const { width } = Dimensions.get('window');

interface FillerWordViewProps {
  analysis: FillerWordAnalysis;
}

const FillerWordView: React.FC<FillerWordViewProps> = ({ analysis }) => {
  const [showHighlighted, setShowHighlighted] = useState(true);
  const [showCleaned, setShowCleaned] = useState(false);

  if (!analysis || analysis.totalFillerWords === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyText}>No filler words detected</Text>
          <Text style={styles.emptySubtext}>Your transcription is clean!</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Stats */}
      <View style={styles.section}>
        <View style={styles.statsContainer}>
          <StatBox label="Filler Words" value={analysis.totalFillerWords.toString()} emoji="🎯" />
          <StatBox label="Percentage" value={`${analysis.fillerWordPercentage.toFixed(1)}%`} emoji="📊" />
          <StatBox label="Per Sentence" value={analysis.averageFillerWordsPerSentence.toFixed(1)} emoji="📈" />
        </View>
      </View>

      {/* Most Common Filler */}
      {analysis.mostCommonFiller && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔤 Most Common Filler</Text>
          <View style={styles.mostCommonBox}>
            <Text style={styles.mostCommonText}>"{analysis.mostCommonFiller}"</Text>
            <Text style={styles.mostCommonCount}>
              Used {analysis.fillerWordFrequency[analysis.mostCommonFiller]} times
            </Text>
          </View>
        </View>
      )}

      {/* Filler Word Frequency */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Filler Word Frequency</Text>
        <View style={styles.frequencyContainer}>
          {Object.entries(analysis.fillerWordFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word, count], index) => (
              <FrequencyBar key={index} word={word} count={count} maxCount={Math.max(...Object.values(analysis.fillerWordFrequency))} />
            ))}
        </View>
      </View>

      {/* Toggle View */}
      <View style={styles.section}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, showHighlighted && styles.toggleButtonActive]}
            onPress={() => {
              setShowHighlighted(true);
              setShowCleaned(false);
            }}
          >
            <Text
              style={[
                styles.toggleButtonText,
                showHighlighted && styles.toggleButtonTextActive,
              ]}
            >
              🎨 Highlighted
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showCleaned && styles.toggleButtonActive]}
            onPress={() => {
              setShowHighlighted(false);
              setShowCleaned(true);
            }}
          >
            <Text
              style={[
                styles.toggleButtonText,
                showCleaned && styles.toggleButtonTextActive,
              ]}
            >
              ✨ Cleaned
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Highlighted Text */}
      {showHighlighted && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Highlighted Transcript</Text>
          <View style={styles.highlightedTextContainer}>
            {analysis.highlightedText.map((segment, index) => (
              <Text key={index} style={segment.isFillerWord ? styles.fillerWordHighlight : styles.normalText}>
                {segment.text}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Cleaned Text */}
      {showCleaned && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Cleaned Transcript</Text>
          <View style={styles.cleanedTextContainer}>
            <Text style={styles.cleanedText}>{analysis.cleanedText}</Text>
          </View>
        </View>
      )}

      {/* Filler Words by Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏷️ Filler Words by Category</Text>
        <View style={styles.categoriesContainer}>
          {analysis.fillerWords.map((filler, index) => {
            const color = getCategoryColor(filler.category);
            return (
              <View
                key={index}
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor: color.bg,
                    borderColor: color.border,
                  },
                ]}
              >
                <Text style={[styles.categoryBadgeText, { color: color.text }]}>
                  {filler.word}
                </Text>
                <Text style={[styles.categoryLabel, { color: color.text }]}>
                  {getCategoryDescription(filler.category)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Improvement Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Tips to Reduce Filler Words</Text>
        <View style={styles.tipsContainer}>
          <TipBox icon="🧠" title="Pause Instead" description="Take a breath instead of using 'um' or 'uh'" />
          <TipBox icon="📋" title="Prepare Talking Points" description="Structure your thoughts before speaking" />
          <TipBox icon="🎯" title="Be Deliberate" description="Replace 'like' with direct statements" />
          <TipBox icon="🎙️" title="Practice Recording" description="Review your recordings to identify patterns" />
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

interface StatBoxProps {
  label: string;
  value: string;
  emoji: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, emoji }) => (
  <View style={styles.statBox}>
    <Text style={styles.statEmoji}>{emoji}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface FrequencyBarProps {
  word: string;
  count: number;
  maxCount: number;
}

const FrequencyBar: React.FC<FrequencyBarProps> = ({ word, count, maxCount }) => (
  <View style={styles.frequencyItem}>
    <View style={styles.frequencyLabel}>
      <Text style={styles.frequencyWord}>"{word}"</Text>
      <Text style={styles.frequencyCount}>{count}x</Text>
    </View>
    <View style={styles.frequencyBarContainer}>
      <View
        style={[
          styles.frequencyBarFill,
          {
            width: `${(count / maxCount) * 100}%`,
          },
        ]}
      />
    </View>
  </View>
);

interface TipBoxProps {
  icon: string;
  title: string;
  description: string;
}

const TipBox: React.FC<TipBoxProps> = ({ icon, title, description }) => (
  <View style={styles.tipBox}>
    <Text style={styles.tipIcon}>{icon}</Text>
    <View style={styles.tipContent}>
      <Text style={styles.tipTitle}>{title}</Text>
      <Text style={styles.tipDescription}>{description}</Text>
    </View>
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
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
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
  statsContainer: {
    flexDirection: 'row',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#a0aec0',
  },
  mostCommonBox: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  mostCommonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fed7aa',
    marginBottom: 8,
  },
  mostCommonCount: {
    fontSize: 13,
    color: '#cbd5e0',
  },
  frequencyContainer: {
    gap: 12,
  },
  frequencyItem: {
    gap: 8,
  },
  frequencyLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  frequencyWord: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e0',
  },
  frequencyCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f97316',
  },
  frequencyBarContainer: {
    height: 8,
    backgroundColor: '#4a5568',
    borderRadius: 4,
    overflow: 'hidden',
  },
  frequencyBarFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2d3748',
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#a78bfa',
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  highlightedTextContainer: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
    lineHeight: 24,
  },
  normalText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
  },
  fillerWordHighlight: {
    fontSize: 14,
    color: '#fed7aa',
    backgroundColor: '#7c2d12',
    fontWeight: '600',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  cleanedTextContainer: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80',
  },
  cleanedText: {
    fontSize: 14,
    color: '#4ade80',
    lineHeight: 22,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryBadge: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    marginBottom: 8,
    minWidth: '48%',
  },
  categoryBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.8,
  },
  tipsContainer: {
    gap: 12,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 12,
    color: '#cbd5e0',
    lineHeight: 16,
  },
  spacer: {
    height: 24,
  },
});

export default FillerWordView;
