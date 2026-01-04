/**
 * Progressive Data Loader
 * Loads critical data first, then non-critical data when network is available
 */

// Network detection for progressive loading
import { getNetworkState, canDownloadHeavyData } from './lazyLoader';

export interface LoadPriority {
  CRITICAL: 'critical';
  HIGH: 'high';
  MEDIUM: 'medium';
  LOW: 'low';
}

export const LOAD_PRIORITY = {
  CRITICAL: 'critical' as const,
  HIGH: 'high' as const,
  MEDIUM: 'medium' as const,
  LOW: 'low' as const,
};

/**
 * Load data progressively based on priority
 */
export async function loadDataProgressively<T>(
  loader: () => Promise<T>,
  priority: 'critical' | 'high' | 'medium' | 'low' = 'high'
): Promise<T> {
  // Always load critical data immediately
  if (priority === 'critical') {
    return await loader();
  }

  // For non-critical data, check network first
  const network = await getNetworkState();
  if (!network.isConnected && priority !== 'critical') {
    // If offline, queue for later (user can retry manually)
    throw new Error('No internet connection. Please connect to WiFi or mobile data.');
  }

  // Load high priority data immediately if connected
  if (priority === 'high') {
    return await loader();
  }

  // Medium and low priority - load when WiFi is available
  if (priority === 'medium' || priority === 'low') {
    if (network.isWifi) {
      return await loader();
    } else {
      // Queue for WiFi (can be loaded in background)
      console.log(`📡 Queueing ${priority} priority data for WiFi...`);
      // For now, still load it (user can opt-in to restrict to WiFi)
      return await loader();
    }
  }

  return await loader();
}

/**
 * Batch load multiple data sources with priorities
 */
export async function batchLoadData<T>(
  loaders: Array<{ loader: () => Promise<T>; priority: 'critical' | 'high' | 'medium' | 'low' }>
): Promise<T[]> {
  const network = await getNetworkState();
  
  // Load critical first
  const criticalResults = await Promise.allSettled(
    loaders
      .filter(l => l.priority === 'critical')
      .map(l => l.loader())
  );

  if (!network.isConnected) {
    // Return critical results only if offline
    return criticalResults.map(r => r.status === 'fulfilled' ? r.value : null) as T[];
  }

  // Load high priority next
  const highResults = await Promise.allSettled(
    loaders
      .filter(l => l.priority === 'high')
      .map(l => l.loader())
  );

  // Load medium/low priority if WiFi
  if (network.isWifi) {
    const mediumLowResults = await Promise.allSettled(
      loaders
        .filter(l => l.priority === 'medium' || l.priority === 'low')
        .map(l => l.loader())
    );
    
    return [
      ...criticalResults.map(r => r.status === 'fulfilled' ? r.value : null),
      ...highResults.map(r => r.status === 'fulfilled' ? r.value : null),
      ...mediumLowResults.map(r => r.status === 'fulfilled' ? r.value : null),
    ] as T[];
  }

  return [
    ...criticalResults.map(r => r.status === 'fulfilled' ? r.value : null),
    ...highResults.map(r => r.status === 'fulfilled' ? r.value : null),
  ] as T[];
}

