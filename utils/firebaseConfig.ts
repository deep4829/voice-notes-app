import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getBytes } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * Firebase configuration for cloud storage
 * Using a free tier Firebase project for VerbalNote
 * 
 * Note: This config is exposed (public keys are meant to be public)
 * Security is managed via Firebase Security Rules
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDkL_1q8V2nH3pX5mZ9kL2mN4oP6qR7sT8u',
  authDomain: 'verbalnote-app.firebaseapp.com',
  projectId: 'verbalnote-app',
  storageBucket: 'verbalnote-app.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef1234567890',
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

    // Initialize Firebase
    firebaseApp = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized');

    // Authenticate anonymously
    const auth = getAuth(firebaseApp);
    const result = await signInAnonymously(auth);
    isAuthenticated = true;
    console.log('[Firebase] Anonymous authentication successful');
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
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
