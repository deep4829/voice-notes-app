import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useMutation } from "@tanstack/react-query";
import { Mic, Square, Play, Pause, Trash2, Star } from "lucide-react-native";
import { useNotes } from "@/contexts/NotesContext";
import { Note } from "@/types/note";
import { setupAudioSession, requestAudioPermissions, registerBackgroundRecordingTask } from "@/utils/backgroundRecording";



export default function HomeScreen() {
  const { notes, addNote, deleteNote, updateNote, isLoading } = useNotes();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'All' | 'Recent' | 'Favorites'>('All');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [pendingRecordingUri, setPendingRecordingUri] = useState<string | null>(null);
  const [pendingRecordingDuration, setPendingRecordingDuration] = useState(0);
  const [pendingTranscription, setPendingTranscription] = useState('');
  const [pendingLanguage, setPendingLanguage] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnimations = useRef(
    Array.from({ length: 40 }, () => new Animated.Value(0.3))
  ).current;

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const startWaveAnimations = useCallback(() => {
    waveAnimations.forEach((anim) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 0.7 + 0.3,
            duration: 300 + Math.random() * 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300 + Math.random() * 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [waveAnimations]);

  useEffect(() => {
    setupAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (isRecording) {
      startPulseAnimation();
      startWaveAnimations();
      const interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      pulseAnim.setValue(1);
      waveAnimations.forEach((anim) => anim.setValue(0.3));
    }
  }, [isRecording, startPulseAnimation, startWaveAnimations, pulseAnim, waveAnimations]);

  const setupAudio = async () => {
    try {
      // Request audio permissions
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Microphone permission is required to record audio");
        return;
      }

      // Setup audio session for background recording capability
      await setupAudioSession();

      // Register background task handlers
      registerBackgroundRecordingTask();

      console.log("Audio setup complete with background recording enabled");
    } catch (error) {
      console.error("Failed to setup audio:", error);
    }
  };



  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".wav",
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const transcribeMutation = useMutation({
    mutationFn: async (audioUri: string) => {
      const formData = new FormData();

      if (Platform.OS === "web") {
        const response = await fetch(audioUri);
        const blob = await response.blob();
        formData.append("audio", blob, "recording.webm");
      } else {
        const uriParts = audioUri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        const audioFile = {
          uri: audioUri,
          name: "recording." + fileType,
          type: "audio/" + fileType,
        } as any;
        formData.append("audio", audioFile);
      }

      const response = await fetch(
        "https://toolkit.rork.com/stt/transcribe/",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      return await response.json();
    },
  });

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        console.error("No recording URI");
        return;
      }

      const duration = recordingDuration;
      setRecording(null);

      const result = await transcribeMutation.mutateAsync(uri);

      // Store pending data and show title input
      setPendingRecordingUri(uri);
      setPendingRecordingDuration(duration);
      setPendingTranscription(result.text);
      setPendingLanguage(result.language);
      setTitleInput('');
      setShowTitleInput(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save recording");
    }
  };

  const saveTitleAndNote = () => {
    if (!titleInput.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    if (!pendingRecordingUri) {
      Alert.alert("Error", "No recording found");
      return;
    }

    const newNote: Note = {
      id: Date.now().toString(),
      title: titleInput.trim(),
      transcription: pendingTranscription,
      audioUri: pendingRecordingUri,
      duration: pendingRecordingDuration,
      createdAt: Date.now(),
      language: pendingLanguage,
    };

    addNote(newNote);
    setShowTitleInput(false);
    setTitleInput('');
    setPendingRecordingUri(null);
    setPendingRecordingDuration(0);
    setPendingTranscription('');
    setPendingLanguage('');
  };

  const playAudio = async (note: Note) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: note.audioUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingNoteId(note.id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingNoteId(null);
        }
      });
    } catch (error) {
      console.error("Failed to play audio:", error);
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setPlayingNoteId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const getFilteredNotes = () => {
    let filtered = notes;

    // Search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((note: Note) =>
        (note.title?.toLowerCase().includes(searchLower) || false) ||
        note.transcription.toLowerCase().includes(searchLower)
      );
    }

    // Tab filter
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    switch (selectedTab) {
      case 'Recent':
        filtered = filtered.filter((note: Note) => now - note.createdAt < oneDayMs);
        break;
      case 'Favorites':
        filtered = filtered.filter((note: Note) => (note as any).isFavorite === true);
        break;
      case 'All':
      default:
        break;
    }

    return filtered;
  };

  const filteredNotes = getFilteredNotes();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Notes</Text>
          <Text style={styles.headerSubtitle}>
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transcripts, dates..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tab Filter */}
        <View style={styles.tabContainer}>
          {(['All', 'Recent', 'Favorites'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : filteredNotes.length === 0 ? (
            <View style={styles.emptyState}>
              <Mic size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {notes.length === 0 ? "No voice notes yet" : "No results found"}
              </Text>
              <Text style={styles.emptySubtext}>
                {notes.length === 0 ? "Tap the microphone to record" : "Try adjusting your search"}
              </Text>
            </View>
          ) : (
            filteredNotes.map((note: Note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View>
                    {note.title && (
                      <Text style={styles.noteTitle}>{note.title}</Text>
                    )}
                    <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                  </View>
                  <View style={styles.noteActions}>
                    <TouchableOpacity
                      onPress={() =>
                        updateNote(note.id, {
                          ...(note as any),
                          isFavorite: !(note as any).isFavorite,
                        })
                      }
                      style={styles.iconButton}
                    >
                      <Star 
                        size={20} 
                        color="#0EA5E9"
                        fill={(note as any).isFavorite ? "#0EA5E9" : "none"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        playingNoteId === note.id
                          ? pauseAudio()
                          : playAudio(note)
                      }
                      style={styles.iconButton}
                    >
                      {playingNoteId === note.id ? (
                        <Pause size={20} color="#0EA5E9" />
                      ) : (
                        <Play size={20} color="#0EA5E9" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteNote(note.id)}
                      style={styles.iconButton}
                    >
                      <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.noteText} numberOfLines={expandedNoteId === note.id ? 0 : 2}>
                  {note.transcription}
                </Text>
                {expandedNoteId !== note.id && note.transcription.length > 100 && (
                  <TouchableOpacity onPress={() => setExpandedNoteId(note.id)}>
                    <Text style={styles.seeMoreText}>See More</Text>
                  </TouchableOpacity>
                )}
                {expandedNoteId === note.id && note.transcription.length > 100 && (
                  <TouchableOpacity onPress={() => setExpandedNoteId(null)}>
                    <Text style={styles.seeLessText}>See Less</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.noteFooter}>
                  <Text style={styles.noteDuration}>
                    {formatDuration(note.duration)}
                  </Text>
                  <Text style={styles.noteLanguage}>{note.language}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Title Input Modal */}
        <Modal
          visible={showTitleInput}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Title to Recording</Text>
              <TextInput
                style={styles.titleModalInput}
                placeholder="Enter a title..."
                placeholderTextColor="#64748B"
                value={titleInput}
                onChangeText={setTitleInput}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={saveTitleAndNote}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowTitleInput(false);
                    setPendingRecordingUri(null);
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.recordingSection}>
          {isRecording && (
            <View style={styles.waveformContainer}>
              {waveAnimations.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveBar,
                    {
                      transform: [{ scaleY: anim }],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {isRecording && (
            <Text style={styles.recordingTime}>
              {formatDuration(recordingDuration)}
            </Text>
          )}

          <TouchableOpacity
            style={styles.recordButton}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.8}
            disabled={transcribeMutation.isPending}
          >
            <Animated.View
              style={[
                styles.recordButtonInner,
                isRecording && {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {isRecording ? (
                <Square size={32} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Mic size={32} color="#FFFFFF" />
              )}
            </Animated.View>
          </TouchableOpacity>

          {transcribeMutation.isPending && (
            <Text style={styles.transcribingText}>Transcribing...</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#94A3B8",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 200,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#475569",
    marginTop: 8,
  },
  noteCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  noteDate: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  noteActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  noteText: {
    fontSize: 16,
    color: "#E2E8F0",
    lineHeight: 24,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteDuration: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  noteLanguage: {
    fontSize: 12,
    color: "#64748B",
    textTransform: "uppercase",
  },
  recordingSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 40,
    paddingTop: 24,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 3,
    marginBottom: 16,
  },
  waveBar: {
    width: 3,
    height: 40,
    backgroundColor: "#0EA5E9",
    borderRadius: 2,
  },
  recordingTime: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0EA5E9",
    marginBottom: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  recordButtonInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  transcribingText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#E2E8F0",
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tabActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  tabText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 4,
  },
  seeMoreText: {
    color: "#0EA5E9",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  seeLessText: {
    color: "#0EA5E9",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 16,
  },
  titleModalInput: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#E2E8F0",
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    gap: 8,
  },
  modalButton: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#334155",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalButtonTextCancel: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
