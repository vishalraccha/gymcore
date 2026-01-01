import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '@/contexts/AuthContext';
import { useStats } from '@/hooks/useStats';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
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
  TrendingUp,
  Award,
  Target,
  CheckCircle,
  Calendar as CalendarIcon,
  Zap,
} from 'lucide-react-native';
import SafeAreaWrapper from '../../../components/SafeAreaWrapper';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserPendingPayments } from '@/lib/pendingPayments';
import { formatRupees } from '@/lib/currency';
import { AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

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
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [attendanceDates, setAttendanceDates] = useState<any>({});
  const [currentStatIndex, setCurrentStatIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { stats, streak, refreshStats } = useStats(selectedDate);
  const [monthlyStats, setMonthlyStats] = useState({
    totalWorkouts: 0,
    totalDuration: 0,
    avgDuration: 0,
    attendanceRate: 0,
  });

  useEffect(() => {
    if (user) {
      checkTodayAttendance();
      fetchAttendanceHistory();
      fetchMonthlyStats();
      refreshProfile();
      refreshStats();
      fetchPendingPayments();
    }
  }, [user, selectedDate]);

  const fetchMonthlyStats = async () => {
    if (!user) return;
    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const firstDay = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const lastDay = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
  
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('attendance_date', firstDay)
        .lte('attendance_date', lastDay)
        .not('check_out_time', 'is', null);
  
      if (!error && data) {
        const totalWorkouts = data.length;
        const totalDuration = data.reduce((sum, att) => sum + (att.duration_minutes || 0), 0);
        const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const attendanceRate = Math.round((totalWorkouts / daysInMonth) * 100);
  
        setMonthlyStats({
          totalWorkouts,
          totalDuration,
          avgDuration,
          attendanceRate,
        });
      }
    } catch (err) {
      console.log('Error fetching monthly stats:', err);
    }
  };

  const fetchAttendanceHistory = async () => {
    if (!user) return;
    try {
      // Fetch all attendance records
      const { data, error } = await supabase
        .from('attendance')
        .select('attendance_date')
        .eq('user_id', user.id)
        .not('check_out_time', 'is', null);
  
      if (!error && data) {
        const markedDates: any = {};
        data.forEach((record: any) => {
          markedDates[record.attendance_date] = {
            marked: true,
            dotColor: theme.colors.success,
            customStyles: {
              container: {
                backgroundColor: theme.colors.success + '20',
              },
              text: {
                color: theme.colors.success,
                fontWeight: 'bold',
              },
            },
          };
        });
        setAttendanceDates(markedDates);
      }
    } catch (err) {
      console.log('Error fetching attendance history:', err);
    }
  };

  const fetchPendingPayments = async () => {
    if (!user) return;
    try {
      const payments = await getUserPendingPayments(user.id);
      const activePayments = payments.filter(
        (p: any) => p.status === 'pending' || p.status === 'partial' || p.status === 'overdue'
      );
      setPendingPayments(activePayments);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    }
  };

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

      if (error) return;

      if (data && data.length > 0) {
        setTodayAttendance(data[0]);
        setIsCheckedIn(!data[0].check_out_time);
      } else {
        setTodayAttendance(null);
        setIsCheckedIn(false);
      }
    } catch (err) {
      console.log('Error checking attendance:', err);
    }
  };

  const handleCheckInOut = async () => {
    if (!user) return;
    try {
      if (!isCheckedIn) {
        const { error } = await supabase.from('attendance').insert([
          {
            user_id: user.id,
            gym_id: profile?.gym_id || null,
            check_in_time: new Date().toISOString(),
            attendance_date: new Date().toISOString().split('T')[0],
          },
        ]);

        if (error) throw error;
        Alert.alert('Welcome! 🎉', 'You have successfully checked in. Have a great workout!');
      } else {
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
          Alert.alert('Great Session! 💪', `You worked out for ${durationMinutes} minutes. See you next time!`);
        }
      }

      await checkTodayAttendance();
      await fetchAttendanceHistory();
      await fetchMonthlyStats();
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
        icon: <Sunrise size={24} color={theme.colors.warning} />,
      };
    if (hour < 18)
      return {
        text: 'Good Afternoon',
        icon: <Sun size={24} color={theme.colors.warning} />,
      };
    return {
      text: 'Good Evening',
      icon: <Moon size={24} color={theme.colors.primary} />,
    };
  };

  const CircularProgress = ({ 
    value, 
    maxValue, 
    size = 100, 
    strokeWidth = 10, 
    color, 
    label, 
    unit 
  }: {
    value: number;
    maxValue: number;
    size?: number;
    strokeWidth?: number;
    color: string;
    label: string;
    unit: string;
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(value / maxValue, 1);
    const strokeDashoffset = circumference - progress * circumference;
    const percentage = Math.round((value / maxValue) * 100);

    return (
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.colors.border}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ 
              fontSize: 20, 
              fontWeight: '700', 
              color: theme.colors.text,
              fontFamily: 'Inter-Bold' 
            }}>
              {value}
            </Text>
            <Text style={{ 
              fontSize: 10, 
              color: theme.colors.textSecondary,
              fontFamily: 'Inter-Medium',
              marginTop: 2
            }}>
              {percentage}%
            </Text>
          </View>
        </View>
        <Text style={{ 
          fontSize: 12, 
          color: theme.colors.text,
          fontFamily: 'Inter-SemiBold',
          marginTop: 6,
          textAlign: 'center'
        }}>
          {label}
        </Text>
        <Text style={{ 
          fontSize: 10, 
          color: theme.colors.textSecondary,
          fontFamily: 'Inter-Regular',
          textAlign: 'center'
        }}>
          of {maxValue} {unit}
        </Text>
      </View>
    );
  };

 

  const greeting = getGreeting();
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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const markedDates = {
    ...attendanceDates,
    [selectedDate]: {
      ...attendanceDates[selectedDate],
      selected: true,
      selectedColor: theme.colors.primary,
      customStyles: {
        container: {
          backgroundColor: attendanceDates[selectedDate] 
            ? theme.colors.success + '20' 
            : theme.colors.primary,
          borderRadius: 16,
        },
        text: {
          color: attendanceDates[selectedDate] 
            ? theme.colors.success 
            : theme.colors.card,
          fontWeight: 'bold',
        },
      },
    },
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    performanceCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
      borderRadius: 20,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    statCard: {
      width: (width - 88) / 2,
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      minHeight: 140,
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 32,
      fontWeight: '800',
      fontFamily: 'Inter-Bold',
      letterSpacing: -1,
      marginTop: 8,
    },
    statUnit: {
      fontSize: 12,
      fontFamily: 'Inter-Medium',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      fontFamily: 'Inter-SemiBold',
      textAlign: 'center',
      lineHeight: 18,
    },
    nutritionCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
      borderRadius: 20,
    },
    nutritionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    greeting: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Medium',
    },
    name: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 16,
      fontFamily: 'Inter-Bold',
      letterSpacing: -0.5,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    quickStat: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    quickStatLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Medium',
    },
    quickStatValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    pendingPaymentBanner: {
      marginHorizontal: 24,
      marginTop: 16,
      marginBottom: 8,
      padding: 16,
      borderRadius: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.error,
      backgroundColor: theme.colors.error + '15',
    },
    pendingPaymentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    pendingPaymentTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.error,
      fontFamily: 'Inter-Bold',
    },
    pendingPaymentItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: 8,
      paddingTop: 8,
    },
    pendingPaymentInfo: {
      flex: 1,
      marginRight: 12,
    },
    pendingPaymentLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      fontFamily: 'Inter-SemiBold',
    },
    pendingPaymentAmount: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.error,
      marginBottom: 4,
      fontFamily: 'Inter-Bold',
    },
    overdueText: {
      fontSize: 12,
      color: theme.colors.error,
      fontWeight: '600',
      fontFamily: 'Inter-SemiBold',
    },
    payNowButton: {
      minWidth: 100,
    },
    checkInCard: {
      marginHorizontal: 24,
      marginTop: 16,
      marginBottom: 8,
      padding: 20,
      borderRadius: 20,
    },
    checkInHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 16,
    },
    checkInIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkInInfo: {
      flex: 1,
    },
    checkInTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      marginBottom: 4,
    },
    checkInSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
      lineHeight: 20,
    },
    checkInButton: {
      width: '100%',
      borderRadius: 12,
    },
    sectionHeader: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 12,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      letterSpacing: -0.5,
    },
    carouselContainer: {
      marginTop: 8,
      marginBottom: 16,
    },
    carouselContent: {
      paddingHorizontal: 24,
      gap: 16,
    },
    
    carouselPageTitle: {
      fontSize: 22,
      fontWeight: '700',
      fontFamily: 'Inter-Bold',
      marginBottom: 20,
      letterSpacing: -0.5,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    metricCard: {
      width: (CARD_WIDTH - 60) / 2,
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      minHeight: 140,
      justifyContent: 'center',
    },
    metricIconContainer: {
      marginBottom: 8,
    },
    metricValue: {
      fontSize: 28,
      fontWeight: '800',
      fontFamily: 'Inter-Bold',
      letterSpacing: -1,
      marginTop: 4,
    },
    metricUnit: {
      fontSize: 11,
      fontFamily: 'Inter-Medium',
      marginBottom: 6,
    },
    metricLabel: {
      fontSize: 12,
      fontFamily: 'Inter-SemiBold',
      textAlign: 'center',
      lineHeight: 16,
    },
    
    carouselDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    calendarCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      padding: 20,
      borderRadius: 20,
    },
    calendarHeader: {
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      marginBottom: 6,
    },
    calendarSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    performanceContainer: {
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 8,
    },
    performanceRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCardLarge: {
      flex: 1,
      padding: 20,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    statIconBox: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statContent: {
      flex: 1,
    },
    statValueLarge: {
      fontSize: 36,
      fontWeight: '800',
      fontFamily: 'Inter-Bold',
      letterSpacing: -1,
      marginBottom: 2,
    },
    statUnitLarge: {
      fontSize: 14,
      fontFamily: 'Inter-Medium',
    },
    monthlyStatsCard: {
      marginTop: 4,
      padding: 20,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    monthlyStatsTitle: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'Inter-Bold',
      marginBottom: 16,
    },
    monthlyStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    monthlyStatItem: {
      alignItems: 'center',
      flex: 1,
    },
    monthlyStatValue: {
      fontSize: 24,
      fontWeight: '800',
      fontFamily: 'Inter-Bold',
      marginBottom: 4,
    },
    monthlyStatLabel: {
      fontSize: 12,
      fontFamily: 'Inter-Medium',
      textAlign: 'center',
    },
    monthlyStatDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
    },
  });

  return (
    <SafeAreaWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            {greeting.icon}
            <Text style={styles.greeting}>{greeting.text}</Text>
          </View>
          <Text style={styles.name}>{safeProfile.full_name?.split(' ')[0] || 'User'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.quickStat}>
              <Award size={24} color={theme.colors.primary} />
              <Text style={styles.quickStatValue}>Lvl {safeProfile.level || 1}</Text>
              <Text style={styles.quickStatLabel}>Level</Text>
            </View>
            <View style={styles.quickStat}>
              <Flame size={24} color={theme.colors.warning} />
              <Text style={styles.quickStatValue}>{safeProfile.current_streak || 0}</Text>
              <Text style={styles.quickStatLabel}>Day Streak</Text>
            </View>
            <View style={styles.quickStat}>
              <Target size={24} color={theme.colors.success} />
              <Text style={styles.quickStatValue}>{safeProfile.total_points || 0}</Text>
              <Text style={styles.quickStatLabel}>Points</Text>
            </View>
          </View>
        </View>

        {pendingPayments.length > 0 && (
          <Card style={styles.pendingPaymentBanner}>
            <View style={styles.pendingPaymentHeader}>
              <AlertCircle size={20} color={theme.colors.error} />
              <Text style={styles.pendingPaymentTitle}>Pending Payments</Text>
            </View>
            {pendingPayments.map((payment: any) => (
              <View key={payment.id} style={styles.pendingPaymentItem}>
                <View style={styles.pendingPaymentInfo}>
                  <Text style={styles.pendingPaymentLabel}>
                    {payment.subscriptions?.name || 'Subscription Payment'}
                  </Text>
                  <Text style={styles.pendingPaymentAmount}>
                    Pending: {formatRupees(payment.pending_amount)}
                  </Text>
                  {payment.status === 'overdue' && (
                    <Text style={styles.overdueText}>⚠️ Overdue</Text>
                  )}
                </View>
                <Button
                  title="Pay Now"
                  onPress={() => router.push('/(app)/(tabs)/plans')}
                  variant="primary"
                  style={styles.payNowButton}
                />
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.checkInCard}>
          <View style={styles.checkInHeader}>
            <View style={styles.checkInIcon}>
              {isCheckedIn ? (
                <LogOut size={28} color={theme.colors.error} />
              ) : (
                <LogIn size={28} color={theme.colors.success} />
              )}
              </View>
        <View style={styles.checkInInfo}>
          <Text style={styles.checkInTitle}>
            {isCheckedIn ? "You're Checked In!" : 'Ready to Workout?'}
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

    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Performance Dashboard</Text>
    </View>
    {/* Today's Performance Stats */}
    <View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Today's Performance</Text>
</View>

<View style={styles.performanceContainer}>
  <View style={styles.performanceRow}>
    <Card style={[styles.statCardLarge, { backgroundColor: theme.colors.error + '10' }]}>
      <View style={[styles.statIconBox, { backgroundColor: theme.colors.error + '20' }]}>
        <Flame size={32} color={theme.colors.error} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValueLarge, { color: theme.colors.text }]}>
          {Math.round(safeStats.calories_burned || 0)}
        </Text>
        <Text style={[styles.statUnitLarge, { color: theme.colors.textSecondary }]}>
          kcal burned
        </Text>
      </View>
    </Card>

    <Card style={[styles.statCardLarge, { backgroundColor: theme.colors.accent + '10' }]}>
      <View style={[styles.statIconBox, { backgroundColor: theme.colors.accent + '20' }]}>
        <Clock size={32} color={theme.colors.accent} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValueLarge, { color: theme.colors.text }]}>
          {safeStats.workout_duration || 0}
        </Text>
        <Text style={[styles.statUnitLarge, { color: theme.colors.textSecondary }]}>
          minutes
        </Text>
      </View>
    </Card>
  </View>

  <View style={styles.performanceRow}>
    <Card style={[styles.statCardLarge, { backgroundColor: theme.colors.success + '10' }]}>
      <View style={[styles.statIconBox, { backgroundColor: theme.colors.success + '20' }]}>
        <Dumbbell size={32} color={theme.colors.success} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValueLarge, { color: theme.colors.text }]}>
          {safeStats.workouts_completed || 0}
        </Text>
        <Text style={[styles.statUnitLarge, { color: theme.colors.textSecondary }]}>
          workouts
        </Text>
      </View>
    </Card>

    <Card style={[styles.statCardLarge, { backgroundColor: theme.colors.warning + '10' }]}>
      <View style={[styles.statIconBox, { backgroundColor: theme.colors.warning + '20' }]}>
        <TrendingUp size={32} color={theme.colors.warning} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValueLarge, { color: theme.colors.text }]}>
          {streak || 0}
        </Text>
        <Text style={[styles.statUnitLarge, { color: theme.colors.textSecondary }]}>
          day streak
        </Text>
      </View>
    </Card>
  </View>

  {/* Monthly Stats in smaller format */}
  <Card style={styles.monthlyStatsCard}>
    <Text style={[styles.monthlyStatsTitle, { color: theme.colors.text }]}>
      This Month
    </Text>
    <View style={styles.monthlyStatsRow}>
      <View style={styles.monthlyStatItem}>
        <Text style={[styles.monthlyStatValue, { color: theme.colors.text }]}>
          {monthlyStats.totalWorkouts}
        </Text>
        <Text style={[styles.monthlyStatLabel, { color: theme.colors.textSecondary }]}>
          Total Workouts
        </Text>
      </View>
      <View style={styles.monthlyStatDivider} />
      <View style={styles.monthlyStatItem}>
        <Text style={[styles.monthlyStatValue, { color: theme.colors.text }]}>
          {monthlyStats.totalDuration}m
        </Text>
        <Text style={[styles.monthlyStatLabel, { color: theme.colors.textSecondary }]}>
          Total Time
        </Text>
      </View>
      <View style={styles.monthlyStatDivider} />
      <View style={styles.monthlyStatItem}>
        <Text style={[styles.monthlyStatValue, { color: theme.colors.text }]}>
          {monthlyStats.attendanceRate}%
        </Text>
        <Text style={[styles.monthlyStatLabel, { color: theme.colors.textSecondary }]}>
          Attendance
        </Text>
      </View>
    </View>
  </Card>
