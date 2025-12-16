import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Recording } from '@/types/note';
import { setupAudioSession, startBackgroundFetch } from '@/utils/backgroundRecording';

interface RecordingScreenProps {
  onSaveRecording: (recording: Omit<Recording, 'id'>) => void;
}

export default function RecordingScreen({ onSaveRecording }: RecordingScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [title, setTitle] = useState('');
  const [showTranscriptionInput, setShowTranscriptionInput] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingUriRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Setup audio session for background recording
      await setupAudioSession();

      // Create recording with background-enabled options
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);
      setTranscription('');
      setTitle('');
      setShowTranscriptionInput(false);

      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
      console.error(error);
    }
  };

  const stopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    try {
      await recordingRef.current?.stopAndUnloadAsync();
      
      // Register background tasks for processing the recording
      // This ensures upload/transcription continues even if app is backgrounded
      await startBackgroundFetch();

      const uri = recordingRef.current?.getURI();
      
      if (uri) {
        recordingUriRef.current = uri;
        setIsRecording(false);
        setShowTranscriptionInput(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
      console.error(error);
    }
  };

  const saveRecording = () => {
    if (!recordingUriRef.current) {
      Alert.alert('Error', 'No recording found');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for this recording');
      return;
    }

    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    onSaveRecording({
      uri: recordingUriRef.current,
      duration: duration,
      timestamp: Date.now(),
      title: title.trim(),
      transcription: transcription || 'No transcription provided',
      date,
      time,
    });

    // Reset state
    setDuration(0);
    setTranscription('');
    setTitle('');
    setShowTranscriptionInput(false);
    recordingUriRef.current = '';
    
    Alert.alert('Success', 'Recording saved successfully!');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Note</Text>
        <TouchableOpacity style={styles.moreButton}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.timerContainer}>
          <Text style={styles.readyLabel}>READY</Text>
          <View style={styles.timerDisplay}>
            <View style={styles.timeUnit}>
              <Text style={styles.timeValue}>
                {String(Math.floor(duration / 60)).padStart(2, '0')}
              </Text>
              <Text style={styles.timeLabel}>MINUTES</Text>
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeUnit}>
              <Text style={styles.timeValue}>
                {String(duration % 60).padStart(2, '0')}
              </Text>
              <Text style={styles.timeLabel}>SECONDS</Text>
            </View>
          </View>
        </View>

        <View style={styles.waveformContainer}>
          <WaveformAnimation isRecording={isRecording} />
        </View>

        <Text style={styles.instructionText}>
          {isRecording
            ? 'Recording in progress...'
            : showTranscriptionInput
            ? 'Add your transcription below'
            : 'Tap the microphone to start recording'}
        </Text>

        {showTranscriptionInput && (
          <View style={styles.transcriptionInputContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="Enter title for this recording..."
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              numberOfLines={1}
            />
            <TextInput
              style={styles.transcriptionInput}
              placeholder="Enter transcription..."
              placeholderTextColor="#666"
              value={transcription}
              onChangeText={setTranscription}
              multiline
              numberOfLines={4}
            />
            <View style={styles.saveButtonContainer}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveRecording}
              >
                <Text style={styles.saveButtonText}>Save Recording</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowTranscriptionInput(false);
                  setTranscription('');
                  setTitle('');
                  recordingUriRef.current = '';
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        {isRecording && (
          <TouchableOpacity style={styles.controlButton} disabled>
            <MaterialCommunityIcons name="pause" size={24} color="#666" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <MaterialCommunityIcons
            name={isRecording ? 'stop' : 'microphone'}
            size={32}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} disabled>
          <MaterialCommunityIcons name="folder" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function WaveformAnimation({ isRecording }: { isRecording: boolean }) {
  const [bars, setBars] = useState<number[]>(
    Array(30).fill(0.3)
  );

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map(() => Math.random() * 0.8 + 0.2)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <View style={styles.waveform}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: `${30 + height * 40}%`,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a3040',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  moreButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  readyLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeUnit: {
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  timeSeparator: {
    fontSize: 40,
    color: '#fff',
    marginHorizontal: 16,
  },
  waveformContainer: {
    height: 80,
    justifyContent: 'center',
    marginVertical: 30,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    gap: 4,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#0066ff',
    borderRadius: 1.5,
  },
  instructionText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginVertical: 20,
  },
  transcriptionInputContainer: {
    marginTop: 20,
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 16,
  },
  titleInput: {
    backgroundColor: '#0f1419',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a3040',
    fontWeight: '600',
  },
  transcriptionInput: {
    backgroundColor: '#0f1419',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a3040',
  },
  saveButtonContainer: {
    marginTop: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#2a3040',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a3040',
  },
  controlButton: {
    padding: 12,
    opacity: 0.5,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0066ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#ff3333',
  },
});
