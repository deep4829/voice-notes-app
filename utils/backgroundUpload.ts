import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const BACKGROUND_UPLOAD_TASK = 'background-upload-task';
const UPLOAD_QUEUE_KEY = 'upload_queue';
const UPLOAD_PROGRESS_KEY = 'upload_progress';

/**
 * Generate a simple UUID v4 compatible ID (React Native compatible)
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
};

export interface UploadTask {
  id: string;
  noteId: string;
  audioUri: string;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

/**
 * Add a note's audio file to the background upload queue
 */
export const queueAudioForUpload = async (
  noteId: string,
  audioUri: string
): Promise<string> => {
  try {
    const uploadTask: UploadTask = {
      id: generateId(),
      noteId,
      audioUri,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
      status: 'pending',
    };

    const queue = await getUploadQueue();
    queue.push(uploadTask);
    await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));

    console.log(`[BG Upload] Queued audio for note ${noteId}: ${uploadTask.id}`);
    return uploadTask.id;
  } catch (error) {
    console.error('[BG Upload] Error queuing audio:', error);
    throw error;
  }
};

/**
 * Get the current upload queue
 */
export const getUploadQueue = async (): Promise<UploadTask[]> => {
  try {
    const queue = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('[BG Upload] Error reading queue:', error);
    return [];
  }
};

/**
 * Update upload task status
 */
export const updateUploadStatus = async (
  uploadId: string,
  status: UploadTask['status']
): Promise<void> => {
  try {
    const queue = await getUploadQueue();
    const task = queue.find(t => t.id === uploadId);
    if (task) {
      task.status = status;
      if (status === 'uploading') {
        task.retries += 1;
      }
      await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('[BG Upload] Error updating status:', error);
  }
};

/**
 * Confirm audio file is available locally and record metadata
 */
const uploadAudioFile = async (uploadTask: UploadTask): Promise<boolean> => {
  try {
    const { audioUri, noteId } = uploadTask;

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      console.error('[BG Upload] File not found:', audioUri);
      return false;
    }

    // Record local storage metadata
    await storeUploadProgress(noteId, {
      storedAt: audioUri,
      storedAtTimestamp: Date.now(),
      platform: 'local',
      size: fileInfo.size,
    });

    console.log('[BG Upload] Audio stored locally:', audioUri);

    return true;
  } catch (error) {
    // The audio is saved locally regardless
    console.warn('[BG Upload] Local storage warning:', error);
    return false;
  }
};

/**
 * Store upload progress/metadata
 */
const storeUploadProgress = async (
  noteId: string,
  metadata: Record<string, any>
): Promise<void> => {
  try {
    const progress = await AsyncStorage.getItem(UPLOAD_PROGRESS_KEY);
    const progressData = progress ? JSON.parse(progress) : {};
    progressData[noteId] = metadata;
    await AsyncStorage.setItem(UPLOAD_PROGRESS_KEY, JSON.stringify(progressData));
  } catch (error) {
    console.error('[BG Upload] Error storing progress:', error);
  }
};

/**
 * Remove completed task from queue
 */
const removeFromQueue = async (uploadId: string): Promise<void> => {
  try {
    const queue = await getUploadQueue();
    const filtered = queue.filter(t => t.id !== uploadId);
    await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[BG Upload] Error removing from queue:', error);
  }
};

/**
 * Process upload queue - this is called by background fetch
 */
export const processUploadQueue = async (): Promise<void> => {
  try {
    console.log('[BG Upload] Processing upload queue...');
    const queue = await getUploadQueue();

    if (queue.length === 0) {
      console.log('[BG Upload] Queue is empty');
      return;
    }

    for (const task of queue) {
      // Skip if already completed or max retries exceeded
      if (
        task.status === 'completed' ||
        task.retries >= task.maxRetries
      ) {
        if (task.retries >= task.maxRetries) {
          console.warn(
            `[BG Upload] Max retries exceeded for task ${task.id} - audio saved locally`
          );
          task.status = 'failed';
        }
        continue;
      }

      // Update status to uploading
      await updateUploadStatus(task.id, 'uploading');

      // Attempt upload
      const success = await uploadAudioFile(task);

      if (success) {
        await updateUploadStatus(task.id, 'completed');
        await removeFromQueue(task.id);
        console.log(`[BG Upload] Task ${task.id} completed`);
      } else {
        // Keep retrying - status already incremented
        console.log(
          `[BG Upload] Retry ${task.retries}/${task.maxRetries} for task ${task.id}`
        );
      }
    }

    console.log('[BG Upload] Queue processing finished');
  } catch (error) {
    console.error('[BG Upload] Error processing queue:', error);
  }
};

/**
 * Register background task for upload processing
 * Call this during app initialization
 */
export const registerBackgroundUploadTask = async (): Promise<void> => {
  try {
    // Define the background task
    TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
      try {
        console.log('[BG Upload] Background task triggered');
        await processUploadQueue();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('[BG Upload] Background task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Register background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
      minimumInterval: 60, // Check every minute minimum
      stopOnTerminate: false, // Continue after app termination
      startOnBoot: true, // Start on device boot
    });

    console.log('[BG Upload] Background upload task registered');
  } catch (error) {
    console.error('[BG Upload] Error registering background task:', error);
  }
};

/**
 * Get upload statistics
 */
export const getUploadStats = async (): Promise<{
  pending: number;
  uploading: number;
  completed: number;
  failed: number;
  total: number;
}> => {
  try {
    const queue = await getUploadQueue();
    return {
      pending: queue.filter(t => t.status === 'pending').length,
      uploading: queue.filter(t => t.status === 'uploading').length,
      completed: queue.filter(t => t.status === 'completed').length,
      failed: queue.filter(t => t.status === 'failed').length,
      total: queue.length,
    };
  } catch (error) {
    console.error('[BG Upload] Error getting stats:', error);
    return { pending: 0, uploading: 0, completed: 0, failed: 0, total: 0 };
  }
};

/**
 * Manually trigger upload processing (for testing/immediate upload)
 */
export const triggerImmediateUpload = async (): Promise<void> => {
  try {
    console.log('[BG Upload] Triggering immediate upload');
    await processUploadQueue();
  } catch (error) {
    console.error('[BG Upload] Error in immediate upload:', error);
  }
};

/**
 * Clear upload queue (for cleanup/testing)
 */
export const clearUploadQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(UPLOAD_QUEUE_KEY);
    console.log('[BG Upload] Queue cleared');
  } catch (error) {
    console.error('[BG Upload] Error clearing queue:', error);
  }
};