</View>

{/* Nutrition Progress */}
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Nutrition Progress</Text>
</View>

<Card style={styles.nutritionCard}>
  <View style={styles.nutritionGrid}>
    <CircularProgress
      value={safeStats.calories_consumed || 0}
      maxValue={2000}
      size={100}
      strokeWidth={10}
      color={theme.colors.primary}
      label="Calories"
      unit="kcal"
    />
    <CircularProgress
      value={safeStats.protein_consumed || 0}
      maxValue={150}
      size={100}
      strokeWidth={10}
      color={theme.colors.success}
      label="Protein"
      unit="g"
    />
    <CircularProgress
      value={safeStats.carbs_consumed || 0}
      maxValue={250}
      size={100}
      strokeWidth={10}
      color={theme.colors.warning}
      label="Carbs"
      unit="g"
    />
    <CircularProgress
      value={safeStats.fat_consumed || 0}
      maxValue={65}
      size={100}
      strokeWidth={10}
      color={theme.colors.error}
      label="Fat"
      unit="g"
    />
  </View>
</Card>

<Card style={styles.calendarCard}>
  <View style={styles.calendarHeader}>
    <Text style={styles.cardTitle}>Progress Calendar</Text>
    <Text style={styles.calendarSubtitle}>
      Days with checkmarks show completed workouts
    </Text>
  </View>
  <Calendar
    current={selectedDate}
    onDayPress={(day) => setSelectedDate(day.dateString)}
    markedDates={markedDates}
    markingType="custom"
    enableSwipeMonths={true}
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
      textMonthFontFamily: 'Inter-Bold',
      textDayHeaderFontFamily: 'Inter-SemiBold',
      textDayFontSize: 16,
      textMonthFontSize: 18,
      textDayHeaderFontSize: 14,
    }}
  />
</Card>
  </ScrollView>
</SafeAreaWrapper>
  )}