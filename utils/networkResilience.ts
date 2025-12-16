import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUploadQueue, updateUploadStatus } from './backgroundUpload';

const NETWORK_STATUS_KEY = 'network_status';
const CONNECTIVITY_CHECK_TIMEOUT = 10000; // 10 seconds

export type NetworkState = 'online' | 'offline' | 'slow';

export interface NetworkStatus {
  isConnected: boolean;
  type: NetworkState;
  lastCheckedAt: number;
}

/**
 * Simple connectivity check using fetch
 */
export const checkConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT);

    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 204 || response.status === 304;
  } catch (error) {
    console.log('[Network] Connectivity check failed:', error);
    return false;
  }
};

/**
 * Get network status using native APIs
 */
export const getNetworkStatus = async (): Promise<NetworkStatus> => {
  try {
    // For React Native, we can use a simple connectivity check
    const isConnected = await checkConnectivity();

    const status: NetworkStatus = {
      isConnected,
      type: isConnected ? 'online' : 'offline',
      lastCheckedAt: Date.now(),
    };

    return status;
  } catch (error) {
    console.error('[Network] Error getting network status:', error);
    return {
      isConnected: false,
      type: 'offline',
      lastCheckedAt: Date.now(),
    };
  }
};

/**
 * Store network status for persistence
 */
export const storeNetworkStatus = async (status: NetworkStatus): Promise<void> => {
  try {
    await AsyncStorage.setItem(NETWORK_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('[Network] Error storing status:', error);
  }
};

/**
 * Retrieve stored network status
 */
export const getStoredNetworkStatus = async (): Promise<NetworkStatus | null> => {
  try {
    const stored = await AsyncStorage.getItem(NETWORK_STATUS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[Network] Error retrieving status:', error);
    return null;
  }
};

/**
 * Handle upload resumption and cache sync when connectivity returns
 */
export const resumeFailedUploads = async (): Promise<void> => {
  try {
    console.log('[Network] Resuming failed uploads and syncing cache...');
    const queue = await getUploadQueue();

    // Find stalled or failed uploads
    const stalledTasks = queue.filter(
      task =>
        task.status === 'uploading' ||
        (task.status === 'pending' && task.retries > 0)
    );

    if (stalledTasks.length === 0) {
      console.log('[Network] No stalled uploads to resume');
    } else {
      console.log(`[Network] Found ${stalledTasks.length} stalled uploads, resuming...`);

      // Reset stalled uploads to pending state to retry
      for (const task of stalledTasks) {
        await updateUploadStatus(task.id, 'pending');
      }
    }

    // Sync cache with latest data if available
    try {
      const { syncCacheOnConnectivity } = await import('./cacheManager');
      // In a real app, you would fetch latest notes from server here
      // For now, this is a placeholder for future server sync
      console.log('[Network] Cache sync point ready for server sync');
    } catch (error) {
      console.error('[Network] Error during cache sync:', error);
    }

    // Trigger immediate upload processing
    const { processUploadQueue } = await import('./backgroundUpload');
    await processUploadQueue();
  } catch (error) {
    console.error('[Network] Error resuming uploads:', error);
  }
};

/**
 * React Hook for network monitoring
 * Usage: const { isConnected, networkType } = useNetworkStatus();
 */
export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    type: 'online',
    lastCheckedAt: Date.now(),
  });

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<NetworkState>('online');

  const checkNetworkStatus = useCallback(async () => {
    try {
      const newStatus = await getNetworkStatus();
      const wasOffline = lastStatusRef.current === 'offline';
      const isNowOnline = newStatus.isConnected;

      setStatus(newStatus);
      await storeNetworkStatus(newStatus);

      // Detect transition from offline to online
      if (wasOffline && isNowOnline) {
        console.log('[Network] Connectivity restored!');
        // Resume any failed operations
        await resumeFailedUploads();
      } else if (!isNowOnline) {
        console.log('[Network] Connectivity lost!');
      }

      lastStatusRef.current = newStatus.type;
    } catch (error) {
      console.error('[Network] Error checking network:', error);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkNetworkStatus();

    // Set up periodic checks (every 30 seconds)
    checkIntervalRef.current = setInterval(checkNetworkStatus, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkNetworkStatus]);

  return {
    isConnected: status.isConnected,
    networkType: status.type,
    lastChecked: status.lastCheckedAt,
  };
};

/**
 * Initialize network monitoring
 * Call this during app initialization
 */
export const initializeNetworkMonitoring = async (): Promise<void> => {
  try {
    console.log('[Network] Initializing network monitoring...');
    
    // Initial status check
    const status = await getNetworkStatus();
    await storeNetworkStatus(status);

    console.log('[Network] Initial status:', status.type);

    // Resume any stalled uploads if we're online
    if (status.isConnected) {
      await resumeFailedUploads();
    }
  } catch (error) {
    console.error('[Network] Error initializing network monitoring:', error);
  }
};

/**
 * Wrap an async operation with network resilience
 * Automatically pauses and resumes based on connectivity
 */
export const withNetworkResilience = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> => {
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      // Check connectivity before attempting
      const isConnected = await checkConnectivity();
      if (!isConnected) {
        console.log(
          `[Network] ${operationName}: No connectivity, waiting before retry...`
        );
        // Wait 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempt++;
        continue;
      }

      // Attempt the operation
      console.log(`[Network] ${operationName}: Attempt ${attempt + 1}/${maxAttempts}`);
      const result = await operation();
      return result;
    } catch (error) {
      console.error(
        `[Network] ${operationName}: Attempt ${attempt + 1} failed:`,
        error
      );
      attempt++;

      if (attempt >= maxAttempts) {
        throw new Error(
          `${operationName} failed after ${maxAttempts} attempts with network resilience`
        );
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  throw new Error(`${operationName} exhausted all retry attempts`);
};

/**
 * Get network diagnostics for debugging
 */
export const getNetworkDiagnostics = async (): Promise<Record<string, any>> => {
  try {
    const status = await getNetworkStatus();
    const stored = await getStoredNetworkStatus();
    const queue = await getUploadQueue();

    const stalledUploads = queue.filter(
      t => t.status === 'uploading' || t.status === 'pending'
    ).length;

    return {
      currentStatus: status,
      storedStatus: stored,
      stalledUploads,
      queueLength: queue.length,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Network] Error getting diagnostics:', error);
    return { error: String(error) };
  }
};
