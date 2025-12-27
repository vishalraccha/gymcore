import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Workout, WorkoutLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, CircleCheck as CheckCircle, Flame, Target } from 'lucide-react-native';
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const BOTTOM_TAB_HEIGHT = 80;

export default function WorkoutsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [todayLogs, setTodayLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  const loadData = async () => {
    try {
      await Promise.all([
        fetchWorkouts(),
        fetchTodayLogs(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchWorkouts = async () => {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setWorkouts(data);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
    }
  };

  const fetchTodayLogs = async () => {
    if (!user) return;

    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', todayDate);

      if (!error && data) {
        setTodayLogs(data);
      }
    } catch (error) {
      console.error('Error fetching workout logs:', error);
    }
  };

  const startWorkout = (workoutId: string) => {
    if (activeWorkout) {
      Alert.alert('Active Workout', 'Please complete your current workout first.');
      return;
    }
    
    setActiveWorkout(workoutId);
    setWorkoutTimer(0);
    const interval = setInterval(() => {
      setWorkoutTimer((prev) => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const stopWorkout = async (workout: Workout) => {
    if (!user || !activeWorkout) return;

    setIsLoading(true);
    
    try {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }

      const durationMinutes = Math.max(Math.floor(workoutTimer / 60), 1);
      const caloriesBurned = durationMinutes * Number(workout.calories_per_minute);

      const { error } = await supabase
        .from('workout_logs')
        .insert([
          {
            user_id: user.id,
            workout_id: workout.id,
            duration_minutes: durationMinutes,
            calories_burned: caloriesBurned,
            log_date: new Date().toISOString().split('T')[0],
          },
        ]);

      if (!error) {
        setActiveWorkout(null);
        setWorkoutTimer(0);
        await fetchTodayLogs();
        
        Alert.alert(
          'Workout Completed! 🎉',
          `Great job! You burned ${caloriesBurned.toFixed(0)} calories in ${durationMinutes} minutes.`
        );
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Error logging workout:', error);
      Alert.alert('Error', 'Failed to log workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelWorkout = () => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel this workout? Your progress will not be saved.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: () => {
            if (timerInterval) {
              clearInterval(timerInterval);
              setTimerInterval(null);
            }
            setActiveWorkout(null);
            setWorkoutTimer(0);
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isWorkoutCompleted = (workoutId: string) => {
    return todayLogs.some(log => log.workout_id === workoutId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return theme.colors.success;
      case 'intermediate': return theme.colors.warning;
      case 'advanced': return theme.colors.error;
      default: return theme.colors.secondary;
    }
  };

  const todayStats = useMemo(() => ({
    workouts: todayLogs.length,
    minutes: todayLogs.reduce((sum, log) => sum + log.duration_minutes, 0),
    calories: todayLogs.reduce((sum, log) => sum + Number(log.calories_burned), 0),
  }), [todayLogs]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingBottom: BOTTOM_TAB_HEIGHT + 20,
    },
    header: {
      paddingHorizontal: HORIZONTAL_PADDING,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      paddingBottom: 20,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    summaryCard: {
      marginHorizontal: HORIZONTAL_PADDING,
      marginTop: 16,
      marginBottom: 12,
      padding: 16,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    summaryStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
      marginHorizontal: 12,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      fontFamily: 'Inter-Bold',
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    noWorkoutsCard: {
      marginHorizontal: HORIZONTAL_PADDING,
      alignItems: 'center',
      paddingVertical: 48,
      marginTop: 16,
    },
    noWorkoutsText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
      fontFamily: 'Inter-Bold',
    },
    noWorkoutsSubtext: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Inter-Regular',
    },
    workoutCard: {
      marginHorizontal: HORIZONTAL_PADDING,
      marginBottom: 12,
      padding: 16,
    },
    workoutHeader: {
      marginBottom: 12,
    },
    workoutInfo: {
      flex: 1,
    },
    workoutTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      gap: 12,
    },
    workoutName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
      fontFamily: 'Inter-Bold',
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.success + '20',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 4,
    },
    completedText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.success,
      fontFamily: 'Inter-SemiBold',
    },
    workoutDescription: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 22,
      fontFamily: 'Inter-Regular',
    },
    workoutMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    difficultyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    difficultyText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
      fontFamily: 'Inter-SemiBold',
    },
    workoutActions: {
      marginTop: 16,
    },
    activeWorkoutContainer: {
      alignItems: 'center',
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    timerContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    timerLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      fontFamily: 'Inter-Regular',
    },
    timerText: {
      fontSize: 36,
      fontWeight: 'bold',
      color: theme.colors.primary,
      fontFamily: 'Inter-Bold',
    },
    actionButtons: {
      width: '100%',
      gap: 8,
    },
    completeButton: {
      width: '100%',
    },
    cancelButton: {
      width: '100%',
    },
    startButton: {
      width: '100%',
    },
  });

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
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
            <Text style={styles.title}>Workouts</Text>
            <Text style={styles.subtitle}>Your training schedule</Text>
          </View>

          {/* Today's Summary */}
          {todayLogs.length > 0 && (
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <CheckCircle size={24} color={theme.colors.success} />
                <Text style={styles.summaryTitle}>Today's Achievement</Text>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todayStats.workouts}</Text>
                  <Text style={styles.summaryLabel}>Workouts</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todayStats.minutes}</Text>
                  <Text style={styles.summaryLabel}>Minutes</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {todayStats.calories.toFixed(0)}
                  </Text>
                  <Text style={styles.summaryLabel}>Calories</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Workouts List */}
          {workouts.length === 0 ? (
            <Card style={styles.noWorkoutsCard}>
              <Target size={48} color={theme.colors.textSecondary} />
              <Text style={styles.noWorkoutsText}>No workouts available</Text>
              <Text style={styles.noWorkoutsSubtext}>Check back later for new workouts</Text>
            </Card>
          ) : (
            workouts.map((workout) => (
              <Card key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutInfo}>
                    <View style={styles.workoutTitleRow}>
                      <Text style={styles.workoutName}>{workout.name}</Text>
                      {isWorkoutCompleted(workout.id) && (
                        <View style={styles.completedBadge}>
                          <CheckCircle size={16} color={theme.colors.success} />
                          <Text style={styles.completedText}>Done</Text>
                        </View>
                      )}
                    </View>
                    {workout.description && (
                      <Text style={styles.workoutDescription}>{workout.description}</Text>
                    )}
                    
                    <View style={styles.workoutMeta}>
                      <View style={styles.metaItem}>
                        <Clock size={16} color={theme.colors.textSecondary} />
                        <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Flame size={16} color={theme.colors.textSecondary} />
                        <Text style={styles.metaText}>
                          {(workout.duration_minutes * Number(workout.calories_per_minute)).toFixed(0)} cal
                        </Text>
                      </View>
                      <View style={[
                        styles.difficultyBadge, 
                        { backgroundColor: getDifficultyColor(workout.difficulty) + '20' }
                      ]}>
                        <Text style={[
                          styles.difficultyText, 
                          { color: getDifficultyColor(workout.difficulty) }
                        ]}>
                          {workout.difficulty}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.workoutActions}>
                  {activeWorkout === workout.id ? (
                    <View style={styles.activeWorkoutContainer}>
                      <View style={styles.timerContainer}>
                        <Text style={styles.timerLabel}>Workout in progress</Text>
                        <Text style={styles.timerText}>{formatTime(workoutTimer)}</Text>
                      </View>
                      <View style={styles.actionButtons}>
                        <Button
                          title="Complete Workout"
                          onPress={() => stopWorkout(workout)}
                          variant="primary"
                          isLoading={isLoading}
                          disabled={isLoading}
                          style={styles.completeButton}
                        />
                        <Button
                          title="Cancel"
                          onPress={cancelWorkout}
                          variant="outline"
                          disabled={isLoading}
                          style={styles.cancelButton}
                        />
                      </View>
                    </View>
                  ) : (
                    !isWorkoutCompleted(workout.id) && (
                      <Button
                        title="Start Workout"
                        onPress={() => startWorkout(workout.id)}
                        disabled={activeWorkout !== null}
                        style={styles.startButton}
                      />
                    )
                  )}
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}