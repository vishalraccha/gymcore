import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

export default function HomeScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const { stats, isLoading, streak, refreshStats } = useStats(selectedDate);

  useEffect(() => {
    if (user) {
      checkTodayAttendance();
      refreshProfile();
      refreshStats();
      console.log('Homescreen of Tabs (index.tsx)');
    }
  }, [user, selectedDate]);

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
            gym_id: profile?.gym_id || null, // ADD THIS LINE 🔥
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
        icon: <Sunrise size={20} color="#F59E0B" />,
      };
    if (hour < 18)
      return {
        text: 'Good Afternoon',
        icon: <Sun size={20} color="#F59E0B" />,
      };
    return { text: 'Good Evening', icon: <Moon size={20} color="#6366F1" /> };
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

  return (
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
            <Flame size={16} color="#F97316" />
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
              <LogOut size={24} color="#EF4444" />
            ) : (
              <LogIn size={24} color="#10B981" />
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
        <Text style={styles.sectionTitle}>Today's Performance</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Current Streak"
            value={String(streak || 0)}
            unit="days"
            icon={<Flame size={24} color="#F97316" />}
            color="#F97316"
          />
          <StatCard
            title="Calories Burned"
            value={String(Math.round(safeStats.calories_burned || 0))}
            unit="kcal"
            icon={<Activity size={24} color="#EF4444" />}
            color="#EF4444"
          />
          <StatCard
            title="Workout Time"
            value={String(safeStats.workout_duration || 0)}
            unit="min"
            icon={<Clock size={24} color="#8B5CF6" />}
            color="#8B5CF6"
          />
          <StatCard
            title="Workouts"
            value={String(safeStats.workouts_completed || 0)}
            unit="completed"
            icon={<Dumbbell size={24} color="#10B981" />}
            color="#10B981"
          />
        </View>
      </View>

      {/* Nutrition Progress */}
      <Card style={styles.nutritionCard}>
        <View style={styles.nutritionHeader}>
          <Text style={styles.cardTitle}>Today's Nutrition</Text>
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
            color="#3B82F6"
          />
          <ProgressBar
            label="Protein"
            current={safeStats.protein_consumed || 0}
            target={targets.protein}
            unit="g"
            color="#10B981"
          />
          <ProgressBar
            label="Carbs"
            current={safeStats.carbs_consumed || 0}
            target={targets.carbs}
            unit="g"
            color="#F59E0B"
          />
          <ProgressBar
            label="Fat"
            current={safeStats.fat_consumed || 0}
            target={targets.fat}
            unit="g"
            color="#EF4444"
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
              selectedColor: '#3B82F6',
            },
            [new Date().toISOString().split('T')[0]]: {
              marked: true,
              dotColor: '#10B981',
            },
          }}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#64748B',
            selectedDayBackgroundColor: '#3B82F6',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#3B82F6',
            dayTextColor: '#0F172A',
            textDisabledColor: '#CBD5E1',
            dotColor: '#10B981',
            selectedDotColor: '#ffffff',
            arrowColor: '#3B82F6',
            disabledArrowColor: '#CBD5E1',
            monthTextColor: '#0F172A',
            indicatorColor: '#3B82F6',
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInInfo: {
    flex: 1,
  },
  checkInTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  checkInSubtitle: {
    fontSize: 14,
    color: '#64748B',
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
    color: '#0F172A',
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
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  nutritionSubtitle: {
    fontSize: 14,
    color: '#64748B',
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
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  calendar: {
    borderRadius: 12,
  },
});
