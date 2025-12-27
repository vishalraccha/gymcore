import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { useTheme } from '@/contexts/ThemeContext';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import {
  Users,
  UserPlus,
  Dumbbell,
  CreditCard,
  TrendingUp,
  Activity,
  Flame,
  Clock,
  Building2,
  Calendar,
} from 'lucide-react-native';

interface Stats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  totalWorkouts: number;
  totalSubscriptions: number;
  totalWorkoutLogs: number;
  totalCaloriesBurned: number;
  totalMinutesExercised: number;
  avgWorkoutsPerMember: number;
  totalCheckIns: number;
}

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    totalWorkouts: 0,
    totalSubscriptions: 0,
    totalWorkoutLogs: 0,
    totalCaloriesBurned: 0,
    totalMinutesExercised: 0,
    avgWorkoutsPerMember: 0,
    totalCheckIns: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (!['admin', 'gym_owner'].includes(profile.role)) {
      router.replace('/(app)/(tabs)');
      return;
    }

    fetchAdminStats();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAdminStats();
    setRefreshing(false);
  };

  const fetchAdminStats = async () => {
    setIsLoading(true);
    try {
      const isGymOwner = profile?.role === 'gym_owner';
      const gymId = profile?.gym_id;

      // Fetch total members (filtered by gym for gym_owner)
      let membersQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'member');

      if (isGymOwner && gymId) {
        membersQuery = membersQuery.eq('gym_id', gymId);
      }

      const { count: totalMembers } = await membersQuery;

      // Fetch active subscriptions
      let activeSubsQuery = supabase
        .from('user_subscriptions')
        .select('user_id, subscriptions!inner(gym_id)', { count: 'exact', head: true })
        .eq('is_active', true);

      if (isGymOwner && gymId) {
        activeSubsQuery = activeSubsQuery.eq('subscriptions.gym_id', gymId);
      }

      const { count: activeMembers } = await activeSubsQuery;

      // Fetch gym workouts
      let workoutsQuery = supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true });

      if (isGymOwner && gymId) {
        workoutsQuery = workoutsQuery.eq('gym_id', gymId);
      }

      const { count: totalWorkouts } = await workoutsQuery;

      // Fetch subscriptions
      let subscriptionsQuery = supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });

      if (isGymOwner && gymId) {
        subscriptionsQuery = subscriptionsQuery.eq('gym_id', gymId);
      }

      const { count: totalSubscriptions } = await subscriptionsQuery;

      // Fetch workout logs (from gym members only)
      let workoutLogsQuery = supabase
        .from('workout_logs')
        .select('duration_minutes, calories_burned, user_id, profiles!inner(gym_id)', { count: 'exact' });

      if (isGymOwner && gymId) {
        workoutLogsQuery = workoutLogsQuery.eq('profiles.gym_id', gymId);
      }

      const { data: workoutLogs, count: totalWorkoutLogs } = await workoutLogsQuery;

      // Calculate calories and minutes
      const totalCaloriesBurned = workoutLogs?.reduce(
        (sum, log) => sum + Number(log.calories_burned || 0),
        0
      ) || 0;

      const totalMinutesExercised = workoutLogs?.reduce(
        (sum, log) => sum + Number(log.duration_minutes || 0),
        0
      ) || 0;

      const avgWorkoutsPerMember =
        totalMembers && totalWorkoutLogs
          ? Math.round((totalWorkoutLogs / totalMembers) * 10) / 10
          : 0;

      // Fetch attendance/check-ins
      let attendanceQuery = supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true });

      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }

      const { count: totalCheckIns } = await attendanceQuery;

      setStats({
        totalMembers: totalMembers || 0,
        activeMembers: activeMembers || 0,
        expiredMembers: (totalMembers || 0) - (activeMembers || 0),
        totalWorkouts: totalWorkouts || 0,
        totalSubscriptions: totalSubscriptions || 0,
        totalWorkoutLogs: totalWorkoutLogs || 0,
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        totalMinutesExercised: totalMinutesExercised || 0,
        avgWorkoutsPerMember,
        totalCheckIns: totalCheckIns || 0,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const menuItems = [
    ...(profile?.role === 'gym_owner'
      ? [
          {
            title: 'Gym Profile',
            subtitle: 'Manage your gym information',
            icon: <Building2 size={22} color={theme.colors.accent} />,
            onPress: () => router.push('/(app)/admin/gym-profile'),
          },
        ]
      : []),
    {
      title: 'Members',
      subtitle: 'View & manage gym members',
      icon: <Users size={22} color={theme.colors.primary} />,
      onPress: () => router.push('/(app)/admin/members'),
    },
    {
      title: 'Workouts',
      subtitle: 'Create and manage workouts',
      icon: <Dumbbell size={22} color={theme.colors.success} />,
      onPress: () => router.push('/(app)/admin/workouts'),
    },
    {
      title: 'Subscriptions',
      subtitle: 'Manage subscription plans',
      icon: <CreditCard size={22} color={theme.colors.warning} />,
      onPress: () => router.push('/(app)/admin/subscriptions'),
    },
    {
      title: 'Analytics',
      subtitle: 'View performance insights',
      icon: <TrendingUp size={22} color={theme.colors.accent} />,
      onPress: () => router.push('/(app)/admin/analytics'),
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      paddingBottom: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerLocation: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    headerSubtitle: {
      marginTop: 6,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    section: {
      marginBottom: 8,
    },
    sectionTitle: {
      paddingHorizontal: 24,
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      justifyContent: 'space-between',
    },
    resourcesRow: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 12,
    },
    resourceCard: {
      flex: 1,
      alignItems: 'center',
      padding: 20,
    },
    resourceValue: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 12,
      marginBottom: 4,
    },
    resourceLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    menuCard: {
      marginHorizontal: 24,
      marginBottom: 12,
      paddingVertical: 4,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuIcon: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.colors.border + '40',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    menuText: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    menuSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });

  if (isLoading && !refreshing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Building2 size={32} color={theme.colors.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{gym?.name || 'Admin Dashboard'}</Text>
            {gym?.location && (
              <Text style={styles.headerLocation}>{gym.location}</Text>
            )}
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {profile?.role === 'gym_owner'
            ? 'Manage your gym operations'
            : 'Complete admin overview'}
        </Text>
      </View>

      {/* Member Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Overview</Text>
        <View style={styles.statGrid}>
          <StatCard
            title="Total Members"
            value={String(stats.totalMembers)}
            color={theme.colors.primary}
            icon={<Users size={22} color={theme.colors.primary} />}
          />
          <StatCard
            title="Active Members"
            value={String(stats.activeMembers)}
            color={theme.colors.success}
            icon={<UserPlus size={22} color={theme.colors.success} />}
          />
          <StatCard
            title="Expired"
            value={String(stats.expiredMembers)}
            color={theme.colors.error}
            icon={<Users size={22} color={theme.colors.error} />}
          />
          <StatCard
            title="Check-ins"
            value={String(stats.totalCheckIns)}
            color={theme.colors.accent}
            icon={<Calendar size={22} color={theme.colors.accent} />}
          />
        </View>
      </View>

      {/* Activity Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Statistics</Text>
        <View style={styles.statGrid}>
          <StatCard
            title="Total Sessions"
            value={String(stats.totalWorkoutLogs)}
            color={theme.colors.accent}
            icon={<Activity size={22} color={theme.colors.accent} />}
          />
          <StatCard
            title="Calories Burned"
            value={`${Math.round(stats.totalCaloriesBurned / 1000)}k`}
            color={theme.colors.error}
            icon={<Flame size={22} color={theme.colors.error} />}
          />
          <StatCard
            title="Hours Exercised"
            value={`${Math.round(stats.totalMinutesExercised / 60)}h`}
            color={theme.colors.success}
            icon={<Clock size={22} color={theme.colors.success} />}
          />
          <StatCard
            title="Avg Workouts"
            value={String(stats.avgWorkoutsPerMember)}
            color={theme.colors.warning}
            icon={<TrendingUp size={22} color={theme.colors.warning} />}
          />
        </View>
      </View>

      {/* Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resources</Text>
        <View style={styles.resourcesRow}>
          <Card style={styles.resourceCard}>
            <Dumbbell size={32} color={theme.colors.accent} />
            <Text style={styles.resourceValue}>{stats.totalWorkouts}</Text>
            <Text style={styles.resourceLabel}>Workout Plans</Text>
          </Card>
          <Card style={styles.resourceCard}>
            <CreditCard size={32} color={theme.colors.warning} />
            <Text style={styles.resourceValue}>{stats.totalSubscriptions}</Text>
            <Text style={styles.resourceLabel}>Subscription Plans</Text>
          </Card>
        </View>
      </View>

      {/* Menu Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} onPress={item.onPress}>
            <Card style={styles.menuCard}>
              <View style={styles.menuRow}>
                <View style={styles.menuIcon}>{item.icon}</View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </SafeAreaWrapper>
  );
}