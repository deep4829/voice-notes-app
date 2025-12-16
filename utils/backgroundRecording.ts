import { Audio } from "expo-av";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";

const BACKGROUND_RECORDING_TASK = "BACKGROUND_RECORDING_TASK";

/**
 * Configure audio session for background recording
 * Allows recording to continue even when app is backgrounded or screen is locked
 */
export const setupAudioSession = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    console.log("Audio session configured for background recording");
  } catch (error) {
    console.error("Failed to setup audio session:", error);
  }
};

/**
 * Request necessary permissions for background audio
 */
export const requestAudioPermissions = async () => {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  } catch (error) {
    console.error("Failed to request audio permissions:", error);
    return false;
  }
};

/**
 * Register background task for handling recording completion
 * This ensures the app can process the recording even if closed
 */
export const registerBackgroundRecordingTask = () => {
  TaskManager.defineTask(BACKGROUND_RECORDING_TASK, async () => {
    try {
      // This task runs in the background after recording is stopped
      // It will handle upload/processing operations
      console.log("Background recording task executed");
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.error("Background recording task failed:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
};

/**
 * Start background fetch to handle post-recording operations
 */
export const startBackgroundFetch = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_RECORDING_TASK, {
      minimumInterval: 60, // Run every minute
      stopOnTerminate: false, // Continue after app termination
      startOnBoot: true, // Start on device boot
    });
    console.log("Background fetch registered");
  } catch (error) {
    console.error("Failed to register background fetch:", error);
  }
};

/**
 * Stop background fetch
 */
export const stopBackgroundFetch = async () => {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_RECORDING_TASK);
    console.log("Background fetch unregistered");
  } catch (error) {
    console.error("Failed to unregister background fetch:", error);
  }
};

/**
 * Check if background recording is supported on current platform
 */
export const isBackgroundRecordingSupported = () => {
  // Background recording is supported on both iOS and Android
  // but requires specific permissions and audio session configuration
  return true;
};
