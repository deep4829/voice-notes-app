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
import { Mic, Square, Play, Pause, Trash2, Star, X } from "lucide-react-native";
import { useNotes } from "@/contexts/NotesContext";
import { Note } from "@/types/note";
import { setupAudioSession, requestAudioPermissions, registerBackgroundRecordingTask } from "@/utils/backgroundRecording";
import { generateTags } from "@/utils/tagging";
import { generateWordCloud, hasEnoughContentForWordCloud } from "@/utils/wordCloud";
import { WordCloudView } from "@/components/WordCloudView";
import { queueAudioForUpload, registerBackgroundUploadTask } from "@/utils/backgroundUpload";
import { initializeNetworkMonitoring, useNetworkStatus } from "@/utils/networkResilience";
import { initializeCache, getCachedAudioPath } from "@/utils/cacheManager";
import { createSmartFolders, getNotesInFolder, getFolderBreadcrumb } from "@/utils/smartFolders";
import type { SmartFolder, FolderStructure } from "@/utils/smartFolders";
import { semanticSearch } from "@/utils/semanticSearch";
import { generateSummary } from "@/utils/summarization";
import { analyzeVocabulary } from "@/utils/vocabularyInsights";
import { VocabularyInsightsView } from "@/components/VocabularyInsightsView";
import { analyzeSentiment } from "@/utils/sentimentAnalysis";
import SentimentAnalysisView from "@/components/SentimentAnalysisView";
import { analyzeFillerWords } from "@/utils/fillerWordRemoval";
import FillerWordView from "@/components/FillerWordView";
import { transcribeAudio } from "@/utils/transcriptionService";

type AnalysisType = "wordCloud" | "sentiment" | "fillerWords";



