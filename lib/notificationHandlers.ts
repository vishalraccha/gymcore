import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

/**
 * Handle notification tap/press
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
) {
  const data = response.notification.request.content.data;

  console.log('📲 Notification tapped:', data);

  if (!data || !data.type) return;

  switch (data.type) {
    case 'gym-owner-reminder':
      // Navigate to gym owner dashboard
      router.push('/(tabs)/dashboard');
      break;

    case 'member-progress-reminder':
      // Navigate to workout logging screen
      router.push('/(tabs)/workouts');
      break;

    case 'member-gym-reminder':
      // Navigate to home/gym screen
      router.push('/(tabs)/home');
      break;

    default:
      console.log('Unknown notification type:', data.type);
  }
}

/**
 * Setup notification response listener
 */
export function setupNotificationListeners() {
  // Listener for when user taps notification
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

  // Listener for when notification is received while app is open
  const receivedSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notification received:', notification);
    });

  // Return cleanup function
  return () => {
    responseSubscription.remove();
    receivedSubscription.remove();
  };
}