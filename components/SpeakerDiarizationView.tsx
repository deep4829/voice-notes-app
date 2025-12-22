import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SpeakerSegment } from '@/types/note';

const getSpeakerColor = (speaker: number): string => {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  return colors[speaker % colors.length];
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface SpeakerDiarizationViewProps {
  speakers: SpeakerSegment[];
  speakerCount: number;
  isLoading?: boolean;
}

const SpeakerDiarizationView: React.FC<SpeakerDiarizationViewProps> = ({
  speakers,
  speakerCount,
  isLoading = false,
}) => {
  const [expandedSpeaker, setExpandedSpeaker] = useState<number | null>(null);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Processing speaker diarization...</Text>
      </View>
    );
  }

  if (!speakers || speakers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>🎤 No speaker data available</Text>
          <Text style={styles.emptySubtext}>Ensure audio has clear speakers</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Speaker Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Speaker Summary</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Speakers</Text>
            <Text style={styles.summaryValue}>{speakerCount}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Segments</Text>
            <Text style={styles.summaryValue}>{speakers.length}</Text>
          </View>
        </View>
      </View>

      {/* Transcript by Speaker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Transcript</Text>
        <View style={styles.transcriptContainer}>
          {speakers.map((segment, index) => (
            <View key={index} style={[styles.segment, { borderLeftColor: getSpeakerColor(segment.speaker) }]}>
              <View style={styles.segmentHeader}>
                <View style={[styles.speakerBadge, { backgroundColor: getSpeakerColor(segment.speaker) }]}>
                  <Text style={styles.speakerBadgeText}>
                    Speaker {segment.speaker}
                  </Text>
                </View>
                <View style={styles.confidenceContainer}>
                  <Text style={styles.timeStamp}>{formatTime(segment.startTime ?? 0)}</Text>
                  {segment.confidence !== undefined && (
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceFill,
                          { 
                            width: `${segment.confidence * 100}%`,
                            backgroundColor: getSpeakerColor(segment.speaker)
                          }
                        ]}
                      />
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.segmentText}>{segment.text.trim()}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a202c',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
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
  apiInputSection: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 60,
  },
  apiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  apiSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  apiInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#E2E8F0',
    fontSize: 14,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  apiNote: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
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
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#a0aec0',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  speakerLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speakerLabel: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  speakerLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transcriptContainer: {
    gap: 12,
  },
  segment: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 12,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  speakerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speakerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flex: 1,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  manualBadge: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  confidence: {
    fontSize: 11,
    color: '#94A3B8',
  },
  timeStamp: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  segmentText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  fullTranscriptBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  fullTranscriptText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  spacer: {
    height: 24,
  },
});

export default SpeakerDiarizationView;
