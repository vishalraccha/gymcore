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
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Workout, WorkoutLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Clock, 
  CheckCircle, 
  Flame, 
  Target, 
  Dumbbell,
  Filter,
  X,
  AlertCircle,
  Repeat,
} from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { Linking, Modal } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

type BodyPart = 'all' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full_body' | 'cardio';
type Difficulty = 'all' | 'beginner' | 'intermediate' | 'advanced';

export default function WorkoutsScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<Workout[]>([]);
  const [todayLogs, setTodayLogs] = useState<WorkoutLog[]>([]);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<string | null>(null);
  const [workoutTimer, setWorkoutTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Filters
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  
  // Get current day: 0=Monday, 1=Tuesday, ..., 6=Sunday
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
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
      await Promise.all([
        fetchWorkouts(), 
        fetchTodayLogs(), 
        checkTodayAttendance()
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

  const checkTodayAttendance = async () => {
    if (!user || !profile?.gym_id) return;
    
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', user.id)
        .eq('gym_id', profile.gym_id)
        .gte('check_in_time', todayDate)
        .limit(1)
        .single();

      setHasCheckedInToday(!!data && !error);
    } catch (error) {
      setHasCheckedInToday(false);
    }
  };

  const fetchWorkouts = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gym_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
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

      // Fetch global workouts
      const { data: globalWorkouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .is('gym_id', null)
        .order('name', { ascending: true });

      const allWorkouts = [...(gymWorkouts || []), ...(globalWorkouts || [])];
      setWorkouts(allWorkouts);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      Alert.alert('Error', 'Failed to fetch workouts');
    }
  };

  const applyFilters = useCallback((workoutsList: Workout[]) => {
    let filtered = workoutsList;

    // Filter by day
    const dayOfWeek = selectedDay === 6 ? 0 : selectedDay + 1;
    filtered = filtered.filter((workout) => {
      const workoutDay = workout.day_of_week === null || workout.day_of_week === undefined 
        ? null 
        : Number(workout.day_of_week);
      return workoutDay === null || workoutDay === dayOfWeek;
    });

    // Filter by body part
    if (selectedBodyPart !== 'all') {
      filtered = filtered.filter(w => w.body_part === selectedBodyPart);
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(w => w.difficulty === selectedDifficulty);
    }

    setFilteredWorkouts(filtered);
  }, [selectedDay, selectedBodyPart, selectedDifficulty]);

  useEffect(() => {
    if (workouts.length > 0) {
      applyFilters(workouts);
    }
  }, [selectedDay, selectedBodyPart, selectedDifficulty, workouts, applyFilters]);

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
    if (!hasCheckedInToday) {
      Alert.alert(
        'Check-in Required',
        'Please check in at the gym before starting a workout.',
        [{ text: 'OK' }]
      );
      return;
    }

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
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(
      'Are you sure? Your progress will not be saved.'
    );

    if (confirmed) {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setActiveWorkout(null);
      setWorkoutTimer(0);
    }
  } else {
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
      case 'beginner': return theme.colors.success;
      case 'intermediate': return theme.colors.warning;
      case 'advanced': return theme.colors.error;
      default: return theme.colors.textSecondary;
    }
  };

  const getBodyPartEmoji = (bodyPart: string) => {
    switch (bodyPart) {
      case 'chest': return '💪';
      case 'back': return '🦾';
      case 'legs': return '🦵';
      case 'shoulders': return '🏋️';
      case 'arms': return '💪';
      case 'core': return '🔥';
      case 'cardio': return '❤️';
      case 'full_body': return '🏃';
      default: return '💪';
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

  const activeFiltersCount = (selectedBodyPart !== 'all' ? 1 : 0) + (selectedDifficulty !== 'all' ? 1 : 0);

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    filterButtonTextActive: {
      color: theme.colors.card,
    },
    filterBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    checkInAlert: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.warning + '15',
      borderWidth: 1,
      borderColor: theme.colors.warning + '30',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checkInAlertText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.warning,
      fontWeight: '500',
    },
    filterPanel: {
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    filterSection: {
      marginBottom: 16,
    },
    filterSectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    filterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    videoButton: {
      width: '100%',
      minHeight: 48,
      marginBottom: 8,
    },
    videoModalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    videoModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    videoModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeVideoButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    filterChipTextActive: {
      color: theme.colors.card,
    },
    clearFiltersButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    clearFiltersText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.error,
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
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    dayButtonSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dayButtonToday: {
      borderColor: theme.colors.accent,
      borderWidth: 2,
    },
    dayButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    dayButtonTextSelected: {
      color: theme.colors.card,
    },
    dayButtonTextToday: {
      color: theme.colors.accent,
    },
    todayIndicator: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
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
      color: theme.colors.text,
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
      fontWeight: '700',
      color: theme.colors.primary,
    },
    summaryLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
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
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    noWorkoutsSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
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
    workoutNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    workoutEmoji: {
      fontSize: 24,
    },
    workoutName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
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
    },
    workoutDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    workoutMetaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    metaText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '600',
    },
    difficultyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
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
    },
    timerText: {
      fontSize: 40,
      fontWeight: '700',
      color: theme.colors.primary,
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
    startButtonDisabled: {
      opacity: 0.5,
    },
  });

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
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>Workouts</Text>
                <Text style={styles.subtitle}>Your training schedule</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  (showFilters || activeFiltersCount > 0) && styles.filterButtonActive
                ]}
                onPress={() => setShowFilters(!showFilters)}
                activeOpacity={0.7}
              >
                {showFilters ? (
                  <X size={18} color={theme.colors.card} />
                ) : (
                  <Filter size={18} color={activeFiltersCount > 0 ? theme.colors.card : theme.colors.primary} />
                )}
                <Text style={[
                  styles.filterButtonText,
                  (showFilters || activeFiltersCount > 0) && styles.filterButtonTextActive
                ]}>
                  Filter
                </Text>
                {activeFiltersCount > 0 && !showFilters && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Panel */}
          {showFilters && (
            <View style={styles.filterPanel}>
              {/* Body Part Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Body Part</Text>
                <View style={styles.filterChips}>
                  {(['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'] as BodyPart[]).map((part) => (
                    <TouchableOpacity
                      key={part}
                      style={[
                        styles.filterChip,
                        selectedBodyPart === part && styles.filterChipActive
                      ]}
                      onPress={() => setSelectedBodyPart(part)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedBodyPart === part && styles.filterChipTextActive
                      ]}>
                        {part === 'full_body' ? 'Full Body' : part}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Difficulty Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Difficulty</Text>
                <View style={styles.filterChips}>
                  {(['all', 'beginner', 'intermediate', 'advanced'] as Difficulty[]).map((diff) => (
                    <TouchableOpacity
                      key={diff}
                      style={[
                        styles.filterChip,
                        selectedDifficulty === diff && styles.filterChipActive
                      ]}
                      onPress={() => setSelectedDifficulty(diff)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedDifficulty === diff && styles.filterChipTextActive
                      ]}>
                        {diff}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    setSelectedBodyPart('all');
                    setSelectedDifficulty('all');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearFiltersText}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Check-in Alert */}
          {!hasCheckedInToday && (
            <View style={styles.checkInAlert}>
              <AlertCircle size={24} color={theme.colors.warning} />
              <Text style={styles.checkInAlertText}>
                Check in at the gym to unlock workouts
              </Text>
            </View>
          )}

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
                  <Text style={styles.summaryValue}>{todayStats.calories.toFixed(0)}</Text>
                  <Text style={styles.summaryLabel}>Calories</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Workouts List */}
          {filteredWorkouts.length === 0 ? (
            <Card style={styles.noWorkoutsCard}>
              <Dumbbell size={48} color={theme.colors.textSecondary} />
              <Text style={styles.noWorkoutsText}>No workouts found</Text>
              <Text style={styles.noWorkoutsSubtext}>
                {activeFiltersCount > 0 
                  ? 'Try adjusting your filters or select a different day'
                  : 'No workouts scheduled for this day'}
              </Text>
            </Card>
          ) : (
            filteredWorkouts.map((workout) => (
              <Card key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutTitleRow}>
                    <View style={styles.workoutNameRow}>
                      <Text style={styles.workoutEmoji}>
                        {getBodyPartEmoji(workout.body_part || 'full_body')}
                      </Text>
                      <Text style={styles.workoutName} numberOfLines={2}>
                        {workout.name}
                      </Text>
                    </View>
                    {isWorkoutCompleted(workout.id) && (
                      <View style={styles.completedBadge}>
                        <CheckCircle size={16} color={theme.colors.success} />
                        <Text style={styles.completedText}>Done</Text>
                      </View>
                    )}
                  </View>
                  
                  {workout.description && (
                    <Text style={styles.workoutDescription} numberOfLines={3}>
                      {workout.description}
                    </Text>
                  )}
                  
                  <View style={styles.workoutMetaGrid}>
                    {workout.sets && workout.reps && (
                      <View style={styles.metaItem}>
                        <Repeat size={16} color={theme.colors.primary} />
                        <Text style={styles.metaText}>
                          {workout.sets} × {workout.reps}
                        </Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Clock size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Flame size={16} color={theme.colors.error} />
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
    <>
      {/* Video Button */}
      {workout.video_url && (
        <Button
          title="Watch Video 🎥"
          onPress={() => {
            setSelectedVideoUrl(workout.video_url || null);
            setShowVideoModal(true);
          }}
          variant="outline"
          style={styles.videoButton}
        />
      )}
      
      {/* Start Workout Button */}
      {!isWorkoutCompleted(workout.id) && (
        <Button
          title={hasCheckedInToday ? "Start Workout" : "Check-in Required"}
          onPress={() => startWorkout(workout.id)}
          disabled={!hasCheckedInToday || activeWorkout !== null}
          style={[
            styles.startButton,
            !hasCheckedInToday && styles.startButtonDisabled
          ]}
        />
      )}
    </>
  )}
</View>
              </Card>
            ))
          )}
        </ScrollView>
        <Modal
          visible={showVideoModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowVideoModal(false)}
        >
          <SafeAreaView style={styles.videoModalContainer}>
            <View style={styles.videoModalHeader}>
              <Text style={styles.videoModalTitle}>Workout Tutorial</Text>
              <TouchableOpacity
                onPress={() => setShowVideoModal(false)}
                style={styles.closeVideoButton}
              >
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedVideoUrl && (
              <>
                {Platform.OS === 'web' ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(selectedVideoUrl)}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <WebView
                    source={{ 
                      uri: `https://www.youtube.com/embed/${getYouTubeVideoId(selectedVideoUrl)}` 
                    }}
                    style={{ flex: 1 }}
                    allowsFullscreenVideo
                    javaScriptEnabled
                    domStorageEnabled
                  />
                )}
              </>
            )}
          </SafeAreaView>
        </Modal>
      </Animated.View>

      
    </SafeAreaView>
  );
}