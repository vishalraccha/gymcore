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
  TouchableOpacity,
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
  DollarSign,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';

interface Analytics {
  monthlyRevenue: number;
  totalRevenue: number;
  newMembers: number;
  totalMembers: number;
  avgWorkouts: number;
  growthRate: number;
  peakHours: string;
  popularWorkout: string;
  avgSessionDuration: number;
  retentionRate: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  totalCheckIns: number;
  pendingPayments: number;
  partialPayments: number;
  avgRevenuePerMember: number;
}

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [analytics, setAnalytics] = useState<Analytics>({
    monthlyRevenue: 0,
    totalRevenue: 0,
    newMembers: 0,
    totalMembers: 0,
    avgWorkouts: 0,
    growthRate: 0,
    peakHours: '6:00 PM - 8:00 PM',
    popularWorkout: 'No data',
    avgSessionDuration: 0,
    retentionRate: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    totalCheckIns: 0,
    pendingPayments: 0,
    partialPayments: 0,
    avgRevenuePerMember: 0,
  });

  const [chartData, setChartData] = useState({
    memberGrowth: {
      labels: [''],
      datasets: [{ data: [1] }],
    },
    revenue: {
      labels: [''],
      datasets: [{ data: [1] }],
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchAnalytics();
    }
  }, [profile, selectedMonth, selectedYear]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const ensureValidNumber = (value: unknown, defaultValue: number = 0): number => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
  };

  const ensureValidChartData = (data: number[]): number[] => {
    const validData = data.map(val => ensureValidNumber(val, 0));
    const hasAnyData = validData.some(val => val > 0);
    if (!hasAnyData) {
      validData[validData.length - 1] = 0.1;
    }
    return validData;
  };

  const getMonthLabels = () => {
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedYear, selectedMonth - i, 1);
      labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
    }
    return labels;
  };

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const isGymOwner = profile?.role === 'gym_owner';
      const gymId = profile?.gym_id;

      // Fetch members
      let membersQuery = supabase
        .from('profiles')
        .select('created_at, id')
        .eq('role', 'member');

      if (isGymOwner && gymId) {
        membersQuery = membersQuery.eq('gym_id', gymId);
      }

      const { data: members } = await membersQuery;

      // Fetch user subscriptions with proper payment data
      let subscriptionsQuery = supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription:subscription_id (
            name,
            price
          )
        `);

      if (isGymOwner && gymId) {
        subscriptionsQuery = subscriptionsQuery.eq('gym_id', gymId);
      }

      const { data: userSubscriptions } = await subscriptionsQuery;

      // Fetch cash payments
      let cashPaymentsQuery = supabase
        .from('cash_payments')
        .select('*');

      if (isGymOwner && gymId) {
        cashPaymentsQuery = cashPaymentsQuery.eq('gym_id', gymId);
      }

      const { data: cashPayments } = await cashPaymentsQuery;

      // Calculate revenue for selected month (only amount_paid, not plan price)
      const monthlyRevenue = calculateMonthlyRevenueAmount(
        userSubscriptions || [],
        cashPayments || [],
        selectedMonth,
        selectedYear
      );

      // Calculate total revenue (all time)
      const totalRevenue = calculateTotalRevenueAmount(
        userSubscriptions || [],
        cashPayments || []
      );

      // Count total members
      const totalMembers = members?.length || 0;

      // Calculate new members for selected month
      const newMembers = (members || []).filter((m) => {
        if (!m?.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === selectedMonth &&
          createdDate.getFullYear() === selectedYear
        );
      }).length;

      // Calculate growth rate
      const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const prevMonthMembers = (members || []).filter((m) => {
        if (!m?.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === prevMonth &&
          createdDate.getFullYear() === prevYear
        );
      }).length;

      const growthRate =
        prevMonthMembers > 0
          ? ((newMembers - prevMonthMembers) / prevMonthMembers) * 100
          : newMembers > 0
          ? 100
          : 0;

      // Count active and expired subscriptions
      const today = new Date().toISOString().split('T')[0];
      const activeSubscriptions = (userSubscriptions || []).filter(
        (sub) => sub?.is_active && sub?.end_date >= today
      ).length;

      const expiredSubscriptions = (userSubscriptions || []).filter(
        (sub) => !sub?.is_active || (sub?.end_date && sub.end_date < today)
      ).length;

      // Count pending and partial payments
      const pendingPayments = (userSubscriptions || []).filter(
        (sub) => sub?.payment_status === 'pending'
      ).length;

      const partialPayments = (userSubscriptions || []).filter(
        (sub) => sub?.payment_status === 'partial' && ensureValidNumber(sub?.pending_amount, 0) > 0
      ).length;

      // Fetch workout logs
      let workoutLogsQuery = supabase.from('workout_logs').select('*');
      if (isGymOwner && gymId) {
        workoutLogsQuery = workoutLogsQuery.in(
          'user_id',
          (members || []).map(m => m.id)
        );
      }

      const { data: workoutLogs } = await workoutLogsQuery;

      // Fetch attendance
      let attendanceQuery = supabase
        .from('attendance')
        .select('*');

      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }

      const { data: attendance } = await attendanceQuery;

      // Calculate workout metrics
      const totalWorkouts = workoutLogs?.length || 0;
      const avgWorkouts = totalMembers > 0 ? totalWorkouts / totalMembers : 0;

      const avgSessionDuration =
        workoutLogs && workoutLogs.length > 0
          ? workoutLogs.reduce(
              (sum, log) => sum + ensureValidNumber(log?.duration_minutes, 0),
              0
            ) / workoutLogs.length
          : 0;

      const peakHours = calculatePeakHours(workoutLogs || []);
      const popularWorkout = await getPopularWorkout(workoutLogs || []);
      const retentionRate = calculateRetentionRate(userSubscriptions || []);

      // Calculate average revenue per member
      const avgRevenuePerMember = totalMembers > 0 ? totalRevenue / totalMembers : 0;

      // Generate chart data for last 6 months
      const memberGrowthData = calculateMonthlyGrowth(members || []);
      const revenueData = calculateMonthlyRevenueChart(
        userSubscriptions || [],
        cashPayments || []
      );

      setAnalytics({
        monthlyRevenue: ensureValidNumber(monthlyRevenue, 0),
        totalRevenue: ensureValidNumber(totalRevenue, 0),
        newMembers: ensureValidNumber(newMembers, 0),
        totalMembers: ensureValidNumber(totalMembers, 0),
        avgWorkouts: ensureValidNumber(avgWorkouts, 0),
        growthRate: ensureValidNumber(growthRate, 0),
        peakHours,
        popularWorkout,
        avgSessionDuration: ensureValidNumber(avgSessionDuration, 0),
        retentionRate: ensureValidNumber(retentionRate, 0),
        activeSubscriptions: ensureValidNumber(activeSubscriptions, 0),
        expiredSubscriptions: ensureValidNumber(expiredSubscriptions, 0),
        totalCheckIns: ensureValidNumber(attendance?.length, 0),
        pendingPayments: ensureValidNumber(pendingPayments, 0),
        partialPayments: ensureValidNumber(partialPayments, 0),
        avgRevenuePerMember: ensureValidNumber(avgRevenuePerMember, 0),
      });

      setChartData({
        memberGrowth: memberGrowthData,
        revenue: revenueData,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMonthlyRevenueAmount = (
    subscriptions: any[],
    cashPayments: any[],
    month: number,
    year: number
  ): number => {
    // Revenue from subscription payments (amount_paid only)
    const subRevenue = (subscriptions || [])
      .filter((sub) => {
        if (!sub?.amount_paid || sub.amount_paid === 0) return false;
        
        // Check payment_date if available
        if (sub.payment_date) {
          const paymentDate = new Date(sub.payment_date);
          return (
            paymentDate.getMonth() === month &&
            paymentDate.getFullYear() === year
          );
        }
        
        // Fallback to start_date
        if (sub.start_date) {
          const startDate = new Date(sub.start_date);
          return (
            startDate.getMonth() === month &&
            startDate.getFullYear() === year
          );
        }
        
        return false;
      })
      .reduce((sum, sub) => sum + ensureValidNumber(sub.amount_paid, 0), 0);

    // Revenue from cash payments
    const cashRevenue = (cashPayments || [])
      .filter((payment) => {
        if (!payment?.payment_date) return false;
        const paymentDate = new Date(payment.payment_date);
        return (
          paymentDate.getMonth() === month &&
          paymentDate.getFullYear() === year
        );
      })
      .reduce((sum, payment) => sum + ensureValidNumber(payment.amount, 0), 0);

    return subRevenue + cashRevenue;
  };

  const calculateTotalRevenueAmount = (
    subscriptions: any[],
    cashPayments: any[]
  ): number => {
    const subRevenue = (subscriptions || [])
      .reduce((sum, sub) => sum + ensureValidNumber(sub.amount_paid, 0), 0);

    const cashRevenue = (cashPayments || [])
      .reduce((sum, payment) => sum + ensureValidNumber(payment.amount, 0), 0);

    return subRevenue + cashRevenue;
  };

  const calculateMonthlyGrowth = (members: { created_at: string }[]) => {
    const labels = getMonthLabels();
    
    const monthlyData = labels.map((_, index) => {
      const targetDate = new Date(selectedYear, selectedMonth - (5 - index), 1);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();

      return (members || []).filter((member) => {
        if (!member?.created_at) return false;
        const memberDate = new Date(member.created_at);
        return (
          memberDate.getMonth() === targetMonth &&
          memberDate.getFullYear() === targetYear
        );
      }).length;
    });

    const validData = ensureValidChartData(monthlyData);

    return {
      labels,
      datasets: [{ data: validData }],
    };
  };

  const calculateMonthlyRevenueChart = (
    subscriptions: any[],
    cashPayments: any[]
  ) => {
    const labels = getMonthLabels();
    
    const monthlyData = labels.map((_, index) => {
      const targetDate = new Date(selectedYear, selectedMonth - (5 - index), 1);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();

      return calculateMonthlyRevenueAmount(
        subscriptions,
        cashPayments,
        targetMonth,
        targetYear
      );
    });

    const validData = ensureValidChartData(monthlyData);

    return {
      labels,
      datasets: [{ data: validData }],
    };
  };

  const calculatePeakHours = (workoutLogs: { completed_at: string }[]) => {
    if (!workoutLogs || workoutLogs.length === 0) return 'No data yet';

    const hourCounts: { [key: number]: number } = {};

    workoutLogs.forEach((log) => {
      if (!log?.completed_at) return;
      const hour = new Date(log.completed_at).getHours();
      if (!isNaN(hour)) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
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

  const getPopularWorkout = async (workoutLogs: { workout_id: string }[]) => {
    try {
      if (!workoutLogs || workoutLogs.length === 0) return 'No workouts yet';

      const workoutCounts: { [key: string]: number } = {};

      workoutLogs.forEach((log) => {
        if (!log?.workout_id) return;
        workoutCounts[log.workout_id] = (workoutCounts[log.workout_id] || 0) + 1;
      });

      if (Object.keys(workoutCounts).length === 0) return 'No workouts yet';

      const popularId = Object.keys(workoutCounts).reduce((a, b) =>
        workoutCounts[a] > workoutCounts[b] ? a : b
      );

      const { data: workout } = await supabase
        .from('workouts')
        .select('name')
        .eq('id', popularId)
        .single();

      return workout?.name || 'Unknown workout';
    } catch (error) {
      return 'No data';
    }
  };

  const calculateRetentionRate = (subscriptions: { is_active: boolean; end_date: string }[]) => {
    if (!subscriptions || subscriptions.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const activeCount = subscriptions.filter(
      (sub) => sub?.is_active && sub?.end_date >= today
    ).length;
    const totalCount = subscriptions.length;

    return totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
  };

  const handlePreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Don't allow going beyond current month
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      return;
    }

    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const getMonthYearDisplay = () => {
    const date = new Date(selectedYear, selectedMonth, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: theme.colors.card,
      marginHorizontal: 24,
      borderRadius: 12,
      marginBottom: 16,
    },
    monthButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
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

      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity 
          style={styles.monthButton} 
          onPress={handlePreviousMonth}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.monthText}>{getMonthYearDisplay()}</Text>
        
        <TouchableOpacity 
          style={styles.monthButton} 
          onPress={handleNextMonth}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Revenue Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Monthly Revenue"
            value={formatRupees(Math.round(analytics.monthlyRevenue))}
            icon={<DollarSign size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
          <StatCard
            title="Total Revenue"
            value={formatRupees(Math.round(analytics.totalRevenue))}
            icon={<Target size={24} color={theme.colors.accent} />}
            color={theme.colors.accent}
          />
          <StatCard
            title="Avg per Member"
            value={formatRupees(Math.round(analytics.avgRevenuePerMember))}
            icon={<Users size={24} color={theme.colors.warning} />}
            color={theme.colors.warning}
          />
          <StatCard
            title="Pending Payments"
            value={analytics.pendingPayments + analytics.partialPayments}
            unit="members"
            icon={<AlertCircle size={24} color={theme.colors.error} />}
            color={theme.colors.error}
          />
        </View>
      </View>

      {/* Member Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Activity</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Members"
            value={analytics.totalMembers}
            unit="total"
            icon={<Users size={24} color={theme.colors.primary} />}
            color={theme.colors.primary}
          />
          <StatCard
            title="New This Month"
            value={analytics.newMembers}
            unit="members"
            icon={<TrendingUp size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
          <StatCard
            title="Active Plans"
            value={analytics.activeSubscriptions}
            unit="active"
            icon={<Target size={24} color={theme.colors.primary} />}
            color={theme.colors.primary}
          />
          <StatCard
            title="Expired Subscriptions"
            value={analytics.expiredSubscriptions}
            unit="expired"
            icon={<AlertCircle size={24} color={theme.colors.error} />}
            color={theme.colors.error}
          />
        </View>
      </View>

      {/* Workout Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Activity</Text>
        <View style={styles.statsGrid}>
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
          <StatCard
            title="Retention Rate"
            value={`${Math.round(analytics.retentionRate)}%`}
            icon={<TrendingUp size={24} color={theme.colors.success} />}
            color={theme.colors.success}
          />
          <StatCard
            title="Growth Rate"
            value={`${analytics.growthRate >= 0 ? '+' : ''}${Math.round(analytics.growthRate)}%`}
            unit="vs last month"
            icon={<Activity size={24} color={analytics.growthRate >= 0 ? theme.colors.success : theme.colors.error} />}
            color={analytics.growthRate >= 0 ? theme.colors.success : theme.colors.error}
          />
        </View>
      </View>

      {/* Revenue Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Revenue Trend</Text>
        <Text style={styles.chartSubtitle}>
          Last 6 months (Amount Paid Only)
        </Text>
        <BarChart
          data={chartData.revenue}
          width={screenWidth - 80}
          height={220}
          yAxisLabel="₹"
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
          New member registrations (Last 6 months)
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