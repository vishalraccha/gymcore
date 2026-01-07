import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  userId: string;
  token: string;
  deviceType: 'ios' | 'android' | 'web';
}

/**
 * Register device for push notifications
 * Returns Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check if running on physical device
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permission denied, return null
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    if (!projectId) {
      console.error('Project ID not found in app config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Android-specific channel setup
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      // Channel for gym owner notifications
      await Notifications.setNotificationChannelAsync('gym-owner', {
        name: 'Gym Management',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });

      // Channel for member notifications
      await Notifications.setNotificationChannelAsync('member', {
        name: 'Workout Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4ECDC4',
      });
    }

    console.log('✅ Push token registered:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Save push token to database
 */
export async function savePushToken(userId: string, token: string) {
  try {
    const deviceType = Platform.OS as 'ios' | 'android';

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          device_type: deviceType,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,device_type',
        }
      );

    if (error) throw error;
    console.log('✅ Push token saved to database');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Remove push token from database (on logout)
 */
export async function removePushToken(userId: string) {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_type', Platform.OS);

    if (error) throw error;
    console.log('✅ Push token removed from database');
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

/**
 * Send local notification (doesn't require server)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
  channelId: string = 'default'
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

/**
 * Schedule a notification for specific time
 */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: any,
  channelId: string = 'default'
) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        date: triggerDate,
        channelId,
      },
    });

    console.log('✅ Notification scheduled:', identifier);
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Schedule daily repeating notification
 */
export async function scheduleDailyNotification(
  title: string,
  body: string,
  hour: number, // 24-hour format (0-23)
  minute: number = 0,
  data?: any,
  channelId: string = 'default'
) {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
        channelId,
      },
    });

    console.log(`✅ Daily notification scheduled at ${hour}:${minute}`);
    return identifier;
  } catch (error) {
    console.error('Error scheduling daily notification:', error);
    return null;
  }
}

/**
 * Cancel specific notification
 */
export async function cancelNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log('✅ Notification cancelled:', identifier);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications() {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('📅 Scheduled notifications:', notifications.length);
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}