export default function HomeScreen() {
  const { notes, addNote, deleteNote, updateNote, isLoading, isOfflineMode } = useNotes();
  const { isConnected, networkType } = useNetworkStatus();
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
  const [viewMode, setViewMode] = useState<'all' | 'folders' | 'insights'>('all');
  const [selectedFolder, setSelectedFolder] = useState<SmartFolder | null>(null);
  const [showSearchHint, setShowSearchHint] = useState(false);
  const [insightType, setInsightType] = useState<'vocabulary' | 'sentiment'>('vocabulary');
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [activeAnalysisNote, setActiveAnalysisNote] = useState<Note | null>(null);
  const [activeAnalysisType, setActiveAnalysisType] = useState<AnalysisType | null>(null);

  // Compute smart folders structure
  const folderStructure: FolderStructure = viewMode === 'folders' ? createSmartFolders(notes) : { folders: [], ungrouped: [], folderMap: {} };

  const openAnalysisModal = (note: Note, type: AnalysisType) => {
    setActiveAnalysisNote(note);
    setActiveAnalysisType(type);
    setAnalysisModalVisible(true);
  };

  const closeAnalysisModal = () => {
    setAnalysisModalVisible(false);
    setActiveAnalysisNote(null);
    setActiveAnalysisType(null);
  };

  const getAnalysisTitle = (type: AnalysisType | null) => {
    switch (type) {
      case "wordCloud":
        return "Word Cloud";
      case "sentiment":
        return "Sentiment Insights";
      case "fillerWords":
        return "Filler Word Breakdown";
      default:
        return "Note Analysis";
    }
  };

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

      // Initialize cache for offline access
      await initializeCache();

      // Register background task handlers
      registerBackgroundRecordingTask();
      
      // Register background upload task
      registerBackgroundUploadTask();
      
      // Initialize network monitoring for resilience
      await initializeNetworkMonitoring();

      console.log("Audio setup complete with background recording, local storage, network resilience, and caching enabled");
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
      // Use new transcription service with AssemblyAI/Deepgram support
      // Falls back to Rork if needed
      const result = await transcribeAudio(audioUri);
      return result;
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
      // Use formatted transcript if speaker diarization is available, otherwise use plain text
      const transcription = result.formattedTranscript || result.text || '';
      setPendingTranscription(transcription);
      setPendingLanguage(result.language || 'en');
      setTitleInput('');
      setShowTitleInput(true);
      setRecordingDuration(0);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save recording");
    }
  };

  const saveTitleAndNote = async () => {
    if (!titleInput.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }

    if (!pendingRecordingUri) {
      Alert.alert("Error", "No recording found");
      return;
    }

    // Generate automatic tags from transcription
    const tags = generateTags(pendingTranscription);
    
    // Generate summary from transcription
    const summaryInfo = generateSummary(pendingTranscription, 2);

    const noteId = Date.now().toString();
    const newNote: Note = {
      id: noteId,
      title: titleInput.trim(),
      transcription: pendingTranscription,
      audioUri: pendingRecordingUri,
      duration: pendingRecordingDuration,
      createdAt: Date.now(),
      language: pendingLanguage,
      tags: tags,
      summary: summaryInfo.summary,
    };

    addNote(newNote);
    
    // Queue audio for background upload (non-blocking)
    try {
      await queueAudioForUpload(noteId, pendingRecordingUri);
      console.log('[Save] Audio queued for background upload:', noteId);
    } catch (error) {
      // Upload errors are non-critical in development
      console.warn('[Save] Upload queueing warning:', error);
    }
    
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

      // Try to use cached audio if offline, otherwise use original URI
      let audioUri = note.audioUri;
      if (isOfflineMode) {
        const cachedPath = await getCachedAudioPath(note.id);
        if (cachedPath) {
          audioUri = cachedPath;
          console.log("[Playback] Using cached audio for offline playback");
        } else {
          Alert.alert("Audio Unavailable", "This audio file is not cached for offline playback");
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
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
      Alert.alert("Playback Error", "Could not play audio file");
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

    // Search filter - use semantic search for better results
    if (searchQuery.trim()) {
      const semanticResults = semanticSearch(notes, searchQuery, 0.3);
      const semanticNoteIds = new Set(semanticResults.map(r => r.note.id));
      
      // Combine semantic results with keyword matching
      filtered = notes.filter((note: Note) => {
        // Check semantic search
        if (semanticNoteIds.has(note.id)) return true;
        
        // Fallback to basic keyword matching
        const searchLower = searchQuery.toLowerCase();
        const matchesTitle = (note.title?.toLowerCase().includes(searchLower) || false);
        const matchesTranscription = note.transcription.toLowerCase().includes(searchLower);
        const matchesTags = note.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
        return matchesTitle || matchesTranscription || matchesTags;
      });
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
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Voice Notes</Text>
              <Text style={styles.headerSubtitle}>
                {notes.length} {notes.length === 1 ? "note" : "notes"}
              </Text>
            </View>
            <View style={[styles.networkStatus, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.networkStatusText}>
                {isConnected ? '●' : '●'}
              </Text>
            </View>
          </View>
        </View>

        {/* Offline Mode Banner */}
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>📴 Offline Mode - Changes saved locally</Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transcripts, dates, or semantic queries..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowSearchHint(true)}
            onBlur={() => setShowSearchHint(false)}
          />
          {searchQuery && (
            <View style={styles.semanticBadge}>
              <Text style={styles.semanticBadgeText}>🧠 Semantic</Text>
            </View>
          )}
        </View>

        {/* Search Hint */}
        {showSearchHint && (
          <Text style={styles.searchHint}>
            Try: "budget", "meeting with client", "pending tasks", or "important decisions"
          </Text>
        )}

        {/* Tab Filter */}
        <View style={styles.tabContainer}>
          {(['All', 'Recent', 'Favorites'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => {
                setSelectedTab(tab);
                setSelectedFolder(null);
              }}
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
          <TouchableOpacity
            style={[styles.tab, viewMode === 'folders' && styles.tabActive]}
            onPress={() => {
              setViewMode(viewMode === 'folders' ? 'all' : 'folders');
              setSelectedFolder(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                viewMode === 'folders' && styles.tabTextActive,
              ]}
            >
              📁 Folders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'insights' && styles.tabActive]}
            onPress={() => {
              setViewMode(viewMode === 'insights' ? 'all' : 'insights');
              setSelectedFolder(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                viewMode === 'insights' && styles.tabTextActive,
              ]}
            >
              📊 Insights
            </Text>
          </TouchableOpacity>
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
          ) : viewMode === 'insights' ? (
            // Insights view with toggle
            <>
              <View style={styles.insightToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.insightToggleButton,
                    insightType === 'vocabulary' && styles.insightToggleButtonActive,
                  ]}
                  onPress={() => setInsightType('vocabulary')}
                >
                  <Text
                    style={[
                      styles.insightToggleText,
                      insightType === 'vocabulary' && styles.insightToggleTextActive,
                    ]}
                  >
                    📚 Vocabulary
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.insightToggleButton,
                    insightType === 'sentiment' && styles.insightToggleButtonActive,
                  ]}
                  onPress={() => setInsightType('sentiment')}
                >
                  <Text
                    style={[
                      styles.insightToggleText,
                      insightType === 'sentiment' && styles.insightToggleTextActive,
                    ]}
                  >
                    😊 Sentiment
                  </Text>
                </TouchableOpacity>
              </View>
              {insightType === 'vocabulary' ? (
                <VocabularyInsightsView insights={analyzeVocabulary(notes)} />
              ) : (
                <SentimentAnalysisView notes={notes} />
              )}
            </>
          ) : viewMode === 'folders' ? (
            // Folder view
            selectedFolder ? (
              <>
                {/* Folder header with back button */}
                <TouchableOpacity
                  style={styles.folderBackButton}
                  onPress={() => setSelectedFolder(null)}
                >
                  <Text style={styles.folderBackText}>← Back to Folders</Text>
                </TouchableOpacity>
                
                <View style={[styles.folderHeader, { backgroundColor: selectedFolder.color + '20' }]}>
                  <Text style={styles.folderTitle}>{selectedFolder.name}</Text>
                  <Text style={styles.folderSubtitle}>
                    {selectedFolder.notesCount} {selectedFolder.notesCount === 1 ? 'note' : 'notes'}
                  </Text>
                </View>

                {getNotesInFolder(notes, selectedFolder).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No notes in this folder</Text>
                  </View>
                ) : (
                  getNotesInFolder(notes, selectedFolder).map((note: Note) => {
                    const wordCloudAvailable = hasEnoughContentForWordCloud(note.transcription);
                    const hasTranscription = note.transcription.trim().length > 0;

                    return (
                      <View key={note.id} style={styles.noteCard}>
                        <View style={styles.noteHeader}>
                          <View style={{ flex: 1 }}>
                            {note.title && (
                              <Text style={styles.noteTitle}>{note.title}</Text>
                            )}
                            <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                            {note.summary && (
                              <Text style={styles.noteSummary} numberOfLines={2}>
                                {note.summary}
                              </Text>
                            )}
                          </View>
                          <View style={styles.noteActions}>
                            <TouchableOpacity
                              onPress={() => {
                                const isFavorite = (note as any).isFavorite;
                                updateNote(note.id, { isFavorite: !isFavorite } as any);
                              }}
                            >
                              <Star
                                size={20}
                                color={(note as any).isFavorite ? '#0EA5E9' : '#64748B'}
                                fill={(note as any).isFavorite ? '#0EA5E9' : 'none'}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteNote(note.id)}>
                              <Trash2 size={20} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        
                        {/* Render rest of note content similar to filteredNotes */}
                        <Text
                          style={styles.noteTranscription}
                          numberOfLines={expandedNoteId === note.id ? undefined : 3}
                        >
                          {note.transcription}
                        </Text>

                        {note.transcription.split('\n').length > 3 && expandedNoteId !== note.id && (
                          <TouchableOpacity onPress={() => setExpandedNoteId(note.id)}>
                            <Text style={styles.seeMoreText}>See More</Text>
                          </TouchableOpacity>
                        )}

                        {expandedNoteId === note.id && note.transcription.split('\n').length > 3 && (
                          <TouchableOpacity onPress={() => setExpandedNoteId(null)}>
                            <Text style={styles.seeLessText}>See Less</Text>
                          </TouchableOpacity>
                        )}

                        {hasTranscription && (
                          <View style={styles.analysisButtonRow}>
                            <TouchableOpacity
                              style={[styles.analysisButton, !wordCloudAvailable && styles.analysisButtonDisabled]}
                              onPress={() => openAnalysisModal(note, "wordCloud")}
                              disabled={!wordCloudAvailable}
                            >
                              <Text
                                style={[
                                  styles.analysisButtonText,
                                  !wordCloudAvailable && styles.analysisButtonTextDisabled,
                                ]}
                              >
                                ☁️ Word Cloud
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.analysisButton}
                              onPress={() => openAnalysisModal(note, "sentiment")}
                            >
                              <Text style={styles.analysisButtonText}>😊 Sentiment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.analysisButton}
                              onPress={() => openAnalysisModal(note, "fillerWords")}
                            >
                              <Text style={styles.analysisButtonText}>🎙️ Filler Words</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {note.tags && note.tags.length > 0 && (
                          <View style={styles.tagsContainer}>
                            {note.tags.map((tag, index) => (
                              <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>#{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={styles.noteFooter}>
                          <Text style={styles.noteDuration}>{formatDuration(note.duration)}</Text>
                          <Text style={styles.noteLanguage}>{note.language}</Text>
                        </View>

                        {/* Playback controls */}
                        <View style={styles.playbackContainer}>
                          {playingNoteId === note.id ? (
                            <TouchableOpacity onPress={pauseAudio} style={styles.playButton}>
                              <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity onPress={() => playAudio(note)} style={styles.playButton}>
                              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              // Folder list view
              folderStructure.folders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Mic size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No folders yet</Text>
                  <Text style={styles.emptySubtext}>Notes with tags will appear here</Text>
                </View>
              ) : (
                <>
                  {folderStructure.folders.map((folder) => (
                    <TouchableOpacity
                      key={folder.id}
                      style={[styles.folderCard, { borderLeftColor: folder.color, borderLeftWidth: 4 }]}
                      onPress={() => setSelectedFolder(folder)}
                    >
                      <View style={styles.folderCardContent}>
                        <View>
                          <Text style={styles.folderCardName}>{folder.name}</Text>
                          <Text style={styles.folderCardDescription}>{folder.description}</Text>
                        </View>
                        <View style={styles.folderCardBadge}>
                          <Text style={styles.folderCardBadgeText}>{folder.notesCount}</Text>
                        </View>
                      </View>
                      {folder.subFolders && folder.subFolders.length > 0 && (
                        <Text style={styles.folderCardSubtext}>
                          {folder.subFolders.length} subfolder{folder.subFolders.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {folderStructure.ungrouped.length > 0 && (
                    <View style={styles.folderCard}>
                      <Text style={styles.folderCardName}>📌 Ungrouped</Text>
                      <Text style={styles.folderCardDescription}>
                        {folderStructure.ungrouped.length} note{folderStructure.ungrouped.length !== 1 ? 's' : ''} without tags
                      </Text>
                    </View>
                  )}
                </>
              )
            )
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
            filteredNotes.map((note: Note) => {
              const wordCloudAvailable = hasEnoughContentForWordCloud(note.transcription);
              const hasTranscription = note.transcription.trim().length > 0;

              return (
                <View key={note.id} style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <View style={{ flex: 1 }}>
                      {note.title && (
                        <Text style={styles.noteTitle}>{note.title}</Text>
                      )}
                      <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                      {note.summary && (
                        <Text style={styles.noteSummary} numberOfLines={2}>
                          {note.summary}
                        </Text>
                      )}
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
                  {hasTranscription && (
                    <View style={styles.analysisButtonRow}>
                      <TouchableOpacity
                        style={[styles.analysisButton, !wordCloudAvailable && styles.analysisButtonDisabled]}
                        onPress={() => openAnalysisModal(note, "wordCloud")}
                        disabled={!wordCloudAvailable}
                      >
                        <Text
                          style={[
                            styles.analysisButtonText,
                            !wordCloudAvailable && styles.analysisButtonTextDisabled,
                          ]}
                        >
                          ☁️ Word Cloud
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.analysisButton}
                        onPress={() => openAnalysisModal(note, "sentiment")}
                      >
                        <Text style={styles.analysisButtonText}>😊 Sentiment</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.analysisButton}
                        onPress={() => openAnalysisModal(note, "fillerWords")}
                      >
                        <Text style={styles.analysisButtonText}>🎙️ Filler Words</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {note.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.noteFooter}>
                    <Text style={styles.noteDuration}>
                      {formatDuration(note.duration)}
                    </Text>
                    <Text style={styles.noteLanguage}>{note.language}</Text>
                  </View>
                </View>
              );
            })
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

        <Modal
          visible={analysisModalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeAnalysisModal}
        >
          <View style={styles.analysisModalOverlay}>
            <View style={styles.analysisModalContent}>
              <View style={styles.analysisModalHeader}>
                <View style={styles.analysisModalHeading}>
                  <Text style={styles.analysisModalTitle}>{getAnalysisTitle(activeAnalysisType)}</Text>
                  {activeAnalysisNote && (
                    <Text style={styles.analysisModalSubtitle}>
                      {activeAnalysisNote.title || `Recorded ${formatDate(activeAnalysisNote.createdAt)}`}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={closeAnalysisModal} style={styles.analysisModalClose}>
                  <X size={20} color="#E2E8F0" />
                </TouchableOpacity>
              </View>

              <View style={styles.analysisModalBody}>
                {activeAnalysisNote && activeAnalysisType === "wordCloud" && (
                  <WordCloudView wordCloudData={generateWordCloud(activeAnalysisNote.transcription, 40)} />
                )}

                {activeAnalysisNote && activeAnalysisType === "sentiment" && (
                  <SentimentAnalysisView
                    analysis={analyzeSentiment(activeAnalysisNote.transcription)}
                    notes={[activeAnalysisNote]}
                  />
                )}

                {activeAnalysisNote && activeAnalysisType === "fillerWords" && (
                  <FillerWordView analysis={analyzeFillerWords(activeAnalysisNote.transcription)} />
                )}
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  networkStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  networkStatusText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  offlineBanner: {
    backgroundColor: "#F97316",
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: "center",
  },
  offlineBannerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
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
    marginBottom: 6,
  },
  noteSummary: {
    fontSize: 13,
    color: "#CBD5E1",
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 6,
  },
  noteActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  noteTranscription: {
    fontSize: 14,
    color: "#CBD5E1",
    lineHeight: 20,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 16,
    color: "#E2E8F0",
    lineHeight: 24,
    marginBottom: 12,
  },
  analysisButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  analysisButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
  },
  analysisButtonDisabled: {
    backgroundColor: "#111827",
    borderColor: "#1E293B",
  },
  analysisButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  analysisButtonTextDisabled: {
    color: "#475569",
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
  semanticBadge: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  semanticBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  searchHint: {
    fontSize: 12,
    color: "#64748B",
    paddingHorizontal: 24,
    paddingBottom: 8,
    fontStyle: "italic",
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
  analysisModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    padding: 16,
    justifyContent: "center",
  },
  analysisModalContent: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 20,
    width: "100%",
    maxWidth: 720,
    maxHeight: "90%",
    alignSelf: "center",
    flex: 1,
  },
  analysisModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  analysisModalHeading: {
    flex: 1,
  },
  analysisModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  analysisModalSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
  },
  analysisModalClose: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
  },
  analysisModalBody: {
    flex: 1,
    marginTop: 12,
    paddingBottom: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    marginTop: 12,
  },
  tag: {
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  folderBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 16,
  },
  folderBackText: {
    color: "#0EA5E9",
    fontSize: 14,
    fontWeight: "600",
  },
  folderHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  folderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  folderSubtitle: {
    fontSize: 14,
    color: "#94A3B8",
  },
  folderCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  folderCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  folderCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  folderCardDescription: {
    fontSize: 13,
    color: "#94A3B8",
  },
  folderCardSubtext: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
  },
  folderCardBadge: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  folderCardBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  playbackContainer: {
    marginTop: 12,
    alignItems: "flex-start",
  },
  playButton: {
    backgroundColor: "#0EA5E9",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  insightToggleContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0F172A",
    marginBottom: 12,
  },
  insightToggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  insightToggleButtonActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0284C7",
  },
  insightToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  insightToggleTextActive: {
    color: "#FFFFFF",
  },
});
