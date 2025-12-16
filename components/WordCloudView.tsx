import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { WordCloudData, WordCloudItem } from '@/utils/wordCloud';

interface WordCloudViewProps {
  wordCloudData: WordCloudData;
  maxHeight?: number;
}

/**
 * Word Cloud Visualization Component
 * Displays words with sizes proportional to their frequency
 */
export const WordCloudView: React.FC<WordCloudViewProps> = ({
  wordCloudData,
  maxHeight = 200,
}) => {
  if (!wordCloudData.words || wordCloudData.words.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Insufficient text for word cloud</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { maxHeight }]}>
      <Text style={styles.title}>Word Cloud</Text>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.wordContainer}
        scrollEnabled={wordCloudData.words.length > 15}
      >
        {wordCloudData.words.map((item, index) => (
          <WordBubble key={index} item={item} />
        ))}
      </ScrollView>
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          📊 {wordCloudData.uniqueWords} unique words • {wordCloudData.totalWords} total
        </Text>
      </View>
    </View>
  );
};

/**
 * Individual word bubble component
 */
const WordBubble: React.FC<{ item: WordCloudItem }> = ({ item }) => {
  const baseSize = 12;
  const fontSize = baseSize + (item.size - 1) * 3; // Scale 1-5 to font sizes 12-24
  const padding = 6 + (item.size - 1) * 2;

  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: item.color + '20', // 20% opacity
          borderColor: item.color,
          paddingHorizontal: padding,
          paddingVertical: padding / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.bubbleText,
          {
            fontSize,
            color: item.color,
            fontWeight: item.size > 3 ? '600' : '400',
          },
        ]}
      >
        {item.word}
      </Text>
      <Text style={[styles.bubbleFrequency, { color: item.color }]}>
        {item.frequency}
      </Text>
    </View>
  );
};

/**
 * Compact word cloud for previews
 */
interface CompactWordCloudProps {
  wordCloudData: WordCloudData;
  maxWords?: number;
}

export const CompactWordCloud: React.FC<CompactWordCloudProps> = ({
  wordCloudData,
  maxWords = 8,
}) => {
  const topWords = wordCloudData.words.slice(0, maxWords);

  if (topWords.length === 0) {
    return null;
  }

  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactWords}>
        {topWords.map((item, index) => (
          <Text
            key={index}
            style={[
              styles.compactWord,
              {
                fontSize: 12 + (item.size - 1) * 2,
                color: item.color,
                fontWeight: item.size > 3 ? '600' : '400',
              },
            ]}
          >
            {item.word}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  scrollView: {
    flexGrow: 0,
    minHeight: 100,
  },
  wordContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 8,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  bubbleText: {
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  bubbleFrequency: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.7,
  },
  statsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statsText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  compactContainer: {
    marginVertical: 6,
  },
  compactWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  compactWord: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
});
