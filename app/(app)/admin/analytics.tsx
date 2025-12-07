import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  ActivityIndicator, Dimensions 
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { 
  TrendingUp, Users, Dumbbell, DollarSign, Activity, 
  Clock, Calendar, Target 
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

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

export default function AnalyticsScreen() {
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
      datasets: [{ data: [0, 0, 0, 0, 0, 0] }],
    },
    revenue: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0] }],
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

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const isGymOwner = profile?.role === 'gym_owner';
      const gymId = profile?.gym_id;

      console.log('Fetching analytics for:', { isGymOwner, gymId });

      // Fetch members with gym filter
      let membersQuery = supabase
        .from('profiles')
        .select('created_at, id')
        .eq('role', 'member');
      
      if (isGymOwner && gymId) {
        membersQuery = membersQuery.eq('gym_id', gymId);
      }
      
      const { data: members } = await membersQuery;

      // Fetch user subscriptions for revenue calculation
      let subscriptionsQuery = supabase
        .from('user_subscriptions')
        .select(`
          amount_paid,
          payment_status,
          payment_date,
          is_active,
          start_date,
          profiles!inner(gym_id)
        `);
      
      if (isGymOwner && gymId) {
        subscriptionsQuery = subscriptionsQuery.eq('profiles.gym_id', gymId);
      }
      
      const { data: userSubscriptions } = await subscriptionsQuery;

      // Calculate revenue
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthlyRevenue = (userSubscriptions || [])
        .filter(sub => {
          if (sub.payment_status !== 'paid') return false;
          if (!sub.payment_date) return false;
          const paymentDate = new Date(sub.payment_date);
          return paymentDate.getMonth() === currentMonth && 
                 paymentDate.getFullYear() === currentYear;
        })
        .reduce((sum, sub) => sum + Number(sub.amount_paid || 0), 0);

      const totalRevenue = (userSubscriptions || [])
        .filter(sub => sub.payment_status === 'paid')
        .reduce((sum, sub) => sum + Number(sub.amount_paid || 0), 0);

      const activeSubscriptions = (userSubscriptions || [])
        .filter(sub => sub.is_active === true)
        .length;

      // Fetch workout logs
      let workoutLogsQuery = supabase
        .from('workout_logs')
        .select(`
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
      
      const { data: workoutLogs } = await workoutLogsQuery;

      // Fetch attendance
      let attendanceQuery = supabase
        .from('attendance')
        .select('check_in_time, user_id');
      
      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }
      
      const { data: attendance } = await attendanceQuery;

      // Calculate member growth
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const newMembersThisMonth = (members || []).filter(m => {
        const createdDate = new Date(m.created_at);
        return createdDate.getMonth() === currentMonth && 
               createdDate.getFullYear() === currentYear;
      }).length;
      
      const newMembersLastMonth = (members || []).filter(m => {
        const createdDate = new Date(m.created_at);
        return createdDate.getMonth() === lastMonth && 
               createdDate.getFullYear() === lastMonthYear;
      }).length;
      
      const growthRate = newMembersLastMonth > 0 
        ? ((newMembersThisMonth - newMembersLastMonth) / newMembersLastMonth * 100)
        : newMembersThisMonth > 0 ? 100 : 0;

      // Calculate average workouts per member
      const totalMembers = members?.length || 0;
      const totalWorkouts = workoutLogs?.length || 0;
      const avgWorkouts = totalMembers > 0 
        ? totalWorkouts / totalMembers 
        : 0;

      // Calculate average session duration
      const avgSessionDuration = workoutLogs && workoutLogs.length > 0
        ? workoutLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / workoutLogs.length
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
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        newMembers: newMembersThisMonth,
        avgWorkouts: Math.round(avgWorkouts * 10) / 10,
        growthRate: Math.round(growthRate),
        peakHours,
        popularWorkout,
        avgSessionDuration: Math.round(avgSessionDuration),
        retentionRate: Math.round(retentionRate),
        activeSubscriptions,
        totalCheckIns: attendance?.length || 0,
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

  const calculateMonthlyGrowth = (members: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map((_, index) => {
      return members.filter(member => {
        const memberDate = new Date(member.created_at);
        return memberDate.getMonth() === index && 
               memberDate.getFullYear() === currentYear;
      }).length;
    });

    // Ensure at least some data for chart
    const hasData = monthlyData.some(val => val > 0);
    if (!hasData) {
      monthlyData[new Date().getMonth()] = 1;
    }

    return {
      labels: months,
      datasets: [{ data: monthlyData.map(val => val || 0) }],
    };
  };

  const calculateMonthlyRevenue = (subscriptions: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map((_, index) => {
      const monthRevenue = subscriptions
        .filter(sub => {
          if (sub.payment_status !== 'paid' || !sub.payment_date) return false;
          const paymentDate = new Date(sub.payment_date);
          return paymentDate.getMonth() === index && 
                 paymentDate.getFullYear() === currentYear;
        })
        .reduce((sum, sub) => sum + Number(sub.amount_paid || 0), 0);
      
      return Math.round(monthRevenue);
    });

    // Ensure at least some data for chart
    const hasData = monthlyData.some(val => val > 0);
    if (!hasData) {
      monthlyData[new Date().getMonth()] = 100;
    }

    return {
      labels: months,
      datasets: [{ data: monthlyData.map(val => val || 0) }],
    };
  };

  const calculatePeakHours = (workoutLogs: any[]) => {
    if (!workoutLogs.length) return 'No data yet';
    
    const hourCounts: { [key: number]: number } = {};
    
    workoutLogs.forEach(log => {
      const hour = new Date(log.completed_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
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

  const getPopularWorkout = async (workoutLogs: any[], gymId: string | null | undefined) => {
    try {
      if (!workoutLogs || workoutLogs.length === 0) return 'No workouts yet';
      
      const workoutCounts: { [key: string]: { name: string; count: number } } = {};
      
      // Count workout occurrences
      workoutLogs.forEach(log => {
        const workoutId = log.workout_id;
        if (!workoutCounts[workoutId]) {
          workoutCounts[workoutId] = { name: '', count: 0 };
        }
        workoutCounts[workoutId].count++;
      });
      
      // Get most popular workout ID
      const popularId = Object.keys(workoutCounts).reduce((a, b) => 
        workoutCounts[a].count > workoutCounts[b].count ? a : b
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

  const calculateRetentionRate = (subscriptions: any[]) => {
    if (!subscriptions || subscriptions.length === 0) return 0;
    
    const activeCount = subscriptions.filter(sub => sub.is_active).length;
    const totalCount = subscriptions.length;
    
    return totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#3B82F6',
    },
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          {gym?.name ? `${gym.name} insights and metrics` : 'Performance insights and metrics'}
        </Text>
      </View>

      {/* Revenue Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Monthly Revenue"
            value={`$${analytics.monthlyRevenue.toLocaleString()}`}
            icon={<DollarSign size={24} color="#10B981" />}
            color="#10B981"
          />
          <StatCard
            title="Total Revenue"
            value={`$${analytics.totalRevenue.toLocaleString()}`}
            icon={<Target size={24} color="#8B5CF6" />}
            color="#8B5CF6"
          />
          <StatCard
            title="Active Plans"
            value={analytics.activeSubscriptions}
            unit="subscribers"
            icon={<Users size={24} color="#3B82F6" />}
            color="#3B82F6"
          />
          <StatCard
            title="Retention"
            value={`${analytics.retentionRate}%`}
            icon={<TrendingUp size={24} color="#F59E0B" />}
            color="#F59E0B"
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
            icon={<Users size={24} color="#3B82F6" />}
            color="#3B82F6"
          />
          <StatCard
            title="Growth Rate"
            value={`${analytics.growthRate >= 0 ? '+' : ''}${analytics.growthRate}%`}
            unit="vs last month"
            icon={<TrendingUp size={24} color="#10B981" />}
            color="#10B981"
          />
          <StatCard
            title="Check-ins"
            value={analytics.totalCheckIns}
            unit="total"
            icon={<Calendar size={24} color="#06B6D4" />}
            color="#06B6D4"
          />
          <StatCard
            title="Avg Workouts"
            value={analytics.avgWorkouts}
            unit="per member"
            icon={<Dumbbell size={24} color="#8B5CF6" />}
            color="#8B5CF6"
          />
        </View>
      </View>

      {/* Revenue Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Monthly Revenue</Text>
        <Text style={styles.chartSubtitle}>Revenue from paid subscriptions (USD)</Text>
        <BarChart
          data={chartData.revenue}
          width={screenWidth - 80}
          height={220}
          chartConfig={chartConfig}
          style={styles.chart}
          verticalLabelRotation={0}
          fromZero
        />
      </Card>

      {/* Member Growth Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Member Growth</Text>
        <Text style={styles.chartSubtitle}>New member registrations by month</Text>
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
          <Clock size={20} color="#6B7280" />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Peak Hours</Text>
            <Text style={styles.insightValue}>{analytics.peakHours}</Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Dumbbell size={20} color="#6B7280" />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Most Popular Workout</Text>
            <Text style={styles.insightValue}>{analytics.popularWorkout}</Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Activity size={20} color="#6B7280" />
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Average Session Duration</Text>
            <Text style={styles.insightValue}>{analytics.avgSessionDuration} minutes</Text>
          </View>
        </View>
      </Card>
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
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    color: '#111827',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#111827',
    marginBottom: 16,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});