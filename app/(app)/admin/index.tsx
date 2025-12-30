import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Platform, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { useTheme } from '@/contexts/ThemeContext';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import {
  Users,
  UserPlus,
  Dumbbell,
  TrendingUp,
  Activity,
  Flame,
  Clock,
  Building2,
  Calendar,
  Award,
  Target,
  Zap,
  Trophy,
  AlertCircle,
} from 'lucide-react-native';

interface Stats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  membersWithoutSubscription: number;
  totalWorkouts: number;
  totalSubscriptions: number;
  totalWorkoutLogs: number;
  totalCaloriesBurned: number;
  totalMinutesExercised: number;
  avgWorkoutsPerMember: number;
  totalCheckIns: number;
  weeklyCheckIns: number;
  monthlyGrowth: number;
  retentionRate: number;
  avgSessionDuration: number;
}

interface LeaderboardMember {
  id: string;
  full_name: string;
  level: number;
  total_points: number;
  current_streak: number;
  totalWorkouts: number;
  totalCalories: number;
  rank: number;
}

const screenWidth = Dimensions.get('window').width;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    membersWithoutSubscription: 0,
    totalWorkouts: 0,
    totalSubscriptions: 0,
    totalWorkoutLogs: 0,
    totalCaloriesBurned: 0,
    totalMinutesExercised: 0,
    avgWorkoutsPerMember: 0,
    totalCheckIns: 0,
    weeklyCheckIns: 0,
    monthlyGrowth: 0,
    retentionRate: 0,
    avgSessionDuration: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 1] }],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (!['admin', 'gym_owner'].includes(profile.role)) {
      router.replace('/(app)/(tabs)');
      return;
    }

    fetchDashboardData();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const isGymOwner = profile?.role === 'gym_owner';
      const gymId = profile?.gym_id;

      // Fetch members
      let membersQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'member');

      if (isGymOwner && gymId) {
        membersQuery = membersQuery.eq('gym_id', gymId);
      }

      const { data: members } = await membersQuery;
      const totalMembers = members?.length || 0;

      // Get today's date for comparison (same as members screen)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      // Count active, expired, and no subscription members
      let activeMembers = 0;
      let expiredMembers = 0;
      let membersWithoutSubscription = 0;

      // Check each member's subscription status
      await Promise.all(
        (members || []).map(async (member) => {
          // Fetch ALL subscriptions for this member
          const { data: allUserSubscriptions } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', member.id)
            .order('created_at', { ascending: false });

          if (!allUserSubscriptions || allUserSubscriptions.length === 0) {
            // No subscription at all
            membersWithoutSubscription++;
            return;
          }

          // Find an active subscription (same logic as members screen)
          const activeSubscription = allUserSubscriptions.find((sub: any) => {
            const isActive = sub.is_active === true;
            const notExpired = sub.end_date && sub.end_date >= todayString;
            return isActive && notExpired;
          });

          if (activeSubscription) {
            // Has active subscription
            activeMembers++;
          } else {
            // Has subscription but it's expired
            expiredMembers++;
          }
        })
      );

      // Calculate retention rate (active members / total members)
      const retentionRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

      // Fetch workouts
      let workoutsQuery = supabase.from('workouts').select('*', { count: 'exact', head: true });
      if (isGymOwner && gymId) {
        workoutsQuery = workoutsQuery.eq('gym_id', gymId);
      }
      const { count: totalWorkouts } = await workoutsQuery;

      // Fetch subscription plans
      let plansQuery = supabase.from('subscriptions').select('*', { count: 'exact', head: true });
      if (isGymOwner && gymId) {
        plansQuery = plansQuery.eq('gym_id', gymId);
      }
      const { count: totalSubscriptions } = await plansQuery;

      // Fetch workout logs
      let workoutLogsQuery = supabase.from('workout_logs').select('*');
      if (isGymOwner && gymId) {
        workoutLogsQuery = workoutLogsQuery.in(
          'user_id',
          (members || []).map(m => m.id)
        );
      }
      const { data: workoutLogs } = await workoutLogsQuery;

      const totalWorkoutLogs = workoutLogs?.length || 0;
      const totalCaloriesBurned = workoutLogs?.reduce(
        (sum, log) => sum + Number(log.calories_burned || 0),
        0
      ) || 0;
      const totalMinutesExercised = workoutLogs?.reduce(
        (sum, log) => sum + Number(log.duration_minutes || 0),
        0
      ) || 0;

      const avgSessionDuration = totalWorkoutLogs > 0 
        ? totalMinutesExercised / totalWorkoutLogs 
        : 0;

      const avgWorkoutsPerMember = totalMembers > 0 
        ? Math.round((totalWorkoutLogs / totalMembers) * 10) / 10 
        : 0;

      // Fetch attendance
      let attendanceQuery = supabase.from('attendance').select('*');
      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }
      const { data: attendance } = await attendanceQuery;
      const totalCheckIns = attendance?.length || 0;

      // Weekly check-ins
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyCheckIns = (attendance || []).filter((a: any) => {
        return new Date(a.check_in_time) >= oneWeekAgo;
      }).length;

      // Monthly growth
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const thisMonthMembers = (members || []).filter((m: any) => {
        return new Date(m.created_at) >= oneMonthAgo;
      }).length;

      const lastMonthMembers = (members || []).filter((m: any) => {
        const created = new Date(m.created_at);
        return created >= twoMonthsAgo && created < oneMonthAgo;
      }).length;

      const monthlyGrowth = lastMonthMembers > 0
        ? ((thisMonthMembers - lastMonthMembers) / lastMonthMembers) * 100
        : thisMonthMembers > 0 ? 100 : 0;

      // Weekly activity chart
      const weeklyData = calculateWeeklyActivity(attendance || []);

      // Fetch leaderboard
      const leaderboardData = await fetchLeaderboard(members || [], workoutLogs || []);

      setStats({
        totalMembers,
        activeMembers,
        expiredMembers,
        membersWithoutSubscription,
        totalWorkouts: totalWorkouts || 0,
        totalSubscriptions: totalSubscriptions || 0,
        totalWorkoutLogs,
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        totalMinutesExercised,
        avgWorkoutsPerMember,
        totalCheckIns,
        weeklyCheckIns,
        monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
        retentionRate: Math.round(retentionRate),
        avgSessionDuration: Math.round(avgSessionDuration),
      });

      setWeeklyActivity(weeklyData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateWeeklyActivity = (attendance: any[]) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    attendance.forEach((a: any) => {
      const date = new Date(a.check_in_time);
      if (date >= oneWeekAgo) {
        const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        counts[dayIndex]++;
      }
    });

    // Ensure at least one non-zero value
    if (counts.every(c => c === 0)) {
      counts[6] = 0.1;
    }

    return {
      labels: days,
      datasets: [{ data: counts }],
    };
  };

  const fetchLeaderboard = async (members: any[], workoutLogs: any[]) => {
    const memberStats = await Promise.all(
      members.map(async (member) => {
        const memberWorkouts = workoutLogs.filter(
          (log) => log.user_id === member.id
        );
        const totalWorkouts = memberWorkouts.length;
        const totalCalories = memberWorkouts.reduce(
          (sum, log) => sum + Number(log.calories_burned || 0),
          0
        );

        return {
          id: member.id,
          full_name: member.full_name,
          level: member.level || 1,
          total_points: member.total_points || 0,
          current_streak: member.current_streak || 0,
          totalWorkouts,
          totalCalories: Math.round(totalCalories),
          rank: 0,
        };
      })
    );

    // Sort by total points descending
    memberStats.sort((a, b) => b.total_points - a.total_points);

    // Assign ranks
    memberStats.forEach((member, index) => {
      member.rank = index + 1;
    });

    return memberStats.slice(0, 10);
  };

  const getBadgeColor = (rank: number) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return theme.colors.textSecondary;
  };

  const getBadgeIcon = (rank: number) => {
    if (rank <= 3) return <Trophy size={20} color={getBadgeColor(rank)} />;
    return <Award size={20} color={theme.colors.textSecondary} />;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 59, g: 130, b: 246 };
  };

  const primaryRgb = hexToRgb(theme.colors.primary);
  const textSecondaryRgb = hexToRgb(theme.colors.textSecondary);

  const chartConfig = {
    backgroundColor: theme.colors.card,
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${textSecondaryRgb.r}, ${textSecondaryRgb.g}, ${textSecondaryRgb.b}, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const progressData = {
    labels: ['Active', 'Retention', 'Growth'],
    data: [
      stats.totalMembers > 0 ? stats.activeMembers / stats.totalMembers : 0,
      stats.retentionRate / 100,
      Math.min(Math.max(stats.monthlyGrowth / 100, 0), 1),
    ],
  };

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
    gymIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
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
    chartCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
    },
    chartTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    chartSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    chart: {
      borderRadius: 16,
      marginVertical: 8,
    },
    leaderboardCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    leaderboardRank: {
      width: 40,
      alignItems: 'center',
    },
    rankNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    leaderboardAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    leaderboardInfo: {
      flex: 1,
    },
    leaderboardName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    leaderboardStats: {
      flexDirection: 'row',
      gap: 12,
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statBadgeText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    leaderboardPoints: {
      alignItems: 'flex-end',
    },
    pointsValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 2,
    },
    levelBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.colors.warning + '20',
    },
    levelText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.warning,
    },
    progressCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
    },
    emptyLeaderboard: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 12,
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
          <View style={styles.gymIcon}>
            <Building2 size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{gym?.name || 'Admin Dashboard'}</Text>
            {gym?.location && (
              <Text style={styles.headerLocation}>📍 {gym.location}</Text>
            )}
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {profile?.role === 'gym_owner'
            ? 'Manage your gym operations and track performance'
            : 'Complete admin overview and analytics'}
        </Text>
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
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
            title="Expired Memberships"
            value={String(stats.expiredMembers)}
            color={theme.colors.error}
            icon={<AlertCircle size={22} color={theme.colors.error} />}
          />
          <StatCard
            title="No Subscription"
            value={String(stats.membersWithoutSubscription)}
            color={theme.colors.warning}
            icon={<Users size={22} color={theme.colors.warning} />}
          />
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Performance</Text>
        <View style={styles.statGrid}>
          <StatCard
            title="Monthly Growth"
            value={`${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth}%`}
            color={stats.monthlyGrowth >= 0 ? theme.colors.success : theme.colors.error}
            icon={<TrendingUp size={22} color={stats.monthlyGrowth >= 0 ? theme.colors.success : theme.colors.error} />}
          />
          <StatCard
            title="Retention Rate"
            value={`${stats.retentionRate}%`}
            color={theme.colors.accent}
            icon={<Target size={22} color={theme.colors.accent} />}
          />
        </View>
      </View>

      {/* Activity Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 Activity Overview</Text>
        <View style={styles.statGrid}>
          <StatCard
            title="Total Sessions"
            value={String(stats.totalWorkoutLogs)}
            color={theme.colors.accent}
            icon={<Activity size={22} color={theme.colors.accent} />}
          />
          <StatCard
            title="Weekly Check-ins"
            value={String(stats.weeklyCheckIns)}
            color={theme.colors.primary}
            icon={<Calendar size={22} color={theme.colors.primary} />}
          />
          <StatCard
            title="Calories Burned"
            value={`${Math.round(stats.totalCaloriesBurned / 1000)}k`}
            color={theme.colors.error}
            icon={<Flame size={22} color={theme.colors.error} />}
          />
          <StatCard
            title="Avg Session"
            value={`${stats.avgSessionDuration}m`}
            color={theme.colors.success}
            icon={<Clock size={22} color={theme.colors.success} />}
          />
        </View>
      </View>

      {/* Performance Progress */}
      <Card style={styles.progressCard}>
        <Text style={styles.chartTitle}>📈 Performance Indicators</Text>
        <Text style={styles.chartSubtitle}>
          Key metrics at a glance
        </Text>
        <ProgressChart
          data={progressData}
          width={screenWidth - 88}
          height={220}
          strokeWidth={16}
          radius={32}
          chartConfig={chartConfig}
          hideLegend={false}
          style={styles.chart}
        />
      </Card>

      {/* Weekly Activity Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>📅 Weekly Check-in Activity</Text>
        <Text style={styles.chartSubtitle}>
          Member attendance over the last 7 days
        </Text>
        <LineChart
          data={weeklyActivity}
          width={screenWidth - 88}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          bezier
          fromZero
        />
      </Card>

      {/* Leaderboard */}
      <Card style={styles.leaderboardCard}>
        <Text style={styles.chartTitle}>🏆 Top Performers</Text>
        <Text style={styles.chartSubtitle}>
          Top 10 members by total XP earned
        </Text>

        {leaderboard.length > 0 ? (
          leaderboard.map((member) => (
            <View key={member.id} style={styles.leaderboardItem}>
              <View style={styles.leaderboardRank}>
                {member.rank <= 3 ? (
                  getBadgeIcon(member.rank)
                ) : (
                  <Text style={styles.rankNumber}>#{member.rank}</Text>
                )}
              </View>

              <View style={styles.leaderboardAvatar}>
                <Text style={styles.avatarText}>
                  {member.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>
                  {member.full_name}
                </Text>
                <View style={styles.leaderboardStats}>
                  <View style={styles.statBadge}>
                    <Dumbbell size={12} color={theme.colors.textSecondary} />
                    <Text style={styles.statBadgeText}>
                      {member.totalWorkouts} workouts
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Flame size={12} color={theme.colors.error} />
                    <Text style={styles.statBadgeText}>
                      {member.totalCalories} cal
                    </Text>
                  </View>
                  <View style={styles.statBadge}>
                    <Zap size={12} color={theme.colors.warning} />
                    <Text style={styles.statBadgeText}>
                      {member.current_streak} day streak
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.leaderboardPoints}>
                <Text style={styles.pointsValue}>
                  {member.total_points} XP
                </Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv {member.level}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyLeaderboard}>
            <Trophy size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              No member activity yet. Start tracking workouts!
            </Text>
          </View>
        )}
      </Card>

      {/* Resources Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💪 Resources Available</Text>
        <View style={styles.statGrid}>
          <StatCard
            title="Workout Plans"
            value={String(stats.totalWorkouts)}
            color={theme.colors.accent}
            icon={<Dumbbell size={22} color={theme.colors.accent} />}
          />
          <StatCard
            title="Subscription Plans"
            value={String(stats.totalSubscriptions)}
            color={theme.colors.warning}
            icon={<Target size={22} color={theme.colors.warning} />}
          />
        </View>
      </View>
    </ScrollView>
    </SafeAreaWrapper>
  );
}