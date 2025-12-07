import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Workout, WorkoutLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, Clock, CircleCheck as CheckCircle, Flame, Target } from 'lucide-react-native';

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [todayLogs, setTodayLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchWorkouts();
    fetchTodayLogs();
  }, []);

  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
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
      console.warn('Error fetching workouts:', error);
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
      console.warn('Error fetching workout logs:', error);
    }
  };

  const startWorkout = (workoutId: string) => {
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
      }
    } catch (error) {
      console.warn('Error logging workout:', error);
      Alert.alert('Error', 'Failed to log workout');
    } finally {
      setIsLoading(false);
    }
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
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>Your training schedule</Text>
        </View>

        {/* Today's Summary */}
        {todayLogs.length > 0 && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <CheckCircle size={24} color="#10B981" />
              <Text style={styles.summaryTitle}>Today's Achievement</Text>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{todayLogs.length}</Text>
                <Text style={styles.summaryLabel}>Workouts</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {todayLogs.reduce((sum, log) => sum + log.duration_minutes, 0)}
                </Text>
                <Text style={styles.summaryLabel}>Minutes</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {todayLogs.reduce((sum, log) => sum + Number(log.calories_burned), 0).toFixed(0)}
                </Text>
                <Text style={styles.summaryLabel}>Calories</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Workouts List */}
        {workouts.length === 0 ? (
          <Card style={styles.noWorkoutsCard}>
            <Target size={48} color="#9CA3AF" />
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
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.completedText}>Done</Text>
                      </View>
                    )}
                  </View>
                  {workout.description && (
                    <Text style={styles.workoutDescription}>{workout.description}</Text>
                  )}
                  
                  <View style={styles.workoutMeta}>
                    <View style={styles.metaItem}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Flame size={16} color="#6B7280" />
                      <Text style={styles.metaText}>{(workout.duration_minutes * Number(workout.calories_per_minute)).toFixed(0)} cal</Text>
                    </View>
                    <View style={[styles.difficultyBadge, { backgroundColor: `${getDifficultyColor(workout.difficulty)}15` }]}>
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(workout.difficulty) }]}>
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
                    <Button
                      title="Complete Workout"
                      onPress={() => stopWorkout(workout)}
                      variant="secondary"
                      isLoading={isLoading}
                      style={styles.completeButton}
                    />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  summaryCard: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 16,
    padding: 20,
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
    color: '#0F172A',
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
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  noWorkoutsCard: {
    marginHorizontal: 24,
    alignItems: 'center',
    paddingVertical: 48,
  },
  noWorkoutsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  noWorkoutsSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  workoutCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
  },
  workoutHeader: {
    marginBottom: 16,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
    fontFamily: 'Inter-Bold',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    fontFamily: 'Inter-SemiBold',
  },
  workoutDescription: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
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
    marginTop: 20,
  },
  activeWorkoutContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  timerText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
  },
  completeButton: {
    width: '100%',
  },
  startButton: {
    width: '100%',
  },
});