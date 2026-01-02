// /hooks/useGymData.ts
// Custom hook to automatically refresh data when gym changes

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that detects gym changes and triggers a callback to refresh data
 * Use this in analytics, dashboard, and any gym-specific screens
 * 
 * @param refreshCallback - Function to call when gym changes
 * 
 * @example
 * ```tsx
 * function AnalyticsScreen() {
 *   const [data, setData] = useState(null);
 *   
 *   const fetchData = async () => {
 *     // Your data fetching logic
 *     const result = await supabase.from('analytics').select();
 *     setData(result);
 *   };
 *   
 *   // Automatically refresh when gym changes
 *   useGymData(fetchData);
 *   
 *   return <View>...</View>;
 * }
 * ```
 */
export function useGymData(refreshCallback: () => void | Promise<void>) {
  const { gym, profile } = useAuth();
  const prevGymIdRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const currentGymId = profile?.gym_id || null;

    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevGymIdRef.current = currentGymId;
      return;
    }

    // Detect gym change
    if (currentGymId !== prevGymIdRef.current) {
      console.log(`🔄 Gym changed: ${prevGymIdRef.current} → ${currentGymId}`);
      console.log('🧹 Triggering data refresh...');
      
      // Call the refresh callback
      const result = refreshCallback();
      
      // Handle async callbacks
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error('Error refreshing gym data:', error);
        });
      }

      // Update ref
      prevGymIdRef.current = currentGymId;
    }
  }, [profile?.gym_id, gym?.id, refreshCallback]);
}

/**
 * Hook that provides gym-specific query filters
 * Automatically returns the correct filters based on user role
 * 
 * @returns Object with gymId and filter functions
 * 
 * @example
 * ```tsx
 * function MembersScreen() {
 *   const { gymId, applyGymFilter } = useGymFilter();
 *   
 *   const fetchMembers = async () => {
 *     let query = supabase.from('profiles').select();
 *     query = applyGymFilter(query, 'gym_id');
 *     const { data } = await query;
 *     return data;
 *   };
 * }
 * ```
 */
export function useGymFilter() {
  const { profile } = useAuth();

  const gymId = profile?.gym_id || null;
  const isGymOwner = profile?.role === 'gym_owner';

  /**
   * Apply gym filter to a Supabase query
   * Only filters if user is gym owner and has a gym
   */
  const applyGymFilter = <T,>(query: T, columnName: string = 'gym_id'): T => {
    if (isGymOwner && gymId) {
      // TypeScript workaround - we know query has .eq method
      return (query as any).eq(columnName, gymId);
    }
    return query;
  };

  /**
   * Apply gym filter to an array of items
   */
  const filterByGym = <T extends Record<string, any>>(
    items: T[], 
    columnName: string = 'gym_id'
  ): T[] => {
    if (isGymOwner && gymId) {
      return items.filter(item => item[columnName] === gymId);
    }
    return items;
  };

  return {
    gymId,
    isGymOwner,
    applyGymFilter,
    filterByGym,
  };
}