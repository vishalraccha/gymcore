/**
 * Lazy Loader Utility
 * Progressive loading with network detection
 */

import { Platform } from 'react-native';

export interface NetworkState {
  isConnected: boolean;
  isWifi: boolean;
  type: string | null;
}

/**
 * Get current network state
 * Simplified for now - can be enhanced with expo-network later
 */
export async function getNetworkState(): Promise<NetworkState> {
  try {
    // Default to connected (optimistic approach)
    // Can be enhanced with expo-network or NetInfo if needed
    return {
      isConnected: true, // Assume connected for progressive loading
      isWifi: true, // Assume WiFi for best performance
      type: 'wifi',
    };
  } catch (error) {
    console.error('Network state error:', error);
    return {
      isConnected: false,
      isWifi: false,
      type: null,
    };
  }
}

/**
 * Check if we can download heavy data (WiFi or strong connection)
 */
export async function canDownloadHeavyData(): Promise<boolean> {
  const network = await getNetworkState();
  // Allow download on WiFi or mobile data (user can opt-in to restrict to WiFi)
  return network.isConnected === true;
}

/**
 * Lazy load module with retry
 */
export async function lazyLoadModule<T>(
  loader: () => Promise<T>,
  retries: number = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await loader();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Failed to load module after retries');
}

/**
 * Wait for network before loading
 */
export async function waitForNetwork(maxWait: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const network = await getNetworkState();
    if (network.isConnected) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

