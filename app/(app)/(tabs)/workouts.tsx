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
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Workout, WorkoutLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Clock, CheckCircle, Flame, Target, Dumbbell } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#3B82F6',
  primaryLight: '#EEF2FF',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  accent: '#8B5CF6',
  accentLight: '#F3E8FF',
};

export default function WorkoutsScreen() {
  const { user } = useAuth();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<Workout[]>([]);
  const [todayLogs, setTodayLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Get current day: 0=Monday, 1=Tuesday, ..., 6=Sunday
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1; // Convert Sunday(0) to 6, others to 0-5
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [user]);

  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  const loadData = async () => {
    try {
      await Promise.all([fetchWorkouts(), fetchTodayLogs()]);
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
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gym_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        console.log('No profile found');
        setWorkouts([]);
        return;
      }

      // Fetch gym-specific workouts
      const { data: gymWorkouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .eq('gym_id', profile.gym_id)
        .order('name', { ascending: true });

      // Fetch global workouts (no gym_id)
      const { data: globalWorkouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .is('gym_id', null)
        .order('name', { ascending: true });

      const allWorkouts = [...(gymWorkouts || []), ...(globalWorkouts || [])];
      
      console.log(`✅ Fetched ${allWorkouts.length} workouts (${gymWorkouts?.length || 0} gym + ${globalWorkouts?.length || 0} global)`);
      
      setWorkouts(allWorkouts);
      filterWorkoutsByDay(allWorkouts, selectedDay);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      Alert.alert('Error', 'Failed to fetch workouts');
    }
  };

  const filterWorkoutsByDay = useCallback((workoutsList: Workout[], dayIndex: number) => {
    // dayIndex: 0=Monday, 1=Tuesday, ..., 6=Sunday
    // Convert to day_of_week: 1=Monday, 2=Tuesday, ..., 0=Sunday
    const dayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;
    
    console.log(`\n🔍 Filtering for day: ${dayIndex} (day_of_week: ${dayOfWeek})`);
    console.log(`📋 All workouts in database:`);
    workoutsList.forEach(w => {
      console.log(`  - "${w.name}" has day_of_week: ${w.day_of_week} (${typeof w.day_of_week})`);
    });
    
    const filtered = workoutsList.filter((workout) => {
      // Convert workout.day_of_week to number for comparison (it's stored as string in DB)
      const workoutDay = workout.day_of_week === null || workout.day_of_week === undefined 
        ? null 
        : Number(workout.day_of_week);
      
      // Show workouts with no specific day OR matching day
      const matches = workoutDay === null || workoutDay === dayOfWeek;
      
      if (matches) {
        console.log(`✅ Workout "${workout.name}" MATCHES (day_of_week: ${workout.day_of_week} -> ${workoutDay})`);
      }
      return matches;
    });
    
    console.log(`\n📊 Result: Found ${filtered.length} workouts for selected day\n`);
    setFilteredWorkouts(filtered);
  }, []);

  useEffect(() => {
    if (workouts.length > 0) {
      filterWorkoutsByDay(workouts, selectedDay);
    }
  }, [selectedDay, workouts, filterWorkoutsByDay]);

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
        .insert([{
          user_id: user.id,
          workout_id: workout.id,
          duration_minutes: durationMinutes,
          calories_burned: caloriesBurned,
          log_date: new Date().toISOString().split('T')[0],
        }]);

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
      'Are you sure? Your progress will not be saved.',
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
      case 'beginner': return COLORS.success;
      case 'intermediate': return COLORS.warning;
      case 'advanced': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const todayStats = useMemo(() => ({
    workouts: todayLogs.length,
    minutes: todayLogs.reduce((sum, log) => sum + log.duration_minutes, 0),
    calories: todayLogs.reduce((sum, log) => sum + Number(log.calories_burned), 0),
  }), [todayLogs]);

  const getTodayIndex = () => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Workouts</Text>
            <Text style={styles.subtitle}>Your training schedule</Text>
          </View>

          {/* Day Selector */}
          <View style={styles.daySelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.daySelectorScroll}
            >
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                const isSelected = selectedDay === index;
                const isToday = getTodayIndex() === index;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      isSelected && styles.dayButtonSelected,
                      isToday && !isSelected && styles.dayButtonToday,
                    ]}
                    onPress={() => setSelectedDay(index)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        isSelected && styles.dayButtonTextSelected,
                        isToday && !isSelected && styles.dayButtonTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                    {isToday && !isSelected && <View style={styles.todayIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Today's Summary */}
          {todayLogs.length > 0 && (
            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <CheckCircle size={24} color={COLORS.success} />
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
                  <Text style={styles.summaryValue}>{todayStats.calories.toFixed(0)}</Text>
                  <Text style={styles.summaryLabel}>Calories</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Workouts List */}
          {filteredWorkouts.length === 0 ? (
            <Card style={styles.noWorkoutsCard}>
              <Dumbbell size={48} color={COLORS.textSecondary} />
              <Text style={styles.noWorkoutsText}>No workouts scheduled</Text>
              <Text style={styles.noWorkoutsSubtext}>
                Try selecting a different day or check back later
              </Text>
            </Card>
          ) : (
            filteredWorkouts.map((workout) => (
              <Card key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutTitleRow}>
                    <Text style={styles.workoutName} numberOfLines={2}>{workout.name}</Text>
                    {isWorkoutCompleted(workout.id) && (
                      <View style={styles.completedBadge}>
                        <CheckCircle size={16} color={COLORS.success} />
                        <Text style={styles.completedText}>Done</Text>
                      </View>
                    )}
                  </View>
                  
                  {workout.description && (
                    <Text style={styles.workoutDescription} numberOfLines={3}>
                      {workout.description}
                    </Text>
                  )}
                  
                  <View style={styles.workoutMeta}>
                    <View style={styles.metaItem}>
                      <Clock size={16} color={COLORS.textSecondary} />
                      <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Flame size={16} color={COLORS.error} />
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
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 20,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  daySelectorContainer: {
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  daySelectorScroll: {
    gap: 8,
    paddingRight: 20,
  },
  dayButton: {
    minWidth: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayButtonToday: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dayButtonTextSelected: {
    color: COLORS.cardBg,
  },
  dayButtonTextToday: {
    color: COLORS.accent,
  },
  todayIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
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
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  noWorkoutsCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 48,
    borderRadius: 16,
  },
  noWorkoutsText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noWorkoutsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  workoutCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
  },
  workoutHeader: {
    marginBottom: 16,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  workoutName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  workoutDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
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
    color: COLORS.textSecondary,
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
  },
  workoutActions: {
    marginTop: 0,
  },
  activeWorkoutContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  actionButtons: {
    width: '100%',
    gap: 8,
  },
  completeButton: {
    width: '100%',
    minHeight: 52,
  },
  cancelButton: {
    width: '100%',
    minHeight: 52,
  },
  startButton: {
    width: '100%',
    minHeight: 52,
  },
});