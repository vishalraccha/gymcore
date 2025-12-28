import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRupees } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { BarChart, LineChart } from 'react-native-chart-kit';
import {
  TrendingUp,
  Users,
  Dumbbell,
  Activity,
  Clock,
  Calendar,
  Target,
} from 'lucide-react-native';


interface Analytics {
  monthlyRevenue: number;
  totalRevenue: number;
  newMembers: number;
  avgWorkouts: number;
  growthRate: number;
  peakHours: string;
  popularWorkout: string;
  avgSessionDuration: number;
  retentionRate: number;
  activeSubscriptions: number;
  totalCheckIns: number;
}

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics>({
    monthlyRevenue: 0,
    totalRevenue: 0,
    newMembers: 0,
    avgWorkouts: 0,
    growthRate: 0,
    peakHours: '6:00 PM - 8:00 PM',
    popularWorkout: 'No data',
    avgSessionDuration: 0,
    retentionRate: 0,
    activeSubscriptions: 0,
    totalCheckIns: 0,
  });

  const [chartData, setChartData] = useState({
    memberGrowth: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 1] }], // At least one non-zero value
    },
    revenue: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 1] }], // At least one non-zero value
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchAnalytics();
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  // Helper function to ensure valid number
  const ensureValidNumber = (value: unknown, defaultValue: number = 0): number => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
  };

  // Helper function to ensure valid chart data
  const ensureValidChartData = (data: number[]): number[] => {
    const validData = data.map(val => ensureValidNumber(val, 0));
    const hasAnyData = validData.some(val => val > 0);
    
    // If all zeros, add a small value to prevent rendering issues
    if (!hasAnyData) {
      validData[validData.length - 1] = 1;
    }
    
    return validData;
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const isGymOwner = profile?.role === 'gym_owner';
      const gymId = profile?.gym_id;

      console.log('📊 Fetching analytics for:', { isGymOwner, gymId });

      // Fetch members with gym filter
      let membersQuery = supabase
        .from('profiles')
        .select('created_at, id')
        .eq('role', 'member');

      if (isGymOwner && gymId) {
        membersQuery = membersQuery.eq('gym_id', gymId);
      }

      const { data: members, error: membersError } = await membersQuery;
      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      // Fetch user subscriptions for revenue calculation - use subscriptions table
      let subscriptionsQuery = supabase
        .from('user_subscriptions')
        .select(`
          amount_paid,
          payment_status,
          payment_date,
          is_active,
          start_date,
          end_date,
          user_id,
          profiles!inner(gym_id)
        `);

      if (isGymOwner && gymId) {
        subscriptionsQuery = subscriptionsQuery.eq('profiles.gym_id', gymId);
      }

      const { data: userSubscriptions, error: subsError } = await subscriptionsQuery;
      if (subsError) {
        console.error('Error fetching subscriptions:', subsError);
      }

      // Also fetch cash payments for revenue
      let cashPaymentsQuery = supabase
        .from('cash_payments')
        .select('amount, payment_date, gym_id');

      if (isGymOwner && gymId) {
        cashPaymentsQuery = cashPaymentsQuery.eq('gym_id', gymId);
      }

      const { data: cashPayments, error: cashError } = await cashPaymentsQuery;
      if (cashError) {
        console.error('Error fetching cash payments:', cashError);
      }

      // Calculate revenue from subscriptions and cash payments
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Revenue from subscriptions
      const subscriptionMonthlyRevenue = (userSubscriptions || [])
        .filter((sub) => {
          if (!sub || sub.payment_status !== 'paid' || !sub.payment_date) return false;
          const paymentDate = new Date(sub.payment_date);
          return (
            paymentDate.getMonth() === currentMonth &&
            paymentDate.getFullYear() === currentYear
          );
        })
        .reduce((sum, sub) => sum + ensureValidNumber(sub.amount_paid, 0), 0);

      // Revenue from cash payments
      const cashMonthlyRevenue = (cashPayments || [])
        .filter((payment) => {
          if (!payment || !payment.payment_date) return false;
          const paymentDate = new Date(payment.payment_date);
          return (
            paymentDate.getMonth() === currentMonth &&
            paymentDate.getFullYear() === currentYear
          );
        })
        .reduce((sum, payment) => sum + ensureValidNumber(payment.amount, 0), 0);

      const monthlyRevenue = subscriptionMonthlyRevenue + cashMonthlyRevenue;

      const subscriptionTotalRevenue = (userSubscriptions || [])
        .filter((sub) => sub && sub.payment_status === 'paid')
        .reduce((sum, sub) => sum + ensureValidNumber(sub.amount_paid, 0), 0);

      const cashTotalRevenue = (cashPayments || [])
        .reduce((sum, payment) => sum + ensureValidNumber(payment.amount, 0), 0);

      const totalRevenue = subscriptionTotalRevenue + cashTotalRevenue;

      // Count active subscriptions (check both is_active and end_date)
      const today = new Date().toISOString().split('T')[0];
      const activeSubscriptions = (userSubscriptions || []).filter(
        (sub) => {
          if (!sub || !sub.is_active) return false;
          // Also check if subscription hasn't expired
          if (sub.end_date) {
            return sub.end_date >= today;
          }
          return true;
        }
      ).length;

      // Fetch workout logs
      let workoutLogsQuery = supabase.from('workout_logs').select(`
          duration_minutes,
          calories_burned,
          completed_at,
          user_id,
          workout_id,
          profiles!inner(gym_id)
        `);

      if (isGymOwner && gymId) {
        workoutLogsQuery = workoutLogsQuery.eq('profiles.gym_id', gymId);
      }

      const { data: workoutLogs, error: workoutError } = await workoutLogsQuery;
      if (workoutError) {
        console.error('Error fetching workouts:', workoutError);
      }

      // Fetch attendance
      let attendanceQuery = supabase
        .from('attendance')
        .select('check_in_time, user_id');

      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }

      const { data: attendance, error: attendanceError } = await attendanceQuery;
      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
      }

      // Calculate member growth
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const newMembersThisMonth = (members || []).filter((m) => {
        if (!m || !m.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === currentMonth &&
          createdDate.getFullYear() === currentYear
        );
      }).length;

      const newMembersLastMonth = (members || []).filter((m) => {
        if (!m || !m.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === lastMonth &&
          createdDate.getFullYear() === lastMonthYear
        );
      }).length;

      const growthRate =
        newMembersLastMonth > 0
          ? ((newMembersThisMonth - newMembersLastMonth) / newMembersLastMonth) * 100
          : newMembersThisMonth > 0
          ? 100
          : 0;

      // Calculate average workouts per member
      const totalMembers = members?.length || 0;
      const totalWorkouts = workoutLogs?.length || 0;
      const avgWorkouts = totalMembers > 0 ? totalWorkouts / totalMembers : 0;

      // Calculate average session duration
      const avgSessionDuration =
        workoutLogs && workoutLogs.length > 0
          ? workoutLogs.reduce(
              (sum, log) => sum + ensureValidNumber(log?.duration_minutes, 0),
              0
            ) / workoutLogs.length
          : 0;

      // Calculate peak hours
      const peakHours = calculatePeakHours(workoutLogs || []);

      // Get popular workout
      const popularWorkout = await getPopularWorkout(workoutLogs || [], gymId);

      // Calculate retention rate
      const retentionRate = calculateRetentionRate(userSubscriptions || []);

      // Generate chart data
      const memberGrowthData = calculateMonthlyGrowth(members || []);
      const revenueData = calculateMonthlyRevenue(userSubscriptions || []);

      setAnalytics({
        monthlyRevenue: ensureValidNumber(monthlyRevenue, 0),
        totalRevenue: ensureValidNumber(totalRevenue, 0),
        newMembers: ensureValidNumber(newMembersThisMonth, 0),
        avgWorkouts: ensureValidNumber(avgWorkouts, 0),
        growthRate: ensureValidNumber(growthRate, 0),
        peakHours,
        popularWorkout,
        avgSessionDuration: ensureValidNumber(avgSessionDuration, 0),
        retentionRate: ensureValidNumber(retentionRate, 0),
        activeSubscriptions: ensureValidNumber(activeSubscriptions, 0),
        totalCheckIns: ensureValidNumber(attendance?.length, 0),
      });

      setChartData({
        memberGrowth: memberGrowthData,
        revenue: revenueData,
      });

      console.log('✅ Analytics loaded successfully');
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMonthlyGrowth = (members: { created_at: string }[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentYear = new Date().getFullYear();

    const monthlyData = months.map((_, index) => {
      return (members || []).filter((member) => {
        if (!member || !member.created_at) return false;
        try {
          const memberDate = new Date(member.created_at);
          return (
            memberDate.getMonth() === index &&
            memberDate.getFullYear() === currentYear
          );
        } catch {
          return false;
        }
      }).length;
    });

    const validData = ensureValidChartData(monthlyData);

    return {
      labels: months,
      datasets: [{ data: validData }],
    };
  };

  const calculateMonthlyRevenue = (subscriptions: { payment_status: string; payment_date: string; amount_paid: number }[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentYear = new Date().getFullYear();

    const monthlyData = months.map((_, index) => {
      const monthRevenue = (subscriptions || [])
        .filter((sub) => {
          if (!sub || sub.payment_status !== 'paid' || !sub.payment_date) return false;
          try {
            const paymentDate = new Date(sub.payment_date);
            return (
              paymentDate.getMonth() === index &&
              paymentDate.getFullYear() === currentYear
            );
          } catch {
            return false;
          }
        })
        .reduce((sum, sub) => sum + ensureValidNumber(sub.amount_paid, 0), 0);

      return Math.round(monthRevenue);
    });

    const validData = ensureValidChartData(monthlyData);

    return {
      labels: months,
      datasets: [{ data: validData }],
    };
  };

  const calculatePeakHours = (workoutLogs: { completed_at: string }[]) => {
    if (!workoutLogs || workoutLogs.length === 0) return 'No data yet';

    const hourCounts: { [key: number]: number } = {};

    workoutLogs.forEach((log) => {
      if (!log || !log.completed_at) return;
      try {
        const hour = new Date(log.completed_at).getHours();
        if (!isNaN(hour)) {
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    });

    if (Object.keys(hourCounts).length === 0) return 'No data yet';

    const peakHour = parseInt(
      Object.keys(hourCounts).reduce((a, b) =>
        hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b
      )
    );

    const formatHour = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    return `${formatHour(peakHour)} - ${formatHour(peakHour + 2)}`;
  };

  const getPopularWorkout = async (
    workoutLogs: { workout_id: string }[]
    // gymId: string | null | undefined
  ) => {
    try {
      if (!workoutLogs || workoutLogs.length === 0) return 'No workouts yet';

      const workoutCounts: { [key: string]: number } = {};

      // Count workout occurrences
      workoutLogs.forEach((log) => {
        if (!log || !log.workout_id) return;
        const workoutId = log.workout_id;
        workoutCounts[workoutId] = (workoutCounts[workoutId] || 0) + 1;
      });

      if (Object.keys(workoutCounts).length === 0) return 'No workouts yet';

      // Get most popular workout ID
      const popularId = Object.keys(workoutCounts).reduce((a, b) =>
        workoutCounts[a] > workoutCounts[b] ? a : b
      );

      // Fetch workout name
      const { data: workout } = await supabase
        .from('workouts')
        .select('name')
        .eq('id', popularId)
        .single();

      return workout?.name || 'Unknown workout';
    } catch (error) {
      console.error('Error getting popular workout:', error);
      return 'No data';
    }
  };

  const calculateRetentionRate = (subscriptions: { is_active: boolean }[]) => {
    if (!subscriptions || subscriptions.length === 0) return 0;

    const activeCount = subscriptions.filter((sub) => sub && sub.is_active).length;
    const totalCount = subscriptions.length;

    return totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
  };

  // Convert hex to RGB for chart config
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
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    section: {
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      paddingHorizontal: 24,
      marginBottom: 12,
    },
    statsGrid: {
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
    insightsCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
    },
    insightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    insightContent: {
      flex: 1,
    },
    insightTitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    insightValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
  });

  if (isLoading && !refreshing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          {gym?.name
            ? `${gym.name} insights and metrics`
            : 'Performance insights and metrics'}
        </Text>
      </View>

      {/* Revenue Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Monthly Revenue"
            value={formatRupees(Math.round(analytics.monthlyRevenue))}
            icon={<Target size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
          <StatCard
            title="Total Revenue"
            value={formatRupees(Math.round(analytics.totalRevenue))}
            icon={<Target size={24} color={theme.colors.accent} />}
            color={theme.colors.accent}
          />
          <StatCard
            title="Active Plans"
            value={analytics.activeSubscriptions}
            unit="subscribers"
            icon={<Users size={24} color={theme.colors.primary} />}
            color={theme.colors.primary}
          />
          <StatCard
            title="Retention"
            value={`${Math.round(analytics.retentionRate)}%`}
            icon={<TrendingUp size={24} color={theme.colors.warning} />}
            color={theme.colors.warning}
          />
        </View>
      </View>

      {/* Member Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Activity</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="New Members"
            value={analytics.newMembers}
            unit="this month"
            icon={<Users size={24} color={theme.colors.primary} />}
            color={theme.colors.primary}
          />
          <StatCard
            title="Growth Rate"
            value={`${analytics.growthRate >= 0 ? '+' : ''}${Math.round(analytics.growthRate)}%`}
            unit="vs last month"
            icon={<TrendingUp size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
          <StatCard
            title="Check-ins"
            value={analytics.totalCheckIns}
            unit="total"
            icon={<Calendar size={24} color={theme.colors.accent} />}
            color={theme.colors.accent}
          />
          <StatCard
            title="Avg Workouts"
            value={Math.round(analytics.avgWorkouts * 10) / 10}
            unit="per member"
            icon={<Dumbbell size={24} color={theme.colors.accent} />}
            color={theme.colors.accent}
          />
        </View>
      </View>

      {/* Revenue Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Monthly Revenue</Text>
        <Text style={styles.chartSubtitle}>
          Revenue from paid subscriptions (₹)
        </Text>
        <BarChart
          data={chartData.revenue}
          width={screenWidth - 80}
          height={220}
          yAxisLabel="$"
          yAxisSuffix=""
          chartConfig={chartConfig}
          style={styles.chart}
          verticalLabelRotation={0}
          fromZero
        />
      </Card>

      {/* Member Growth Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Member Growth</Text>
        <Text style={styles.chartSubtitle}>
          New member registrations by month
        </Text>
        <LineChart
          data={chartData.memberGrowth}
          width={screenWidth - 80}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          bezier
          fromZero
        />
      </Card>

      {/* Performance Insights */}
      <Card style={styles.insightsCard}>
        <Text style={styles.cardTitle}>Performance Insights</Text>

        <View style={styles.insightItem}>
          <Clock size={20} color={theme.colors.textSecondary} />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Peak Hours</Text>
            <Text style={styles.insightValue}>{analytics.peakHours}</Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Dumbbell size={20} color={theme.colors.textSecondary} />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Most Popular Workout</Text>
            <Text style={styles.insightValue}>{analytics.popularWorkout}</Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Activity size={20} color={theme.colors.textSecondary} />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Average Session Duration</Text>
            <Text style={styles.insightValue}>
              {Math.round(analytics.avgSessionDuration)} minutes
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
    </SafeAreaWrapper>
  );
}