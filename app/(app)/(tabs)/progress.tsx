import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { TrendingUp, Target, Award, Flame, Zap, Dumbbell, Apple } from 'lucide-react-native';

interface UserStats {
  level: number;
  total_points: number;
  current_streak: number;
  max_streak: number;
  workouts_completed: number;
  meals_logged: number;
  total_calories_burned: number;
  gym_checkins: number;
}

export default function Progress() {
  const { user, profile } = useAuth();
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    total_points: 0,
    current_streak: 0,
    max_streak: 0,
    workouts_completed: 0,
    meals_logged: 0,
    total_calories_burned: 0,
    gym_checkins: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoadedData = useRef(false);

  const calculateXPFromActivity = (workouts: number, meals: number, checkins: number) => {
    const workoutXP = workouts * 50;
    const mealXP = meals * 25;
    const checkinXP = checkins * 30;
    return workoutXP + mealXP + checkinXP;
  };

  const calculateLevel = (totalXP: number) => {
    return Math.floor(totalXP / 1000) + 1;
  };

  const calculateStreak = (dates: string[]) => {
    if (dates.length === 0) return { current: 0, max: 0 };

    const sortedDates = dates
      .map(d => new Date(d).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 1;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      currentStreak = 1;

      for (let i = 0; i < sortedDates.length - 1; i++) {
        const currentDate = new Date(sortedDates[i]);
        const nextDate = new Date(sortedDates[i + 1]);
        const dayDiff = Math.floor((currentDate.getTime() - nextDate.getTime()) / 86400000);

        if (dayDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    tempStreak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const currentDate = new Date(sortedDates[i]);
      const nextDate = new Date(sortedDates[i + 1]);
      const dayDiff = Math.floor((currentDate.getTime() - nextDate.getTime()) / 86400000);

      if (dayDiff === 1) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak, currentStreak);

    return { current: currentStreak, max: maxStreak };
  };

  const fetchUserStats = async () => {
    if (!user) return;

    try {
      console.log('📊 Fetching user stats...');

      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('completed_at, calories_burned')
        .eq('user_id', user.id);

      const { data: dietLogs } = await supabase
        .from('diet_logs')
        .select('logged_at, calories')
        .eq('user_id', user.id);

      const { data: attendance } = await supabase
        .from('attendance')
        .select('check_in_time')
        .eq('user_id', user.id);

      const workouts = workoutLogs || [];
      const meals = dietLogs || [];
      const checkins = attendance || [];

      const totalCaloriesBurned = workouts.reduce(
        (sum, log) => sum + (log.calories_burned || 0),
        0
      );

      const totalXP = calculateXPFromActivity(
        workouts.length,
        meals.length,
        checkins.length
      );

      const level = calculateLevel(totalXP);

      const allActivityDates = [
        ...workouts.map(w => w.completed_at),
        ...meals.map(m => m.logged_at),
        ...checkins.map(c => c.check_in_time),
      ];

      const streaks = calculateStreak(allActivityDates);

      const newStats = {
        level,
        total_points: totalXP,
        current_streak: streaks.current,
        max_streak: streaks.max,
        workouts_completed: workouts.length,
        meals_logged: meals.length,
        total_calories_burned: Math.round(totalCaloriesBurned),
        gym_checkins: checkins.length,
      };

      setUserStats(newStats);
      await updateProfileStats(newStats);

      console.log('✅ Stats updated:', newStats);
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
    }
  };

  const updateProfileStats = async (stats: UserStats) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          level: stats.level,
          total_points: stats.total_points,
          current_streak: stats.current_streak,
          max_streak: stats.max_streak,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (error) {
        console.error('❌ Error updating profile stats:', error);
      } else {
        console.log('✅ Profile stats updated');
      }
    } catch (error) {
      console.error('❌ Exception updating stats:', error);
    }
  };

  const fetchRecentActivities = async () => {
    if (!user) return;

    try {
      const { data: workouts } = await supabase
        .from('workout_logs')
        .select('completed_at, calories_burned, workouts(name)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(3);

      const { data: meals } = await supabase
        .from('diet_logs')
        .select('logged_at, meal_name, calories')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(3);

      const activities = [
        ...(workouts || []).map(w => ({
          type: 'workout',
          name: w.workouts?.name || 'Workout',
          xp: 50,
          date: w.completed_at,
        })),
        ...(meals || []).map(m => ({
          type: 'meal',
          name: m.meal_name,
          xp: 25,
          date: m.logged_at,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentActivities(activities);
    } catch (error) {
      console.error('❌ Error fetching activities:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserStats(), fetchRecentActivities()]);
    setRefreshing(false);
  };

  // Load data only ONCE when component mounts and user is available
  useEffect(() => {
    const loadData = async () => {
      // Don't load if already loaded
      if (hasLoadedData.current) {
        console.log('📍 Data already loaded, skipping...');
        return;
      }

      if (!user) {
        console.log('⏳ Waiting for user...');
        return;
      }

      console.log('🔄 Loading progress data...');
      setLoading(true);
      
      await Promise.all([fetchUserStats(), fetchRecentActivities()]);
      
      setLoading(false);
      hasLoadedData.current = true;
      console.log('✅ Progress data loaded');
    };

    loadData();
  }, [user?.id]); // Only depend on user ID, not the entire user object

  const calculateLevelProgress = () => {
    const pointsForCurrentLevel = (userStats.level - 1) * 1000;
    const currentLevelProgress = userStats.total_points - pointsForCurrentLevel;
    const progressPercentage = (currentLevelProgress / 1000) * 100;
    
    return {
      current: Math.max(0, currentLevelProgress),
      total: 1000,
      percentage: Math.min(Math.max(progressPercentage, 0), 100)
    };
  };

  const levelProgress = calculateLevelProgress();

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Progress</Text>
        <Text style={styles.subtitle}>Track your fitness journey</Text>
      </View>

      {/* Level Progress Card */}
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View style={styles.levelInfo}>
            <Text style={styles.levelNumber}>Level {userStats.level}</Text>
            <Text style={styles.levelSubtext}>
              {levelProgress.current}/{levelProgress.total} XP
            </Text>
          </View>
          <View style={styles.levelIcon}>
            <Zap size={32} color="#3B82F6" />
          </View>
        </View>
        
        <ProgressBar 
          label="XP Progress"
          current={levelProgress.current}
          target={levelProgress.total}
          unit="XP"
          color="#3B82F6"
        />
        
        <Text style={styles.levelDescription}>
          Earn {1000 - levelProgress.current} more XP to reach Level {userStats.level + 1}
        </Text>
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Flame size={24} color="#EF4444" />
          <Text style={styles.statNumber}>{userStats.current_streak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </Card>
        
        <Card style={styles.statCard}>
          <Award size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{userStats.max_streak}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </Card>
        
        <Card style={styles.statCard}>
          <Target size={24} color="#10B981" />
          <Text style={styles.statNumber}>{userStats.total_points}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </Card>
      </View>

      {/* Activity Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Stats</Text>
        <View style={styles.activityGrid}>
          <Card style={styles.activityCard}>
            <Dumbbell size={32} color="#3B82F6" />
            <Text style={styles.activityNumber}>{userStats.workouts_completed}</Text>
            <Text style={styles.activityLabel}>Workouts</Text>
            <Text style={styles.activityXP}>+{userStats.workouts_completed * 50} XP</Text>
          </Card>

          <Card style={styles.activityCard}>
            <Apple size={32} color="#10B981" />
            <Text style={styles.activityNumber}>{userStats.meals_logged}</Text>
            <Text style={styles.activityLabel}>Meals Logged</Text>
            <Text style={styles.activityXP}>+{userStats.meals_logged * 25} XP</Text>
          </Card>

          <Card style={styles.activityCard}>
            <Flame size={32} color="#EF4444" />
            <Text style={styles.activityNumber}>{userStats.total_calories_burned}</Text>
            <Text style={styles.activityLabel}>Calories Burned</Text>
          </Card>

          <Card style={styles.activityCard}>
            <TrendingUp size={32} color="#8B5CF6" />
            <Text style={styles.activityNumber}>{userStats.gym_checkins}</Text>
            <Text style={styles.activityLabel}>Gym Check-ins</Text>
            <Text style={styles.activityXP}>+{userStats.gym_checkins * 30} XP</Text>
          </Card>
        </View>
      </View>

      {/* Recent Activities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activities</Text>
        {recentActivities.length > 0 ? (
          recentActivities.map((activity, index) => (
            <Card key={index} style={styles.activityItemCard}>
              <View style={styles.activityItem}>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName}>
                    {activity.type === 'workout' ? '🏋️ ' : '🍎 '}
                    {activity.name}
                  </Text>
                  <Text style={styles.activityDate}>
                    {new Date(activity.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.activityXPBadge}>+{activity.xp} XP</Text>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <TrendingUp size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No recent activities</Text>
            <Text style={styles.emptySubtext}>Start working out to earn XP</Text>
          </Card>
        )}
      </View>

      {/* How to Level Up */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Earn XP</Text>
        <Card style={styles.guideCard}>
          <View style={styles.guideItem}>
            <View style={styles.guideLeft}>
              <Dumbbell size={20} color="#3B82F6" />
              <Text style={styles.guideActivity}>Complete a workout</Text>
            </View>
            <Text style={styles.guideXP}>+50 XP</Text>
          </View>
          <View style={styles.guideItem}>
            <View style={styles.guideLeft}>
              <Apple size={20} color="#10B981" />
              <Text style={styles.guideActivity}>Log a meal</Text>
            </View>
            <Text style={styles.guideXP}>+25 XP</Text>
          </View>
          <View style={styles.guideItem}>
            <View style={styles.guideLeft}>
              <TrendingUp size={20} color="#8B5CF6" />
              <Text style={styles.guideActivity}>Check in to gym</Text>
            </View>
            <Text style={styles.guideXP}>+30 XP</Text>
          </View>
          <View style={styles.guideItem}>
            <View style={styles.guideLeft}>
              <Flame size={20} color="#EF4444" />
              <Text style={styles.guideActivity}>Maintain daily streak</Text>
            </View>
            <Text style={styles.guideXP}>Bonus</Text>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Inter-Regular',
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  levelCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelInfo: {
    flex: 1,
  },
  levelNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  levelSubtext: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  levelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'Inter-Regular',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  section: {
    padding: 24,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    width: '48%',
    padding: 16,
    alignItems: 'center',
  },
  activityNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  activityLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  activityXP: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter-SemiBold',
  },
  activityItemCard: {
    padding: 16,
    marginBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  activityDate: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  activityXPBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontFamily: 'Inter-SemiBold',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  guideCard: {
    padding: 16,
  },
  guideItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  guideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideActivity: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'Inter-Regular',
  },
  guideXP: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter-SemiBold',
  },
});