import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRupees } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { LineChart, BarChart, ProgressChart } from 'react-native-chart-kit';
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
  CheckCircle2,
  UserCheck,
  UserX,
  Flame,
  TrendingDown,
  CreditCard,
  Award,
  BarChart3,

  ArrowUpCircle,
  ArrowDownCircle,
  ChevronDown,
  Plus,
  X,
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
  monthlyCheckIns: number;
  totalWorkoutLogs: number;
  totalCaloriesBurned: number;
  completionRate: number;
  revenueGrowth: number;
  memberChurnRate: number;
  totalIncome: number;
  monthlyIncome: number;
  totalExpense: number;
  monthlyExpense: number;
  netProfit: number;
  monthlyNetProfit: number;
}

interface IncomeItem {
  id: string;
  name: string;
  type: string;
  amount: number;
  payment_method: string;
  description: string;
  income_date: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  type: string;
  amount: number;
  payment_method: string;
  description: string;
  expense_date: string;
}

const screenWidth = Dimensions.get('window').width;
const CARD_WIDTH = screenWidth - 48;
const CARD_SPACING = 16;

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const scrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
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
    monthlyCheckIns: 0,
    totalWorkoutLogs: 0,
    totalCaloriesBurned: 0,
    completionRate: 0,
    revenueGrowth: 0,
    memberChurnRate: 0,
    totalIncome: 0,        // ✅ Make sure these are here
    monthlyIncome: 0,      // ✅
    totalExpense: 0,       // ✅
    monthlyExpense: 0,     // ✅
    netProfit: 0,          // ✅
    monthlyNetProfit: 0,   // ✅
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
    checkIns: {
      labels: [''],
      datasets: [{ data: [1] }],
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllExpense, setShowAllExpense] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [incomeList, setIncomeList] = useState<IncomeItem[]>([]);
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    amount: '',
    payment_method: '',
    description: '',
  });

  const incomeTypes = ['product', 'service', 'other'];
  const expenseTypes = ['rent', 'maintenance', 'salary', 'equipment', 'other'];

  useEffect(() => {
    if (profile) {
      fetchAnalytics();

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [profile, selectedMonth, selectedYear]);

  // Auto-scroll carousel
  useEffect(() => {
    if (isLoading || refreshing) return;

    const interval = setInterval(() => {
      if (carouselRef.current) {
        const nextIndex = (currentIndex + 1) % 3;
        try {
          carouselRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
            viewPosition: 0.5,
          });
          setCurrentIndex(nextIndex);
        } catch (error) {
          // Silently handle scroll errors
        }
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [currentIndex, refreshing, isLoading]);

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

      // Fetch user subscriptions
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

      // Fetch income
      let incomeQuery = supabase.from('income').select('*').order('income_date', { ascending: false });
      if (isGymOwner && gymId) {
        incomeQuery = incomeQuery.eq('gym_id', gymId);
      }
      const { data: incomeData } = await incomeQuery;

      // Fetch expenses
      let expenseQuery = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      if (isGymOwner && gymId) {
        expenseQuery = expenseQuery.eq('gym_id', gymId);
      }
      const { data: expenseData } = await expenseQuery;

      setIncomeList(incomeData || []);
      setExpenseList(expenseData || []);

      // Calculate income metrics
      const totalIncome = (incomeData || []).reduce((sum, item) => sum + ensureValidNumber(item.amount, 0), 0);
      const monthlyIncome = (incomeData || [])
        .filter((item) => {
          const date = new Date(item.income_date);
          return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        })
        .reduce((sum, item) => sum + ensureValidNumber(item.amount, 0), 0);

      // Calculate expense metrics
      const totalExpense = (expenseData || []).reduce((sum, item) => sum + ensureValidNumber(item.amount, 0), 0);
      const monthlyExpense = (expenseData || [])
        .filter((item) => {
          const date = new Date(item.expense_date);
          return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
        })
        .reduce((sum, item) => sum + ensureValidNumber(item.amount, 0), 0);

      // Net profit
      // Calculate revenue metrics FIRST (using only user_subscriptions)


      // Calculate revenue metrics FIRST (using only user_subscriptions)
      const monthlyRevenue = calculateMonthlyRevenueAmount(
        userSubscriptions || [],
        selectedMonth,
        selectedYear
      );

      const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const prevMonthRevenue = calculateMonthlyRevenueAmount(
        userSubscriptions || [],
        prevMonth,
        prevYear
      );

      const revenueGrowth = prevMonthRevenue > 0
        ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
        : monthlyRevenue > 0 ? 100 : 0;

      const totalRevenue = calculateTotalRevenueAmount(userSubscriptions || []);

      // Net profit (NOW we can calculate this)
      const netProfit = totalRevenue + totalIncome - totalExpense;
      const monthlyNetProfit = monthlyRevenue + monthlyIncome - monthlyExpense;

      // Member metrics


      // Member metrics
      const totalMembers = members?.length || 0;
      const newMembers = (members || []).filter((m) => {
        if (!m?.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === selectedMonth &&
          createdDate.getFullYear() === selectedYear
        );
      }).length;

      const prevMonthMembers = (members || []).filter((m) => {
        if (!m?.created_at) return false;
        const createdDate = new Date(m.created_at);
        return (
          createdDate.getMonth() === prevMonth &&
          createdDate.getFullYear() === prevYear
        );
      }).length;

      const growthRate = prevMonthMembers > 0
        ? ((newMembers - prevMonthMembers) / prevMonthMembers) * 100
        : newMembers > 0 ? 100 : 0;

      // Calculate churn rate (members who expired this month)
      const today = new Date().toISOString().split('T')[0];
      const expiredThisMonth = (userSubscriptions || []).filter((sub) => {
        if (!sub?.end_date) return false;
        const endDate = new Date(sub.end_date);
        return (
          endDate.getMonth() === selectedMonth &&
          endDate.getFullYear() === selectedYear &&
          endDate < new Date()
        );
      }).length;

      const memberChurnRate = totalMembers > 0 ? (expiredThisMonth / totalMembers) * 100 : 0;

      // Subscription metrics
      const activeSubscriptions = (userSubscriptions || []).filter(
        (sub) => sub?.is_active && sub?.end_date >= today
      ).length;

      const expiredSubscriptions = (userSubscriptions || []).filter(
        (sub) => !sub?.is_active || (sub?.end_date && sub.end_date < today)
      ).length;

      const pendingPayments = (userSubscriptions || []).filter(
        (sub) => sub?.payment_status === 'pending'
      ).length;

      const partialPayments = (userSubscriptions || []).filter(
        (sub) => sub?.payment_status === 'partial' && ensureValidNumber(sub?.pending_amount, 0) > 0
      ).length;

      const retentionRate = totalMembers > 0 ? (activeSubscriptions / totalMembers) * 100 : 0;

      // Workout metrics
      let workoutLogsQuery = supabase.from('workout_logs').select('*');
      if (isGymOwner && gymId) {
        workoutLogsQuery = workoutLogsQuery.in(
          'user_id',
          (members || []).map(m => m.id)
        );
      }
      const { data: workoutLogs } = await workoutLogsQuery;

      const totalWorkoutLogs = workoutLogs?.length || 0;
      const avgWorkouts = totalMembers > 0 ? totalWorkoutLogs / totalMembers : 0;

      const totalCaloriesBurned = workoutLogs?.reduce(
        (sum, log) => sum + ensureValidNumber(log?.calories_burned, 0),
        0
      ) || 0;

      const avgSessionDuration = workoutLogs && workoutLogs.length > 0
        ? workoutLogs.reduce(
          (sum, log) => sum + ensureValidNumber(log?.duration_minutes, 0),
          0
        ) / workoutLogs.length
        : 0;

      // Attendance metrics
      let attendanceQuery = supabase.from('attendance').select('*');
      if (isGymOwner && gymId) {
        attendanceQuery = attendanceQuery.eq('gym_id', gymId);
      }
      const { data: attendance } = await attendanceQuery;

      const totalCheckIns = attendance?.length || 0;

      const monthlyCheckIns = (attendance || []).filter((a) => {
        if (!a?.check_in_time) return false;
        const checkInDate = new Date(a.check_in_time);
        return (
          checkInDate.getMonth() === selectedMonth &&
          checkInDate.getFullYear() === selectedYear
        );
      }).length;

      const completionRate = totalMembers > 0 && monthlyCheckIns > 0
        ? (monthlyCheckIns / (totalMembers * 30)) * 100
        : 0;

      const peakHours = calculatePeakHours(attendance || []);
      const popularWorkout = await getPopularWorkout(workoutLogs || []);
      const avgRevenuePerMember = totalMembers > 0 ? totalRevenue / totalMembers : 0;

      // Generate chart data
      const memberGrowthData = calculateMonthlyGrowth(members || []);
      const revenueData = calculateMonthlyRevenueChart(userSubscriptions || []);
      const checkInsData = calculateMonthlyCheckIns(attendance || []);

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
        totalCheckIns: ensureValidNumber(totalCheckIns, 0),
        pendingPayments: ensureValidNumber(pendingPayments, 0),
        partialPayments: ensureValidNumber(partialPayments, 0),
        avgRevenuePerMember: ensureValidNumber(avgRevenuePerMember, 0),
        monthlyCheckIns: ensureValidNumber(monthlyCheckIns, 0),
        totalWorkoutLogs: ensureValidNumber(totalWorkoutLogs, 0),
        totalCaloriesBurned: ensureValidNumber(totalCaloriesBurned, 0),
        completionRate: ensureValidNumber(completionRate, 0),
        revenueGrowth: ensureValidNumber(revenueGrowth, 0),
        memberChurnRate: ensureValidNumber(memberChurnRate, 0),
        totalIncome: ensureValidNumber(totalIncome, 0),
        monthlyIncome: ensureValidNumber(monthlyIncome, 0),
        totalExpense: ensureValidNumber(totalExpense, 0),
        monthlyExpense: ensureValidNumber(monthlyExpense, 0),
        netProfit: ensureValidNumber(netProfit, 0),
        monthlyNetProfit: ensureValidNumber(monthlyNetProfit, 0),
      });

      setChartData({
        memberGrowth: memberGrowthData,
        revenue: revenueData,
        checkIns: checkInsData,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMonthlyRevenueAmount = (
    subscriptions: any[],
    month: number,
    year: number
  ): number => {
    return (subscriptions || [])
      .filter((sub) => {
        if (!sub?.paid_amount || sub.paid_amount === 0) return false;
        // Check payment_date first, fall back to start_date or created_at
        const dateToCheck = sub.payment_date || sub.start_date || sub.created_at;
        if (!dateToCheck) return false;

        const paymentDate = new Date(dateToCheck);
        return paymentDate.getMonth() === month && paymentDate.getFullYear() === year;
      })
      .reduce((sum, sub) => sum + ensureValidNumber(sub.paid_amount, 0), 0);
  };

  const calculateTotalRevenueAmount = (subscriptions: any[]): number => {
    return (subscriptions || []).reduce(
      (sum, sub) => sum + ensureValidNumber(sub.paid_amount, 0),
      0
    );
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
        return memberDate.getMonth() === targetMonth && memberDate.getFullYear() === targetYear;
      }).length;
    });
    return { labels, datasets: [{ data: ensureValidChartData(monthlyData) }] };
  };

  const calculateMonthlyRevenueChart = (subscriptions: any[]) => {
    const labels = getMonthLabels();
    const monthlyData = labels.map((_, index) => {
      const targetDate = new Date(selectedYear, selectedMonth - (5 - index), 1);
      return calculateMonthlyRevenueAmount(
        subscriptions,
        targetDate.getMonth(),
        targetDate.getFullYear()
      );
    });
    return { labels, datasets: [{ data: ensureValidChartData(monthlyData) }] };
  };

  const calculateMonthlyCheckIns = (attendance: any[]) => {
    const labels = getMonthLabels();
    const monthlyData = labels.map((_, index) => {
      const targetDate = new Date(selectedYear, selectedMonth - (5 - index), 1);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();
      return (attendance || []).filter((a) => {
        if (!a?.check_in_time) return false;
        const checkInDate = new Date(a.check_in_time);
        return checkInDate.getMonth() === targetMonth && checkInDate.getFullYear() === targetYear;
      }).length;
    });
    return { labels, datasets: [{ data: ensureValidChartData(monthlyData) }] };
  };

  const calculatePeakHours = (attendance: any[]) => {
    if (!attendance || attendance.length === 0) return 'No data';
    const hourCounts: { [key: number]: number } = {};
    attendance.forEach((a) => {
      if (!a?.check_in_time) return;
      const hour = new Date(a.check_in_time).getHours();
      if (!isNaN(hour)) hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    if (Object.keys(hourCounts).length === 0) return 'No data';
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
      if (!workoutLogs || workoutLogs.length === 0) return 'No data';
      const workoutCounts: { [key: string]: number } = {};
      workoutLogs.forEach((log) => {
        if (!log?.workout_id) return;
        workoutCounts[log.workout_id] = (workoutCounts[log.workout_id] || 0) + 1;
      });
      if (Object.keys(workoutCounts).length === 0) return 'No data';
      const popularId = Object.keys(workoutCounts).reduce((a, b) =>
        workoutCounts[a] > workoutCounts[b] ? a : b
      );
      const { data: workout } = await supabase
        .from('workouts')
        .select('name')
        .eq('id', popularId)
        .single();
      return workout?.name || 'Unknown';
    } catch {
      return 'No data';
    }
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
    if (selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth()) {
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
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 59, g: 130, b: 246 };
  };

  const primaryRgb = hexToRgb(theme.colors.primary);
  const successRgb = hexToRgb(theme.colors.success);
  const textSecondaryRgb = hexToRgb(theme.colors.textSecondary);

  const chartConfig = {
    backgroundColor: theme.colors.card,
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${textSecondaryRgb.r}, ${textSecondaryRgb.g}, ${textSecondaryRgb.b}, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: '5', strokeWidth: '2', stroke: theme.colors.primary },
    propsForBackgroundLines: { strokeDasharray: '', stroke: theme.colors.border, strokeWidth: 1 },
  };

  const carouselData = [
    {
      id: '1',
      title: 'Revenue Overview',
      subtitle: 'Financial Performance',
      icon: <DollarSign size={28} color="#FFFFFF" />,
      color: theme.colors.success,
      stats: [
        {
          label: 'Monthly Revenue',
          value: `₹${(analytics.monthlyRevenue / 1000).toFixed(1)}k`,
          icon: <DollarSign size={18} color={theme.colors.success} />,
          change: `${analytics.revenueGrowth >= 0 ? '+' : ''}${analytics.revenueGrowth.toFixed(1)}%`,
          changeType: analytics.revenueGrowth >= 0 ? 'positive' as const : 'negative' as const,
        },
        {
          label: 'Total Revenue',
          value: `₹${(analytics.totalRevenue / 1000).toFixed(1)}k`,
          icon: <CheckCircle2 size={18} color={theme.colors.accent} />,
          change: 'All time',
          changeType: 'positive' as const,
        },
        {
          label: 'Monthly Expense',
          value: `₹${(analytics.monthlyExpense / 1000).toFixed(1)}k`,
          icon: <ArrowDownCircle size={18} color={theme.colors.error} />,
          change: 'This month',
          changeType: 'negative' as const,
        },
        {
          label: 'Monthly Income ',
          value: `₹${(analytics.monthlyNetProfit / 1000).toFixed(1)}k`,
          icon: <TrendingUp size={18} color={theme.colors.success} />,
          change: 'This month',
          changeType: analytics.monthlyNetProfit >= 0 ? 'positive' as const : 'negative' as const,
        },
      ],
    },
    {
      id: '2',
      title: 'Member Activity',
      subtitle: 'Growth & Engagement',
      icon: <Users size={28} color="#FFFFFF" />,
      color: theme.colors.primary,
      stats: [
        {
          label: 'Total Members',
          value: analytics.totalMembers,
          icon: <Users size={18} color={theme.colors.primary} />,
          change: `${analytics.retentionRate.toFixed(0)}% active`,
          changeType: 'positive' as const,
        },
        {
          label: 'New This Month',
          value: analytics.newMembers,
          icon: <UserCheck size={18} color={theme.colors.success} />,
          change: `${analytics.growthRate >= 0 ? '+' : ''}${analytics.growthRate.toFixed(1)}%`,
          changeType: analytics.growthRate >= 0 ? 'positive' as const : 'negative' as const,
        },
        {
          label: 'Active Plans',
          value: analytics.activeSubscriptions,
          icon: <CheckCircle2 size={18} color={theme.colors.success} />,
          change: 'Subscribed',
          changeType: 'positive' as const,
        },
        {
          label: 'Churn Rate',
          value: `${analytics.memberChurnRate.toFixed(1)}%`,
          icon: <UserX size={18} color={theme.colors.error} />,
          change: 'This month',
          changeType: 'neutral' as const,
        },
      ],
    },
    {
      id: '3',
      title: 'Workout Activity',
      subtitle: 'Performance Metrics',
      icon: <Activity size={28} color="#FFFFFF" />,
      color: theme.colors.accent,
      stats: [
        {
          label: 'Total Sessions',
          value: analytics.totalWorkoutLogs,
          icon: <Activity size={18} color={theme.colors.accent} />,
          change: 'All time',
          changeType: 'positive' as const,
        },
        {
          label: 'Monthly Check-ins',
          value: analytics.monthlyCheckIns,
          icon: <Calendar size={18} color={theme.colors.primary} />,
          change: 'This month',
          changeType: 'positive' as const,
        },
        {
          label: 'Avg Session',
          value: `${Math.round(analytics.avgSessionDuration)}m`,
          icon: <Clock size={18} color={theme.colors.warning} />,
          change: 'Per workout',
          changeType: 'positive' as const,
        },
        {
          label: 'Calories Burned',
          value: `${(analytics.totalCaloriesBurned / 1000).toFixed(1)}k`,
          icon: <Flame size={18} color={theme.colors.error} />,
          change: 'Total',
          changeType: 'positive' as const,
        },
      ],
    },
  ];

  const renderCarouselCard = ({ item }: { item: typeof carouselData[0] }) => (
    <Animated.View style={[styles.carouselCard]}>
      <View style={[styles.carouselCardHeader, { backgroundColor: item.color }]}>
        <View style={styles.carouselHeaderContent}>
          <View style={styles.carouselIconContainer}>{item.icon}</View>
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
            <View
              style={[
                styles.changeIndicator,
                stat.changeType === 'positive' && styles.changePositive,
                stat.changeType === 'negative' && styles.changeNegative,
                stat.changeType === 'neutral' && styles.changeNeutral,
              ]}
            >
              <Text
                style={[
                  styles.changeText,
                  stat.changeType === 'positive' && styles.changeTextPositive,
                  stat.changeType === 'negative' && styles.changeTextNegative,
                  stat.changeType === 'neutral' && styles.changeTextNeutral,
                ]}
              >
                {stat.change}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );

  const openModal = (type: 'income' | 'expense') => {
    setModalType(type);
    setFormData({
      name: '',
      type: '',
      amount: '',
      payment_method: '',
      description: '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.type || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const tableName = modalType === 'income' ? 'income' : 'expenses';
      const dateField = modalType === 'income' ? 'income_date' : 'expense_date';

      const { error } = await supabase.from(tableName).insert({
        gym_id: profile?.gym_id,
        name: formData.name,
        type: formData.type,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        description: formData.description,
        [dateField]: new Date().toISOString(),
        created_by: profile?.id,
      });

      if (error) throw error;

      setModalVisible(false);
      await fetchAnalytics();
    } catch (error) {
      console.error('Error adding entry:', error);
      alert('Failed to add entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedIncome = showAllIncome ? incomeList : incomeList.slice(0, 5);
  const displayedExpense = showAllExpense ? expenseList : expenseList.slice(0, 5);

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
      paddingBottom: 20,
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.8,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: theme.colors.card,
      marginHorizontal: 24,
      borderRadius: 16,
      marginTop: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    viewMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '12',
      marginTop: 16,
      gap: 8,
    },
    viewMoreText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    monthButton: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    carouselContainer: {
      marginBottom: 24,
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
      marginBottom:18,
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
      width: 52,
      height: 52,
      borderRadius: 26,
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
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    carouselCardSubtitle: {
      fontSize: 13,
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
      width: 42,
      height: 42,
      borderRadius: 12,
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
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    tabContainer: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    activeTab: {
      backgroundColor: theme.colors.primary + '15',
      borderColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    activeTabText: {
      color: theme.colors.primary,
    },
    listCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    listItem: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    listItemTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    listItemLeft: {
      flex: 1,
      gap: 4,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    itemType: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    itemAmount: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    itemDescription: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    itemDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 8,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    dropdownButton: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dropdownButtonText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    dropdownPlaceholder: {
      color: theme.colors.textSecondary,
    },
    dropdown: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxHeight: 200,
    },
    dropdownItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    dropdownItemText: {
      fontSize: 16,
      color: theme.colors.text,
      textTransform: 'capitalize',
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
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
    },
    paginationDotActive: {
      width: 32,
      backgroundColor: theme.colors.primary,
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
    sectionHeader: {
      paddingHorizontal: 24,
      marginTop: 8,
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
      marginTop: 4,
    },
    insightsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    insightCard: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: theme.colors.card,
      padding: 18,
      borderRadius: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    insightHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    insightLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    insightValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    insightChange: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      marginTop: 4,
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
    <SafeAreaWrapper >
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Analytics</Text>
              <Text style={styles.subtitle}>
                {gym?.name ? `${gym.name} insights and metrics` : 'Performance insights and metrics'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openModal('income')}
              activeOpacity={0.7}
            >
              <Plus size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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

        {/* Carousel Cards */}
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

        {/* Revenue Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💰 Revenue Trend</Text>
          <Text style={styles.sectionSubtitle}>Monthly revenue • Last 6 months</Text>
        </View>
        <Card style={styles.chartCard}>
          <BarChart
            data={chartData.revenue}
            width={screenWidth - 96}
            height={220}
            yAxisLabel="₹"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
            fromZero
          />
        </Card>

        {/* Member Growth Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Member Growth</Text>
          <Text style={styles.sectionSubtitle}>New registrations • Last 6 months</Text>
        </View>
        <Card style={styles.chartCard}>
          <LineChart
            data={chartData.memberGrowth}
            width={screenWidth - 96}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            bezier
            fromZero
            withDots
            withInnerLines
            withOuterLines
          />
        </Card>

        {/* Income & Expense Tabs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💸 Income & Expenses</Text>
          <Text style={styles.sectionSubtitle}>Financial transactions</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'income' && styles.activeTab]}
            onPress={() => setActiveTab('income')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'income' && styles.activeTabText]}>
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expense' && styles.activeTab]}
            onPress={() => setActiveTab('expense')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'expense' && styles.activeTabText]}>
              Expenses
            </Text>
          </TouchableOpacity>
        </View>

        {/* Income/Expense List */}
        <Card style={styles.listCard}>
          {activeTab === 'income' ? (
            incomeList.length > 0 ? (
              <>
                {displayedIncome.map((item, index) => (
                  <View key={item.id} style={[styles.listItem, index === displayedIncome.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.listItemTop}>
                      <View style={styles.listItemLeft}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemType}>{item.type}</Text>
                        {item.description && (
                          <Text style={styles.itemDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                        )}
                        <Text style={styles.itemDate}>
                          {new Date(item.income_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={[styles.itemAmount, { color: theme.colors.success }]}>
                        ₹{item.amount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
                {incomeList.length > 5 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => setShowAllIncome(!showAllIncome)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewMoreText}>
                      {showAllIncome ? 'Show Less' : `View All ${incomeList.length} Items`}
                    </Text>
                    <ChevronDown
                      size={20}
                      color={theme.colors.primary}
                      style={{
                        transform: [{ rotate: showAllIncome ? '180deg' : '0deg' }]
                      }}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <ArrowUpCircle size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No income recorded yet</Text>
              </View>
            )
          ) : (
            expenseList.length > 0 ? (
              <>
                {displayedExpense.map((item, index) => (
                  <View key={item.id} style={[styles.listItem, index === displayedExpense.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.listItemTop}>
                      <View style={styles.listItemLeft}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemType}>{item.type}</Text>
                        {item.description && (
                          <Text style={styles.itemDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                        )}
                        <Text style={styles.itemDate}>
                          {new Date(item.expense_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={[styles.itemAmount, { color: theme.colors.error }]}>
                        ₹{item.amount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
                {expenseList.length > 5 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => setShowAllExpense(!showAllExpense)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewMoreText}>
                      {showAllExpense ? 'Show Less' : `View All ${expenseList.length} Items`}
                    </Text>
                    <ChevronDown
                      size={20}
                      color={theme.colors.primary}
                      style={{
                        transform: [{ rotate: showAllExpense ? '180deg' : '0deg' }]
                      }}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <ArrowDownCircle size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No expenses recorded yet</Text>
              </View>
            )
          )}
        </Card>

        {/* Quick Insights */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚡ Quick Insights</Text>
          <Text style={styles.sectionSubtitle}>Key performance indicators</Text>
        </View>
        <View style={styles.insightsGrid}>
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Clock size={20} color={theme.colors.warning} />
              <Text style={styles.insightLabel}>Peak Hours</Text>
            </View>
            <Text style={styles.insightValue}>{analytics.peakHours}</Text>
            <Text style={styles.insightChange}>Busiest time</Text>
          </View>

          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Dumbbell size={20} color={theme.colors.accent} />
              <Text style={styles.insightLabel}>Popular Workout</Text>
            </View>
            <Text style={styles.insightValue} numberOfLines={1}>
              {analytics.popularWorkout}
            </Text>
            <Text style={styles.insightChange}>Most completed</Text>
          </View>

          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Target size={20} color={theme.colors.primary} />
              <Text style={styles.insightLabel}>Completion Rate</Text>
            </View>
            <Text style={styles.insightValue}>{analytics.completionRate.toFixed(1)}%</Text>
            <Text style={styles.insightChange}>Attendance rate</Text>
          </View>

          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Award size={20} color={theme.colors.success} />
              <Text style={styles.insightLabel}>Avg Workouts</Text>
            </View>
            <Text style={styles.insightValue}>{analytics.avgWorkouts.toFixed(1)}</Text>
            <Text style={styles.insightChange}>Per member</Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Add Income/Expense Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Add {modalType === 'income' ? 'Income' : 'Expense'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <X size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, modalType === 'income' && styles.activeTab]}
                  onPress={() => {
                    setModalType('income');
                    setFormData({ ...formData, type: '' });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, modalType === 'income' && styles.activeTabText]}>
                    Income
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, modalType === 'expense' && styles.activeTab]}
                  onPress={() => {
                    setModalType('expense');
                    setFormData({ ...formData, type: '' });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, modalType === 'expense' && styles.activeTabText]}>
                    Expense
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter name"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Type *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !formData.type && styles.dropdownPlaceholder,
                  ]}
                >
                  {formData.type || 'Select type'}
                </Text>
                <ChevronDown size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {showTypeDropdown && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {(modalType === 'income' ? incomeTypes : expenseTypes).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, type });
                        setShowTypeDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.label}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                placeholder="Enter amount"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Payment Method</Text>
              <TextInput
                style={styles.input}
                value={formData.payment_method}
                onChangeText={(text) => setFormData({ ...formData, payment_method: text })}
                placeholder="e.g., Cash, Card, UPI"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter description"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!formData.name || !formData.type || !formData.amount || submitting) &&
                  styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!formData.name || !formData.type || !formData.amount || submitting}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Add {modalType === 'income' ? 'Income' : 'Expense'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaWrapper>
  );
}