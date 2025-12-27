import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '@/contexts/AuthContext';
import { useStats } from '@/hooks/useStats';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import {
  Activity,
  Flame,
  Clock,
  Dumbbell,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Sunrise,
} from 'lucide-react-native';
import SafeAreaWrapper from '../../../components/SafeAreaWrapper';
import { useTheme } from '@/contexts/ThemeContext';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { profile, user, refreshProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  interface Attendance {
    id: string;
    user_id: string;
    gym_id: string | null;
    check_in_time: string;
    check_out_time: string | null;
    attendance_date: string;
    duration_minutes: number | null;
  }
  
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const { stats, streak, refreshStats } = useStats(selectedDate);

  useEffect(() => {
    if (user) {
      checkTodayAttendance();
      refreshProfile();
      refreshStats();
      console.log('Homescreen of Tabs (index.tsx)');
    }
  }, [user, selectedDate]);

   useEffect(() => {
    const debugCheck = async () => {
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      console.log('🔍 ========== DATABASE DEBUG ==========');
      console.log('🔍 Logged in user ID:', user.id);
      console.log('🔍 Logged in user email:', user.email);

      // Check all subscriptions for this user
      const { data: allSubs, error: allError } = await supabase
        .from('razorpay_subscriptions')
        .select('*')
        .eq('user_id', user.id);

      console.log('🔍 All subscriptions found:', allSubs?.length || 0);
      console.log('🔍 Subscription data:', allSubs);
      console.log('🔍 Error:', allError);

      // Check active subscriptions
      const { data: activeSubs, error: activeError } = await supabase
        .from('razorpay_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

      console.log('🔍 Active subscriptions found:', activeSubs?.length || 0);
      console.log('🔍 Active subscription data:', activeSubs);
      console.log('🔍 Active error:', activeError);
      console.log('🔍 ====================================');
    };

    debugCheck();
  }, [user?.id]);

  const checkTodayAttendance = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('attendance_date', today)
        .order('check_in_time', { ascending: false })
        .limit(1);

      if (error) {
        console.log('⚠️ attendance fetch error:', error);
        return;
      }

      if (data && data.length > 0) {
        setTodayAttendance(data[0]);
        setIsCheckedIn(!data[0].check_out_time); // checked in if no checkout
      } else {
        setTodayAttendance(null);
        setIsCheckedIn(false);
      }
    } catch (err) {
      console.log('⚠️ checkTodayAttendance error:', err);
    }
  };

  const handleCheckInOut = async () => {
    if (!user) return;

    try {
      if (!isCheckedIn) {
        // Check in
        const { error } = await supabase.from('attendance').insert([
          {
            user_id: user.id,
            gym_id: profile?.gym_id || null,
            check_in_time: new Date().toISOString(),
            attendance_date: new Date().toISOString().split('T')[0],
          },
        ]);

        if (error) throw error;
        Alert.alert(
          'Welcome! 🎉',
          'You have successfully checked in. Have a great workout!'
        );
      } else {
        // Check out
        if (todayAttendance) {
          const checkOutTime = new Date();
          const checkInTime = new Date(todayAttendance.check_in_time);
          const durationMinutes = Math.floor(
            (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)
          );

          const { error } = await supabase
            .from('attendance')
            .update({
              check_out_time: checkOutTime.toISOString(),
              duration_minutes: durationMinutes,
            })
            .eq('id', todayAttendance.id);

          if (error) throw error;
          Alert.alert(
            'Great Session! 💪',
            `You worked out for ${durationMinutes} minutes. See you next time!`
          );
        }
      }

      await checkTodayAttendance();
      await refreshStats();
    } catch (error) {
      console.error('Error with check-in/out:', error);
      Alert.alert('Error', 'Failed to update attendance. Please try again.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12)
      return {
        text: 'Good Morning',
        icon: <Sunrise size={20} color={theme.colors.warning} />,
      };
    if (hour < 18)
      return {
        text: 'Good Afternoon',
        icon: <Sun size={20} color={theme.colors.warning} />,
      };
    return { 
      text: 'Good Evening', 
      icon: <Moon size={20} color={theme.colors.primary} /> 
    };
  };

  const greeting = getGreeting();
  const targets = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
  };

  // Safe value extraction with defaults
  const safeProfile = profile || {
    full_name: 'User',
    level: 1,
    current_streak: 0,
    total_points: 0,
  };

  const safeStats = stats || {
    calories_burned: 0,
    workout_duration: 0,
    workouts_completed: 0,
    calories_consumed: 0,
    protein_consumed: 0,
    carbs_consumed: 0,
    fat_consumed: 0,
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 24,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    greeting: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    name: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 12,
      fontFamily: 'Inter-Bold',
    },
    streakContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    levelBadge: {
      backgroundColor: theme.colors.primaryLight + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    levelText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      fontFamily: 'Inter-SemiBold',
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.lockBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 4,
    },
    streakText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      fontFamily: 'Inter-SemiBold',
    },
    checkInCard: {
      marginHorizontal: 24,
      marginTop: 16,
      marginBottom: 16,
      padding: 20,
    },
    checkInHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 16,
    },
    checkInIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkInInfo: {
      flex: 1,
    },
    checkInTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    checkInSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
      fontFamily: 'Inter-Regular',
    },
    checkInButton: {
      width: '100%',
    },
    sectionContainer: {
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
      fontFamily: 'Inter-Bold',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    nutritionCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    nutritionHeader: {
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    nutritionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    nutritionProgress: {
      gap: 4,
    },
    calendarCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
    },
    calendarHeader: {
      marginBottom: 16,
    },
    calendarSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    calendar: {
      borderRadius: 12,
    },
  });

  return (
    <SafeAreaWrapper>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.greetingContainer}>
          {greeting.icon}
          <Text style={styles.greeting}>{greeting.text},</Text>
        </View>
        <Text style={styles.name}>
          {safeProfile.full_name?.split(' ')[0] || 'User'}
        </Text>
        <View style={styles.streakContainer}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Level {safeProfile.level || 1}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Flame size={16} color={theme.colors.warning} />
            <Text style={styles.streakText}>
              {safeProfile.current_streak || 0} day streak
            </Text>
          </View>
        </View>
      </View>

      {/* Check-in/out Section */}
      <Card style={styles.checkInCard}>
        <View style={styles.checkInHeader}>
          <View style={styles.checkInIcon}>
            {isCheckedIn ? (
              <LogOut size={24} color={theme.colors.error} />
            ) : (
              <LogIn size={24} color={theme.colors.success} />
            )}
          </View>
          <View style={styles.checkInInfo}>
            <Text style={styles.checkInTitle}>
              {isCheckedIn ? "You're checked in!" : 'Ready to workout?'}
            </Text>
            <Text style={styles.checkInSubtitle}>
              {isCheckedIn
                ? "Don't forget to check out when you're done"
                : 'Check in to start tracking your session'}
            </Text>
          </View>
        </View>
        <Button
          title={isCheckedIn ? 'Check Out' : 'Check In'}
          onPress={handleCheckInOut}
          variant={isCheckedIn ? 'outline' : 'primary'}
          style={styles.checkInButton}
        />
      </Card>

      {/* Today's Stats */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Todays Performance</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Current Streak"
            value={String(streak || 0)}
            unit="days"
            icon={<Flame size={24} color={theme.colors.warning} />}
            color={theme.colors.warning}
          />
          <StatCard
            title="Calories Burned"
            value={String(Math.round(safeStats.calories_burned || 0))}
            unit="kcal"
            icon={<Activity size={24} color={theme.colors.error} />}
            color={theme.colors.error}
          />
          <StatCard
            title="Workout Time"
            value={String(safeStats.workout_duration || 0)}
            unit="min"
            icon={<Clock size={24} color={theme.colors.accent} />}
            color={theme.colors.accent}
          />
          <StatCard
            title="Workouts"
            value={String(safeStats.workouts_completed || 0)}
            unit="completed"
            icon={<Dumbbell size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
        </View>
      </View>

      {/* Nutrition Progress */}
      <Card style={styles.nutritionCard}>
        <View style={styles.nutritionHeader}>
          <Text style={styles.cardTitle}>Todays Nutrition</Text>
          <Text style={styles.nutritionSubtitle}>
            Track your daily intake goals
          </Text>
        </View>
        <View style={styles.nutritionProgress}>
          <ProgressBar
            label="Calories"
            current={safeStats.calories_consumed || 0}
            target={targets.calories}
            unit="kcal"
            color={theme.colors.primary}
          />
          <ProgressBar
            label="Protein"
            current={safeStats.protein_consumed || 0}
            target={targets.protein}
            unit="g"
            color={theme.colors.success}
          />
          <ProgressBar
            label="Carbs"
            current={safeStats.carbs_consumed || 0}
            target={targets.carbs}
            unit="g"
            color={theme.colors.warning}
          />
          <ProgressBar
            label="Fat"
            current={safeStats.fat_consumed || 0}
            target={targets.fat}
            unit="g"
            color={theme.colors.error}
          />
        </View>
      </Card>

      {/* Calendar */}
      <Card style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.cardTitle}>Progress Calendar</Text>
          <Text style={styles.calendarSubtitle}>
            Select a date to view your progress
          </Text>
        </View>
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{
            [selectedDate]: {
              selected: true,
              selectedColor: theme.colors.primary,
            },
            [new Date().toISOString().split('T')[0]]: {
              marked: true,
              dotColor: theme.colors.success,
            },
          }}
          theme={{
            backgroundColor: theme.colors.card,
            calendarBackground: theme.colors.card,
            textSectionTitleColor: theme.colors.textSecondary,
            selectedDayBackgroundColor: theme.colors.primary,
            selectedDayTextColor: theme.colors.card,
            todayTextColor: theme.colors.primary,
            dayTextColor: theme.colors.text,
            textDisabledColor: theme.colors.border,
            dotColor: theme.colors.success,
            selectedDotColor: theme.colors.card,
            arrowColor: theme.colors.primary,
            disabledArrowColor: theme.colors.border,
            monthTextColor: theme.colors.text,
            indicatorColor: theme.colors.primary,
            textDayFontFamily: 'Inter-Regular',
            textMonthFontFamily: 'Inter-SemiBold',
            textDayHeaderFontFamily: 'Inter-SemiBold',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 14,
          }}
          style={styles.calendar}
        />
      </Card>
    </ScrollView>
    </SafeAreaWrapper>
  );
}