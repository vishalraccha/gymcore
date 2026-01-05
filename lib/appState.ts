import { AppState, AppStateStatus } from 'react-native';

type EventCallback = () => void;

class AppStateManager {
  private appState: AppStateStatus = AppState.currentState;
  private listeners: Array<() => void> = [];
  private foregroundCallbacks: Set<EventCallback> = new Set();
  private backgroundCallbacks: Set<EventCallback> = new Set();

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        this.foregroundCallbacks.forEach(callback => callback());
      } else if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        this.backgroundCallbacks.forEach(callback => callback());
      }
      this.appState = nextAppState;
    });

    this.listeners.push(() => subscription.remove());
  }

  on(event: 'foreground' | 'background', callback: EventCallback) {
    if (event === 'foreground') {
      this.foregroundCallbacks.add(callback);
    } else {
      this.backgroundCallbacks.add(callback);
    }
    
    return () => {
      if (event === 'foreground') {
        this.foregroundCallbacks.delete(callback);
      } else {
        this.backgroundCallbacks.delete(callback);
      }
    };
  }

  off(event: 'foreground' | 'background', callback: EventCallback) {
    if (event === 'foreground') {
      this.foregroundCallbacks.delete(callback);
    } else {
      this.backgroundCallbacks.delete(callback);
    }
  }

  cleanup() {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.foregroundCallbacks.clear();
    this.backgroundCallbacks.clear();
  }
}

export const appStateManager = new AppStateManager();

