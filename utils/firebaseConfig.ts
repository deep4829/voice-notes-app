import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getBytes } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * Firebase configuration for cloud storage
 * Using a free tier Firebase project for VerbalNote
 * 
 * Note: This config is exposed (public keys are meant to be public)
 * Security is managed via Firebase Security Rules
 * 
 * To set up Firebase:
 * 1. Go to https://console.firebase.google.com
 * 2. Create a new project (free tier)
 * 3. Create a web app in the project
 * 4. Copy the config and add to .env file
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

let firebaseApp: any = null;
let isAuthenticated = false;

/**
 * Initialize Firebase and authenticate anonymously
 */
export const initializeFirebase = async (): Promise<void> => {
  try {
    if (firebaseApp) {
      console.log('[Firebase] Already initialized');
      return;
    }

    // Check if Firebase config is provided
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('[Firebase] Configuration not provided - set env vars for cloud storage. See .env.example');
      return;
    }

    // Initialize Firebase
    firebaseApp = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized');

    // Authenticate anonymously
    const auth = getAuth(firebaseApp);
    const result = await signInAnonymously(auth);
    isAuthenticated = true;
    console.log('[Firebase] Anonymous authentication successful');
  } catch (error) {
    console.warn('[Firebase] Initialization warning (local cache still works):', error);
    // Firebase initialization failure is non-critical - local cache still works
  }
};

/**
 * Upload audio file to Firebase Cloud Storage
 */
export const uploadAudioToCloud = async (
  audioUri: string,
  noteId: string,
  fileName: string
): Promise<string> => {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase not initialized');
    }

    if (!isAuthenticated) {
      throw new Error('Not authenticated with Firebase');
    }

    // Read file from local storage
    const FileSystem = await import('expo-file-system/legacy');
    const base64Data = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Blob for upload
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/m4a' });

    // Upload to Firebase Storage
    const storage = getStorage(firebaseApp);
    const fileRef = ref(storage, `audio/${noteId}/${fileName}`);
    
    await uploadBytes(fileRef, blob);
    console.log('[Firebase] Upload successful:', noteId);

    // Return the storage path for future reference
    return `audio/${noteId}/${fileName}`;
  } catch (error) {
    console.warn('[Firebase] Upload warning (local cache intact):', error);
    return null as any;
  }
};

/**
 * Download audio file from Firebase Cloud Storage
 */
export const downloadAudioFromCloud = async (
  storagePath: string
): Promise<any | null> => {
  try {
    if (!firebaseApp || !isAuthenticated) {
      throw new Error('Firebase not initialized or not authenticated');
    }

    const storage = getStorage(firebaseApp);
    const fileRef = ref(storage, storagePath);

    const data = await getBytes(fileRef);
    console.log('[Firebase] Download successful:', storagePath);
    return data;
  } catch (error) {
    console.warn('[Firebase] Download warning:', error);
    return null;
  }
};

/**
 * Get Firebase instance (for advanced usage)
 */
export const getFirebaseApp = () => firebaseApp;

/**
 * Check if Firebase is ready
 */
export const isFirebaseReady = (): boolean => {
  return firebaseApp !== null && isAuthenticated;
};
