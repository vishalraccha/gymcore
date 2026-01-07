import { scheduleDailyNotification, cancelAllNotifications } from './notifications';
import { supabase } from './supabase';

export interface NotificationIdentifiers {
  gymOwnerReminder?: string;
  memberProgressReminder?: string;
  memberGymReminder?: string;
}

/**
 * Schedule all notifications for gym owner
 */
export async function scheduleGymOwnerNotifications(
  userId: string
): Promise<NotificationIdentifiers> {
  try {
    console.log('📅 Scheduling gym owner notifications...');

    // Daily reminder at 8:00 AM
    const gymOwnerReminder = await scheduleDailyNotification(
      '🏋️ Good Morning!',
      'Ready to manage your gym? Check today\'s attendance and memberships.',
      8, // 8 AM
      0,
      { type: 'gym-owner-reminder', userId },
      'gym-owner'
    );

    // Save identifiers to database
    await supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        gym_owner_reminder_id: gymOwnerReminder,
        updated_at: new Date().toISOString(),
      });

    console.log('✅ Gym owner notifications scheduled');

    return {
      gymOwnerReminder: gymOwnerReminder || undefined,
    };
  } catch (error) {
    console.error('Error scheduling gym owner notifications:', error);
    return {};
  }
}

/**
 * Schedule all notifications for gym member
 */
export async function scheduleMemberNotifications(
  userId: string,
  hasGymMembership: boolean
): Promise<NotificationIdentifiers> {
  try {
    console.log('📅 Scheduling member notifications...');

    const identifiers: NotificationIdentifiers = {};

    // Notification 1: Progress tracking reminder at 10:00 AM
    const progressReminder = await scheduleDailyNotification(
      '📊 Track Your Progress!',
      'Don\'t forget to log your workout and meals today. Keep the streak going! 💪',
      10, // 10 AM
      0,
      { type: 'member-progress-reminder', userId },
      'member'
    );

    identifiers.memberProgressReminder = progressReminder || undefined;

    // Notification 2: Gym reminder at 6:00 PM (only if registered in gym)
    if (hasGymMembership) {
      const gymReminder = await scheduleDailyNotification(
        '🏋️ Time to Hit the Gym!',
        'Your workout is waiting! Let\'s crush those goals today! 🔥',
        12, // 12 PM
        0,
        { type: 'member-gym-reminder', userId },
        'member'
      );

      identifiers.memberGymReminder = gymReminder || undefined;
    }

    // Save identifiers to database
    await supabase
      .from('notification_settings')
      .upsert({
        user_id: userId,
        member_progress_reminder_id: identifiers.memberProgressReminder,
        member_gym_reminder_id: identifiers.memberGymReminder,
        updated_at: new Date().toISOString(),
      });

    console.log('✅ Member notifications scheduled');

    return identifiers;
  } catch (error) {
    console.error('Error scheduling member notifications:', error);
    return {};
  }
}

/**
 * Cancel all user notifications and clear from database
 */
export async function cancelUserNotifications(userId: string) {
  try {
    console.log('🗑️ Cancelling user notifications...');

    await cancelAllNotifications();

    await supabase
      .from('notification_settings')
      .delete()
      .eq('user_id', userId);

    console.log('✅ User notifications cancelled');
  } catch (error) {
    console.error('Error cancelling user notifications:', error);
  }
}

/**
 * Update member notifications based on gym membership status
 */
export async function updateMemberNotifications(
  userId: string,
  hasGymMembership: boolean
) {
  try {
    // Get current notification settings
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!settings) {
      // No settings exist, schedule new notifications
      await scheduleMemberNotifications(userId, hasGymMembership);
      return;
    }

    // If gym membership status changed, reschedule
    const hadGymReminder = !!settings.member_gym_reminder_id;

    if (hasGymMembership && !hadGymReminder) {
      // User got gym membership, add gym reminder
      const gymReminder = await scheduleDailyNotification(
        '🏋️ Time to Hit the Gym!',
        'Your workout is waiting! Let\'s crush those goals today! 🔥',
        18,
        0,
        { type: 'member-gym-reminder', userId },
        'member'
      );

      await supabase
        .from('notification_settings')
        .update({
          member_gym_reminder_id: gymReminder,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else if (!hasGymMembership && hadGymReminder) {
      // User lost gym membership, remove gym reminder
      await supabase
        .from('notification_settings')
        .update({
          member_gym_reminder_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    console.log('✅ Member notifications updated');
  } catch (error) {
    console.error('Error updating member notifications:', error);
  }
}