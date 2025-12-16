import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Recording } from '@/types/note';

interface TranscriptionListScreenProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
  onUpdateTranscription: (id: string, transcription: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateFavorite: (id: string, isFavorite: boolean) => void;
}

export default function TranscriptionListScreen({
  recordings,
  onDelete,
  onUpdateTranscription,
  onUpdateTitle,
  onUpdateFavorite,
}: TranscriptionListScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'All' | 'Recent' | 'Favorites' | 'Shared'>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [editMode, setEditMode] = useState<'transcription' | 'title'>('transcription');
  const [showModal, setShowModal] = useState(false);

  const filteredRecordings = recordings.filter((rec) => {
    // Search filter - search by title, transcription, date, and time
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      rec.title.toLowerCase().includes(searchLower) ||
      rec.transcription.toLowerCase().includes(searchLower) ||
      rec.date?.toLowerCase().includes(searchLower) ||
      rec.time?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Tab filter
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const recordDate = new Date(rec.timestamp);
    const isRecent = now - rec.timestamp < oneDayMs;

    switch (selectedTab) {
      case 'Recent':
        return isRecent;
      case 'Favorites':
        return rec.isFavorite === true;
      case 'Shared':
        // Placeholder for shared recordings (can be implemented based on your needs)
        return false;
      case 'All':
      default:
        return true;
    }
  });

  const handleEdit = (recording: Recording) => {
    setEditingId(recording.id);
    setEditingText(recording.transcription);
    setEditingTitle(recording.title);
    setEditMode('transcription');
    setShowModal(true);
  };

  const handleEditTitle = (recording: Recording) => {
    setEditingId(recording.id);
    setEditingTitle(recording.title);
    setEditingText(recording.transcription);
    setEditMode('title');
    setShowModal(true);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      if (editMode === 'title') {
        if (!editingTitle.trim()) {
          Alert.alert('Error', 'Title cannot be empty');
          return;
        }
        onUpdateTitle(editingId, editingTitle.trim());
        Alert.alert('Success', 'Title updated');
      } else {
        onUpdateTranscription(editingId, editingText);
        Alert.alert('Success', 'Transcription updated');
      }
      setShowModal(false);
      setEditingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Recording', 'Are you sure you want to delete this recording?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: () => onDelete(id),
        style: 'destructive',
      },
    ]);
  };

  const renderRecordingItem = ({ item }: { item: Recording }) => (
    <View style={styles.recordingCard}>
      <TouchableOpacity 
        style={styles.recordingContent}
        onPress={() => handleEdit(item)}
      >
        <View style={styles.recordingIcon}>
          <MaterialCommunityIcons name="waveform" size={20} color="#0066ff" />
        </View>
        <View style={styles.recordingInfo}>
          <Text style={styles.recordingTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.recordingTime}>
            {item.time} • {Math.floor(item.duration / 60)}m {item.duration % 60}s
          </Text>
          <Text style={styles.recordingPreview} numberOfLines={2}>
            {item.transcription}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => onUpdateFavorite(item.id, !item.isFavorite)}
        >
          <MaterialCommunityIcons 
            name={item.isFavorite ? "star" : "star-outline"} 
            size={16} 
            color={item.isFavorite ? "#ffd700" : "#666"} 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editTitleButton}
          onPress={() => handleEditTitle(item)}
        >
          <MaterialCommunityIcons name="pencil" size={16} color="#0066ff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <MaterialCommunityIcons name="delete" size={16} color="#ff3333" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userGreeting}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
            <View>
              <Text style={styles.greeting}>Good Morning,</Text>
              <Text style={styles.userName}>Alex Johnson</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.settingsButton}>
            <MaterialCommunityIcons name="cog" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transcripts, dates..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Recordings</Text>
      </View>

      <View style={styles.tabContainer}>
        {(['All', 'Recent', 'Favorites', 'Shared'] as const).map((tab) => (
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

      <FlatList
        data={filteredRecordings}
        renderItem={renderRecordingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="microphone-off"
              size={48}
              color="#666"
            />
            <Text style={styles.emptyText}>No recordings yet</Text>
            <Text style={styles.emptySubtext}>Start recording to see your notes here</Text>
          </View>
        }
      />

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode === 'title' ? 'Edit Title' : 'Edit Transcription'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {editMode === 'title' ? (
              <TextInput
                style={styles.modalInput}
                value={editingTitle}
                onChangeText={setEditingTitle}
                numberOfLines={1}
                placeholder="Enter new title..."
                placeholderTextColor="#666"
              />
            ) : (
              <TextInput
                style={styles.modalInput}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                numberOfLines={6}
                placeholder="Edit your transcription..."
                placeholderTextColor="#666"
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  header: {
    backgroundColor: '#1a1f2e',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  greeting: {
    color: '#888',
    fontSize: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1419',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#0066ff',
  },
  tabText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recordingCard: {
    backgroundColor: '#1a1f2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 8,
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#0a0e17',
  },
  editTitleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#0a0e17',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#0a0e17',
  },
  recordingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0a0e17',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordingTime: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  recordingPreview: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1f2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: '#0f1419',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2a3040',
    marginBottom: 16,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalButtons: {
    gap: 8,
  },
  modalButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#2a3040',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextCancel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
});
