import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  registerForPushNotifications,
  savePushToken,
  removePushToken,
} from '@/lib/notifications';
import {
  scheduleGymOwnerNotifications,
  scheduleMemberNotifications,
  cancelUserNotifications,
  updateMemberNotifications,
} from '@/lib/notificationScheduler';
import { setupNotificationListeners } from '@/lib/notificationHandlers';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  pushToken: string | null;
  notificationsEnabled: boolean;
  initializeNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  notificationsEnabled: false,
  initializeNotifications: async () => {},
  disableNotifications: async () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  // Setup notification listeners on mount
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  // Initialize notifications when user logs in
  useEffect(() => {
    if (profile?.id && profile.notifications_enabled !== false) {
      initializeNotifications();
    } else if (!profile?.id) {
      // User logged out, clear notifications
      setPushToken(null);
      setNotificationsEnabled(false);
    }
  }, [profile?.id]);

  // Re-schedule notifications when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, checking notifications...');
        if (profile?.id && notificationsEnabled) {
          scheduleUserNotifications();
        }
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, profile, notificationsEnabled]);

  const initializeNotifications = async () => {
    if (!profile?.id) return;

    try {
      console.log('🔔 Initializing notifications for user:', profile.id);

      // Register for push notifications
      const token = await registerForPushNotifications();

      if (token) {
        setPushToken(token);
        await savePushToken(profile.id, token);
        setNotificationsEnabled(true);

        // Schedule daily notifications
        await scheduleUserNotifications();
      } else {
        console.log('Failed to get push token');
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      setNotificationsEnabled(false);
    }
  };

  const scheduleUserNotifications = async () => {
    if (!profile?.id) return;

    try {
      if (profile.role === 'gym_owner' || profile.role === 'admin') {
        await scheduleGymOwnerNotifications(profile.id);
      } else if (profile.role === 'member') {
        const hasGymMembership = !!profile.gym_id;
        await scheduleMemberNotifications(profile.id, hasGymMembership);
      }
    } catch (error) {
      console.error('Error scheduling user notifications:', error);
    }
  };

  const disableNotifications = async () => {
    if (!profile?.id) return;

    try {
      console.log('🔕 Disabling notifications for user:', profile.id);

      await cancelUserNotifications(profile.id);
      await removePushToken(profile.id);

      setPushToken(null);
      setNotificationsEnabled(false);
    } catch (error) {
      console.error('Error disabling notifications:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        pushToken,
        notificationsEnabled,
        initializeNotifications,
        disableNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);