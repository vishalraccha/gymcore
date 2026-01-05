import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { appStateManager } from '@/lib/appState';

interface AppDataContextType {
  refreshAll: () => Promise<void>;
  subscribe: (event: string, callback: () => void) => () => void;
  emit: (event: string, data?: any) => void;
}

// Simple event emitter for React Native
class SimpleEventEmitter {
  private listeners: Map<string, Set<() => void>> = new Map();

  on(event: string, callback: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: () => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { refreshProfile, refreshGym, refreshOwnerSubscription, user, profile } = useAuth();
  const { refreshSubscription } = useSubscription();
  const eventEmitterRef = useRef(new SimpleEventEmitter());

  const refreshAll = useCallback(async () => {
    if (!user || !profile) return;

    try {
      // Refresh auth data
      await refreshProfile();
      
      if (profile.gym_id) {
        await refreshGym();
        
        if (profile.role === 'gym_owner') {
          await refreshOwnerSubscription();
        }
      }
      
      // Refresh subscription
      await refreshSubscription();
      
      // Emit refresh event for all tabs
      eventEmitterRef.current.emit('data-refreshed');
    } catch (error) {
      console.error('Error refreshing app data:', error);
    }
  }, [user, profile, refreshProfile, refreshGym, refreshOwnerSubscription, refreshSubscription]);

  // Listen for app foreground events
  useEffect(() => {
    const handleForeground = () => {
      // Refresh data when app comes to foreground
      refreshAll();
    };

    appStateManager.on('foreground', handleForeground);

    return () => {
      appStateManager.off('foreground', handleForeground);
    };
  }, [refreshAll]);

  const subscribe = useCallback((event: string, callback: () => void) => {
    eventEmitterRef.current.on(event, callback);
    return () => {
      eventEmitterRef.current.off(event, callback);
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    eventEmitterRef.current.emit(event, data);
  }, []);

  return (
    <AppDataContext.Provider value={{ refreshAll, subscribe, emit }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}

