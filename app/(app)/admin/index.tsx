import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/contexts/ThemeContext';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import {
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  Activity,
  Flame,
  Clock,
  Building2,
  Trophy,
  ChevronRight,
  Dumbbell,
  Zap,
  DollarSign,
  Calendar,
  Star,
  Award,
  Target,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  CreditCard,
  UserPlus,
} from 'lucide-react-native';
import { useGymData } from '@/hooks/useGymData';
interface Stats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  newMembersThisMonth: number;
  newMembersLastMonth: number;
  totalWorkoutLogs: number;
  totalCaloriesBurned: number;
  totalMinutesExercised: number;
  avgSessionDuration: number;
  weeklyCheckIns: number;
  monthlyCheckIns: number;
  todayCheckIns: number;
  monthlyGrowth: number;
  topPerformer: string;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
  avgRevenuePerMember: number;
  activePlans: number;
  mostPopularPlan: string;
  avgAttendanceRate: number;
  peakHours: string;
  memberRetention: number;
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

interface RevenueData {
  date: string;
  amount: number;
}

const screenWidth = Dimensions.get('window').width;
const CARD_WIDTH = screenWidth - 48;
const CARD_SPACING = 16;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const scrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0,
    newMembersThisMonth: 0,
    newMembersLastMonth: 0,
    totalWorkoutLogs: 0,
    totalCaloriesBurned: 0,
    totalMinutesExercised: 0,
    avgSessionDuration: 0,
    weeklyCheckIns: 0,
    monthlyCheckIns: 0,
    todayCheckIns: 0,
    monthlyGrowth: 0,
    topPerformer: '',
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    avgRevenuePerMember: 0,
    activePlans: 0,
    mostPopularPlan: '',
    avgAttendanceRate: 0,
    peakHours: '',
    memberRetention: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [weeklyActivity, setWeeklyActivity] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: [0, 0, 0, 0, 0, 1, 0, 0] }],
  });
  const [membershipDistribution, setMembershipDistribution] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) return;

    if (!['admin', 'gym_owner'].includes(profile.role)) {
      router.replace('/(app)/(tabs)');
      return;
    }

    fetchDashboardData();

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      let activeMembers = 0;
      let expiredMembers = 0;
      let subscriptionCounts: { [key: string]: number } = {};

      await Promise.all(
        (members || []).map(async (member) => {
          const { data: allUserSubscriptions } = await supabase
            .from('user_subscriptions')
            .select(`
              *,
              subscription:subscription_id (
                name
              )
            `)
            .eq('user_id', member.id)
            .order('created_at', { ascending: false });

          if (!allUserSubscriptions || allUserSubscriptions.length === 0) {
            return;
          }

          const activeSubscription = allUserSubscriptions.find((sub: any) => {
            const isActive = sub.is_active === true;
            const notExpired = sub.end_date && sub.end_date >= todayString;
            return isActive && notExpired;
          });

          if (activeSubscription) {
            activeMembers++;
            const planName = activeSubscription.subscription?.name || 'Unknown';
            subscriptionCounts[planName] = (subscriptionCounts[planName] || 0) + 1;
          } else {
            expiredMembers++;
          }
        })
      );

      // Member retention rate
      const memberRetention = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

      // Find most popular plan
      const mostPopularPlan = Object.keys(subscriptionCounts).reduce((a, b) =>
        subscriptionCounts[a] > subscriptionCounts[b] ? a : b, 'N/A'
      );

      // Membership distribution for pie chart
      const distributionData = Object.entries(subscriptionCounts)
        .map(([name, count], index) => ({
          name: name.length > 12 ? name.substring(0, 12) + '...' : name,
          population: count,
          color: getDistinctColor(index),
          legendFontColor: theme.colors.textSecondary,
          legendFontSize: 12,
        }));

      // New members this month and last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const newMembersThisMonth = (members || []).filter((m: any) => {
        return new Date(m.created_at) >= oneMonthAgo;
      }).length;

      const newMembersLastMonth = (members || []).filter((m: any) => {
        const created = new Date(m.created_at);
        return created >= twoMonthsAgo && created < oneMonthAgo;
      }).length;

      const monthlyGrowth = newMembersLastMonth > 0
        ? ((newMembersThisMonth - newMembersLastMonth) / newMembersLastMonth) * 100
        : newMembersThisMonth > 0 ? 100 : 0;

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

      // Fetch attendance with dynamic data
      let attendanceQuery = supabase.from('attendance').select('*');
      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }
      const { data: attendance } = await attendanceQuery;

      // Today's check-ins
      const todayCheckIns = (attendance || []).filter((a: any) => {
        const checkInDate = new Date(a.check_in_time).toISOString().split('T')[0];
        return checkInDate === todayString;
      }).length;

      // Weekly check-ins
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyCheckIns = (attendance || []).filter((a: any) => {
        return new Date(a.check_in_time) >= oneWeekAgo;
      }).length;

      // Monthly check-ins
      const monthlyCheckIns = (attendance || []).filter((a: any) => {
        return new Date(a.check_in_time) >= oneMonthAgo;
      }).length;

      // Average attendance rate
      const avgAttendanceRate = totalMembers > 0 && weeklyCheckIns > 0
        ? (weeklyCheckIns / (totalMembers * 7)) * 100
        : 0;

      // Peak hours analysis
      const hourCounts: { [key: number]: number } = {};
      (attendance || []).forEach((a: any) => {
        const hour = new Date(a.check_in_time).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const peakHour = Object.keys(hourCounts).reduce((a, b) =>
        hourCounts[Number(a)] > hourCounts[Number(b)] ? a : b, '0'
      );
      const peakHours = `${peakHour}:00 - ${Number(peakHour) + 1}:00`;

      // Dynamic weekly activity chart based on actual data
      const weeklyData = calculateWeeklyActivity(attendance || []);

      // Fetch revenue data
      let paymentsQuery = supabase.from('cash_payments').select('amount, payment_date');
      if (isGymOwner && gymId) {
        paymentsQuery = paymentsQuery.eq('gym_id', gymId);
      }
      const { data: payments } = await paymentsQuery;

      const totalRevenue = (payments || []).reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0
      );

      const monthlyRevenue = (payments || [])
        .filter((p: any) => new Date(p.payment_date) >= oneMonthAgo)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      const avgRevenuePerMember = activeMembers > 0 ? totalRevenue / activeMembers : 0;

      // Fetch pending payments
      let pendingQuery = supabase
        .from('pending_payments')
        .select('pending_amount')
        .eq('status', 'pending');
      if (isGymOwner && gymId) {
        pendingQuery = pendingQuery.eq('gym_id', gymId);
      }
      const { data: pendingPaymentsData } = await pendingQuery;
      const pendingPayments = (pendingPaymentsData || []).reduce(
        (sum, p) => sum + Number(p.pending_amount || 0),
        0
      );

      // Fetch active plans count
      let plansQuery = supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (isGymOwner && gymId) {
        plansQuery = plansQuery.eq('gym_id', gymId);
      }
      const { count: activePlans } = await plansQuery;

      // Fetch leaderboard
      const leaderboardData = await fetchLeaderboard(members || [], workoutLogs || []);
      const topPerformer = leaderboardData[0]?.full_name || 'N/A';

      // Revenue trend data (last 7 days)
      const revenueTrend = calculateRevenueTrend(payments || []);

      setStats({
        totalMembers,
        activeMembers,
        expiredMembers,
        newMembersThisMonth,
        newMembersLastMonth,
        totalWorkoutLogs,
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        totalMinutesExercised,
        avgSessionDuration: Math.round(avgSessionDuration),
        weeklyCheckIns,
        monthlyCheckIns,
        todayCheckIns,
        monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
        topPerformer,
        totalRevenue: Math.round(totalRevenue),
        monthlyRevenue: Math.round(monthlyRevenue),
        pendingPayments: Math.round(pendingPayments),
        avgRevenuePerMember: Math.round(avgRevenuePerMember),
        activePlans: activePlans || 0,
        mostPopularPlan,
        avgAttendanceRate: Math.round(avgAttendanceRate),
        peakHours,
        memberRetention: Math.round(memberRetention),
      });

      setWeeklyActivity(weeklyData);
      setLeaderboard(leaderboardData);
      setMembershipDistribution(distributionData);
      setRevenueData(revenueTrend);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  useGymData(fetchDashboardData);

  const calculateWeeklyActivity = (attendance: any[]) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    attendance.forEach((a: any) => {
      const date = new Date(a.check_in_time);
      if (date >= oneWeekAgo) {
        const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        counts[dayIndex]++;
      }
    });

    // Ensure at least minimal data for chart rendering
    const maxCount = Math.max(...counts);
    if (maxCount === 0) {
      counts[6] = 1; // Add minimal data point
    }

    return {
      labels: days,
      datasets: [{ data: counts }],
    };
  };

  const calculateRevenueTrend = (payments: any[]) => {
    const last7Days: RevenueData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const dayRevenue = payments
        .filter((p: any) => p.payment_date?.split('T')[0] === dateString)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      last7Days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        amount: dayRevenue,
      });
    }
    return last7Days;
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

    memberStats.sort((a, b) => b.total_points - a.total_points);
    memberStats.forEach((member, index) => {
      member.rank = index + 1;
    });

    return memberStats;
  };

  const getDistinctColor = (index: number) => {
    // Use very distinct colors from theme
    const distinctColors = [
      theme.colors.primary,      // Blue
      theme.colors.warning,      // Orange/Yellow
      theme.colors.error,        // Red
      theme.colors.accent,       // Can be purple/different
      '#8B5CF6',                 // Purple
      '#EC4899',                 // Pink
      theme.colors.success,      // Green (use last to avoid similar shades)
      '#14B8A6',                 // Teal
    ];
    return distinctColors[index % distinctColors.length];
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
  const successRgb = hexToRgb(theme.colors.success);
  const warningRgb = hexToRgb(theme.colors.warning);
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
      r: '5',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: theme.colors.border,
      strokeWidth: 1,
    },
  };

  const revenueChartData = {
    labels: revenueData.map(d => d.date),
    datasets: [{
      data: revenueData.map(d => d.amount || 1),
      color: (opacity = 1) => `rgba(${successRgb.r}, ${successRgb.g}, ${successRgb.b}, ${opacity})`,
      strokeWidth: 3,
    }],
  };

  const carouselData = [
    {
      id: '1',
      title: 'Member Analytics',
      subtitle: 'Growth & Engagement',
      icon: <Users size={32} color="#FFFFFF" />,
      gradient: [theme.colors.primary, theme.colors.accent],
      stats: [
        {
          label: 'Total Members',
          value: stats.totalMembers,
          icon: <Users size={20} color={theme.colors.primary} />,
          change: `+${stats.newMembersThisMonth}`,
          changeType: 'positive' as const,
        },
        {
          label: 'Active Subscriptions',
          value: stats.activeMembers,
          icon: <UserCheck size={20} color={theme.colors.success} />,
          change: `${stats.memberRetention}%`,
          changeType: 'positive' as const,
        },
        {
          label: 'Expired',
          value: stats.expiredMembers,
          icon: <UserX size={20} color={theme.colors.error} />,
          change: 'Need renewal',
          changeType: 'negative' as const,
        },
        {
          label: 'Monthly Growth',
          value: `${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth}%`,
          icon: stats.monthlyGrowth >= 0
            ? <TrendingUp size={20} color={theme.colors.success} />
            : <TrendingDown size={20} color={theme.colors.error} />,
          change: `${stats.newMembersThisMonth} new`,
          changeType: stats.monthlyGrowth >= 0 ? 'positive' as const : 'negative' as const,
        },
      ],
    },
    {
      id: '2',
      title: 'Revenue Overview',
      subtitle: 'Financial Performance',
      icon: <DollarSign size={32} color="#FFFFFF" />,
      gradient: [theme.colors.success, '#10B981'],
      stats: [
        {
          label: 'Total Revenue',
          value: `₹${(stats.totalRevenue / 1000).toFixed(1)}k`,
          icon: <DollarSign size={20} color={theme.colors.success} />,
          change: 'All time',
          changeType: 'positive' as const,
        },
        {
          label: 'This Month',
          value: `₹${(stats.monthlyRevenue / 1000).toFixed(1)}k`,
          icon: <Calendar size={20} color={theme.colors.primary} />,
          change: 'Last 30 days',
          changeType: 'positive' as const,
        },
        {
          label: 'Pending Payments',
          value: `₹${(stats.pendingPayments / 1000).toFixed(1)}k`,
          icon: <AlertCircle size={20} color={theme.colors.warning} />,
          change: 'To collect',
          changeType: 'neutral' as const,
        },
        {
          label: 'Avg/Member',
          value: `₹${(stats.avgRevenuePerMember / 1000).toFixed(1)}k`,
          icon: <BarChart3 size={20} color={theme.colors.accent} />,
          change: 'Per active',
          changeType: 'positive' as const,
        },
      ],
    },
    {
      id: '3',
      title: 'Activity Metrics',
      subtitle: 'Workout & Engagement',
      icon: <Activity size={32} color="#FFFFFF" />,
      gradient: [theme.colors.accent, '#8B5CF6'],
      stats: [
        {
          label: 'Total Sessions',
          value: stats.totalWorkoutLogs,
          icon: <Activity size={20} color={theme.colors.accent} />,
          change: 'All workouts',
          changeType: 'positive' as const,
        },
        {
          label: 'Calories Burned',
          value: `${(stats.totalCaloriesBurned / 1000).toFixed(1)}k`,
          icon: <Flame size={20} color={theme.colors.error} />,
          change: 'Total burn',
          changeType: 'positive' as const,
        },
        {
          label: 'Avg Session',
          value: `${stats.avgSessionDuration}m`,
          icon: <Clock size={20} color={theme.colors.warning} />,
          change: 'Per workout',
          changeType: 'positive' as const,
        },
        {
          label: 'Top Performer',
          value: stats.topPerformer.split(' ')[0] || 'N/A',
          icon: <Trophy size={20} color="#FFD700" />,
          change: 'Most XP',
          changeType: 'positive' as const,
        },
      ],
    },
    {
      id: '4',
      title: 'Attendance Insights',
      subtitle: 'Check-in Analytics',
      icon: <CheckCircle2 size={32} color="#FFFFFF" />,
      gradient: [theme.colors.warning, '#F59E0B'],
      stats: [
        {
          label: 'Today\'s Check-ins',
          value: stats.todayCheckIns,
          icon: <Calendar size={20} color={theme.colors.primary} />,
          change: 'Live count',
          changeType: 'positive' as const,
        },
        {
          label: 'This Week',
          value: stats.weeklyCheckIns,
          icon: <CheckCircle2 size={20} color={theme.colors.success} />,
          change: 'Last 7 days',
          changeType: 'positive' as const,
        },
        {
          label: 'This Month',
          value: stats.monthlyCheckIns,
          icon: <BarChart3 size={20} color={theme.colors.accent} />,
          change: 'Last 30 days',
          changeType: 'positive' as const,
        },
        {
          label: 'Peak Hours',
          value: stats.peakHours,
          icon: <Clock size={20} color={theme.colors.warning} />,
          change: 'Busiest time',
          changeType: 'neutral' as const,
        },
      ],
    },
  ];


  // Auto-scroll carousel with error handling
  useEffect(() => {
    const interval = setInterval(() => {
      if (carouselRef.current && !refreshing && carouselData.length > 0) {
        const nextIndex = (currentIndex + 1) % carouselData.length;
        try {
          carouselRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
            viewPosition: 0.5,
          });
          setCurrentIndex(nextIndex);
        } catch (error) {
          console.log('Scroll error:', error);
        }
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [currentIndex, refreshing, carouselData.length]);

  const renderCarouselCard = ({ item }: { item: typeof carouselData[0] }) => (
    <Animated.View
      style={[
        styles.carouselCard,
        {
          transform: [
            {
              scale: scrollX.interpolate({
                inputRange: [
                  (carouselData.indexOf(item) - 1) * (CARD_WIDTH + CARD_SPACING),
                  carouselData.indexOf(item) * (CARD_WIDTH + CARD_SPACING),
                  (carouselData.indexOf(item) + 1) * (CARD_WIDTH + CARD_SPACING),
                ],
                outputRange: [0.9, 1, 0.9],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.carouselCardHeader, { backgroundColor: item.gradient[0] }]}>
        <View style={styles.carouselHeaderContent}>
          <View style={styles.carouselIconContainer}>
            {item.icon}
          </View>
          <View style={styles.carouselHeaderText}>
            <Text style={styles.carouselCardTitle}>{item.title}</Text>
            <Text style={styles.carouselCardSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </View>
      <View style={styles.carouselCardBody}>
        {item.stats.map((stat, index) => (
          <View key={index} style={styles.carouselStatItem}>
            <View style={styles.carouselStatLeft}>
              <View style={styles.carouselStatIconWrapper}>{stat.icon}</View>
              <View style={styles.carouselStatContent}>
                <Text style={styles.carouselStatLabel}>{stat.label}</Text>
                <Text style={styles.carouselStatValue}>{stat.value}</Text>
              </View>
            </View>
            <View style={[
              styles.changeIndicator,
              stat.changeType === 'positive' && styles.changePositive,
              stat.changeType === 'negative' && styles.changeNegative,
              stat.changeType === 'neutral' && styles.changeNeutral,
            ]}>
              <Text style={[
                styles.changeText,
                stat.changeType === 'positive' && styles.changeTextPositive,
                stat.changeType === 'negative' && styles.changeTextNegative,
                stat.changeType === 'neutral' && styles.changeTextNeutral,
              ]}>
                {stat.change}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  const displayedLeaderboard = showAllLeaderboard ? leaderboard : leaderboard.slice(0, 5);

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
      marginTop: 16,
      fontWeight: '600',
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 20 : 28,
      paddingBottom: 28,
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginBottom: 14,
    },
    gymIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.8,
      marginBottom: 4,
    },
    headerLocation: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    headerSubtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      fontWeight: '500',
    },
    quickStatsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    quickStat: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    quickStatValue: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 6,
    },
    quickStatLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
      textAlign: 'center',
    },
    carouselContainer: {
      marginTop: 20,
      marginBottom: 20,
    },
    carouselCard: {
      width: CARD_WIDTH,
      marginHorizontal: CARD_SPACING / 2,
      borderRadius: 24,
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    carouselCardHeader: {
      padding: 24,
      paddingBottom: 20,
    },
    carouselHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    carouselIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    carouselHeaderText: {
      flex: 1,
    },
    carouselCardTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    carouselCardSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.85)',
      fontWeight: '600',
    },
    carouselCardBody: {
      padding: 24,
      paddingTop: 20,
      gap: 18,
    },
    carouselStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    carouselStatLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    carouselStatIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    carouselStatContent: {
      flex: 1,
    },
    carouselStatLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      marginBottom: 4,
    },
    carouselStatValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    changeIndicator: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    changePositive: {
      backgroundColor: theme.colors.success + '15',
    },
    changeNegative: {
      backgroundColor: theme.colors.error + '15',
    },
    changeNeutral: {
      backgroundColor: theme.colors.textSecondary + '15',
    },
    changeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    changeTextPositive: {
      color: theme.colors.success,
    },
    changeTextNegative: {
      color: theme.colors.error,
    },
    changeTextNeutral: {
      color: theme.colors.textSecondary,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
      gap: 8,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
      transition: 'all 0.3s',
    },
    paginationDotActive: {
      width: 32,
      backgroundColor: theme.colors.primary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginTop: 12,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
    chartCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 24,
      borderRadius: 24,
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    chartTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    chartSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 20,
      fontWeight: '500',
    },
    chart: {
      borderRadius: 16,
      marginVertical: 8,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
      paddingHorizontal: 24,
    },
    miniStatCard: {
      flex: 1,
      backgroundColor: theme.colors.card,
      padding: 18,
      borderRadius: 18,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    miniStatValue: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 10,
      letterSpacing: -0.5,
    },
    miniStatLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 6,
      fontWeight: '600',
      textAlign: 'center',
    },
    leaderboardCard: {
      marginHorizontal: 24,
      marginBottom: 32,
      padding: 24,
      borderRadius: 24,
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    leaderboardRank: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    rankNumberContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankNumber: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.textSecondary,
    },
    goldRank: {
      backgroundColor: '#FFD700',
    },
    silverRank: {
      backgroundColor: '#C0C0C0',
    },
    bronzeRank: {
      backgroundColor: '#CD7F32',
    },
    leaderboardAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
      borderWidth: 2,
      borderColor: theme.colors.primary + '40',
    },
    avatarText: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    leaderboardInfo: {
      flex: 1,
    },
    leaderboardName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    leaderboardStats: {
      flexDirection: 'row',
      gap: 18,
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    statBadgeText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    leaderboardPoints: {
      alignItems: 'flex-end',
      gap: 8,
    },
    pointsValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    levelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: theme.colors.warning + '20',
    },
    levelText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.warning,
    },
    viewMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: theme.colors.primary + '12',
      marginTop: 16,
      gap: 8,
    },
    viewMoreText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    emptyLeaderboard: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 16,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 22,
    },
    leaderboardScrollContainer: {
      maxHeight: 450,
    },
    gymLogo: {
      width: 64,
      height: 64,
      borderRadius: 50,
    },
    
    fallbackText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    
  });

  if (isLoading && !refreshing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim }]}
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
        {/* Enhanced Header */}
        <Animated.View style={[styles.header, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.headerRow}>
            <View style={styles.gymIcon}>
              {gym?.logo_url ? (
                <Image
                  source={{ uri: gym.logo_url }}
                  style={styles.gymLogo}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.fallbackText}>
                  {gym?.name?.charAt(0).toUpperCase() || 'G'}
                </Text>
              )}
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{gym?.name || 'Creators Fitness Hub'}</Text>
              {gym?.location && (
                <Text style={styles.headerLocation}>📍 {gym.location}</Text>
              )}
            </View>
          </View>



        </Animated.View>

        {/* Auto-Scrolling Animated Carousel */}
        <View style={styles.carouselContainer}>
          <Animated.FlatList
            ref={carouselRef}
            data={carouselData}
            renderItem={renderCarouselCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            // ✅ ADD THESE THREE PROPS:
            getItemLayout={(data, index) => ({
              length: CARD_WIDTH + CARD_SPACING,
              offset: (CARD_WIDTH + CARD_SPACING) * index,
              index,
            })}
            initialScrollIndex={0}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 100));
              wait.then(() => {
                carouselRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
            // END OF NEW PROPS
            contentContainerStyle={{
              paddingHorizontal: 24 - CARD_SPACING / 2,
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING)
              );
              setCurrentIndex(index);
            }}
          />

          {/* Animated Pagination Dots */}
          <View style={styles.paginationContainer}>
            {carouselData.map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Mini Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.miniStatCard}>
            <Target size={24} color={theme.colors.accent} />
            <Text style={styles.miniStatValue}>{stats.activePlans}</Text>
            <Text style={styles.miniStatLabel}>Active Plans</Text>
          </View>
          <View style={styles.miniStatCard}>
            <Star size={24} color={theme.colors.warning} />
            <Text style={styles.miniStatValue}>{stats.avgAttendanceRate}%</Text>
            <Text style={styles.miniStatLabel}>Attendance</Text>
          </View>
          <View style={styles.miniStatCard}>
            <CreditCard size={24} color={theme.colors.error} />
            <Text style={styles.miniStatValue}>₹{(stats.pendingPayments / 1000).toFixed(0)}k</Text>
            <Text style={styles.miniStatLabel}>Pending</Text>
          </View>
        </View>

        {/* Weekly Activity Chart */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>📊 Weekly Activity</Text>
            <Text style={styles.sectionSubtitle}>Member check-ins • Last 7 days</Text>
          </View>
        </View>
        <Card style={styles.chartCard}>
          <LineChart
            data={weeklyActivity}
            width={screenWidth - 96}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            bezier
            fromZero
            withDots
            withInnerLines
            withOuterLines
            withVerticalLines
            withHorizontalLines
          />
        </Card>

        {/* Revenue Trend */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>💰 Revenue Trend</Text>
            <Text style={styles.sectionSubtitle}>Daily revenue • Last 7 days</Text>
          </View>
        </View>
        <Card style={styles.chartCard}>
          <LineChart
            data={revenueChartData}
            width={screenWidth - 96}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(${successRgb.r}, ${successRgb.g}, ${successRgb.b}, ${opacity})`,
            }}
            style={styles.chart}
            bezier
            fromZero
            withDots
            withShadow
            withInnerLines
            withOuterLines
          />
        </Card>

        {/* Membership Distribution */}
        {membershipDistribution.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>📈 Plan Distribution</Text>
                <Text style={styles.sectionSubtitle}>Active subscriptions breakdown</Text>
              </View>
            </View>
            <Card style={styles.chartCard}>
              <PieChart
                data={membershipDistribution}
                width={screenWidth - 96}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </Card>
          </>
        )}

        {/* Top Performers Leaderboard */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>🏆 Leaderboard</Text>
            <Text style={styles.sectionSubtitle}>Top members by XP points</Text>
          </View>
        </View>
        <Card style={styles.leaderboardCard}>
          {leaderboard.length > 0 ? (
            <>
              <ScrollView
                style={showAllLeaderboard ? styles.leaderboardScrollContainer : undefined}
                nestedScrollEnabled={showAllLeaderboard}
              >
                {displayedLeaderboard.map((member) => (
                  <View key={member.id} style={styles.leaderboardItem}>
                    <View
                      style={[
                        styles.leaderboardRank,
                        member.rank === 1 && styles.goldRank,
                        member.rank === 2 && styles.silverRank,
                        member.rank === 3 && styles.bronzeRank,
                        member.rank > 3 && styles.rankNumberContainer,
                      ]}
                    >
                      {member.rank <= 3 ? (
                        <Trophy size={24} color="#FFFFFF" />
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
                          <Dumbbell size={14} color={theme.colors.accent} />
                          <Text style={styles.statBadgeText}>
                            {member.totalWorkouts}
                          </Text>
                        </View>
                        <View style={styles.statBadge}>
                          <Flame size={14} color={theme.colors.error} />
                          <Text style={styles.statBadgeText}>
                            {(member.totalCalories / 1000).toFixed(1)}k
                          </Text>
                        </View>
                        <View style={styles.statBadge}>
                          <Zap size={14} color={theme.colors.warning} />
                          <Text style={styles.statBadgeText}>
                            {member.current_streak}d
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.leaderboardPoints}>
                      <Text style={styles.pointsValue}>
                        {member.total_points}
                      </Text>
                      <View style={styles.levelBadge}>
                        <Text style={styles.levelText}>Lv {member.level}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {leaderboard.length > 5 && (
                <TouchableOpacity
                  style={styles.viewMoreButton}
                  onPress={() => setShowAllLeaderboard(!showAllLeaderboard)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewMoreText}>
                    {showAllLeaderboard ? 'Show Less' : `View All ${leaderboard.length} Members`}
                  </Text>
                  <ChevronRight
                    size={20}
                    color={theme.colors.primary}
                    style={{
                      transform: [{ rotate: showAllLeaderboard ? '90deg' : '0deg' }]
                    }}
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyLeaderboard}>
              <Trophy size={64} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>
                No member activity yet.{'\n'}Start tracking workouts to see rankings!
              </Text>
            </View>
          )}
        </Card>
      </Animated.ScrollView>
    </SafeAreaWrapper>
  );
}