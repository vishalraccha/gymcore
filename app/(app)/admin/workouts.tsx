import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Workout } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Plus, Clock, Flame, Edit, Trash2, X, Repeat, Video } from 'lucide-react-native';

type BodyPart = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full_body' | 'cardio';

export default function WorkoutsManagementScreen() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [newWorkout, setNewWorkout] = useState({
    name: '',
    description: '',
    category: '',
    duration_minutes: '',
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    calories_per_minute: '5',
    day_of_week: '',
    instructions: '',
    sets: '3',
    reps: '12',
    body_part: 'full_body' as BodyPart,
    video_url: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
      fetchWorkouts();
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkouts();
    setRefreshing(false);
  };

  const fetchWorkouts = async () => {
    setIsLoading(true);
    try {
      console.log('🏋️ Fetching workouts for gym:', profile?.gym_id);
      
      let query = supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (profile?.role === 'gym_owner' && profile?.gym_id) {
        query = query.or(`gym_id.eq.${profile.gym_id},gym_id.is.null`);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching workouts:', error);
        Alert.alert('Error', 'Failed to fetch workouts');
      } else {
        console.log(`✅ Fetched ${data?.length || 0} workouts`);
        setWorkouts(data || []);
      }
    } catch (error) {
      console.error('❌ Exception fetching workouts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateYouTubeUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
  };

  const addOrUpdateWorkout = async () => {
    if (!newWorkout.name || !newWorkout.category || !newWorkout.duration_minutes) {
      window.alert('Please fill in all required fields (Name, Category, Duration)')
      Alert.alert('Error', 'Please fill in all required fields (Name, Category, Duration)');
      return;
    }

    if (newWorkout.video_url && !validateYouTubeUrl(newWorkout.video_url)) {
      window.alert('Please enter a valid YouTube URL')
      Alert.alert('Error', 'Please enter a valid YouTube URL');
      return;
    }

    setIsSaving(true);

    try {
      const workoutData = {
        name: newWorkout.name.trim(),
        description: newWorkout.description.trim() || null,
        category: newWorkout.category.trim(),
        duration_minutes: parseInt(newWorkout.duration_minutes),
        difficulty: newWorkout.difficulty,
        calories_per_minute: parseFloat(newWorkout.calories_per_minute),
        gym_id: profile?.gym_id || null,
        created_by: user?.id,
        is_active: true,
        day_of_week: newWorkout.day_of_week ? parseInt(newWorkout.day_of_week) : null,
        instructions: newWorkout.instructions.trim() 
          ? newWorkout.instructions.split('\n').filter(i => i.trim())
          : null,
        sets: parseInt(newWorkout.sets) || 3,
        reps: parseInt(newWorkout.reps) || 12,
        body_part: newWorkout.body_part,
        video_url: newWorkout.video_url.trim() || null,
      };

      console.log('💾 Saving workout:', workoutData);

      if (editingWorkout) {
        const { error } = await supabase
          .from('workouts')
          .update(workoutData)
          .eq('id', editingWorkout.id);

        if (error) throw error;
        console.log('✅ Workout updated');
      } else {
        const { error } = await supabase
          .from('workouts')
          .insert([workoutData]);

        if (error) throw error;
        console.log('✅ Workout created');
      }

      resetForm();
      await fetchWorkouts();
      Alert.alert('Success', `Workout ${editingWorkout ? 'updated' : 'added'} successfully!`);
    } catch (error) {
      console.error('❌ Error saving workout:', error);
      const message = error instanceof Error ? error.message : 'Failed to save workout';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    if (!workoutId) return;

    const message = "Are you sure you want to delete this workout?";

    if (Platform.OS === "web") {
      const ok = window.confirm(message);
      if (!ok) return;
    } else {
      const result = await new Promise((resolve) => {
        Alert.alert(
          "Delete Workout",
          message,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ],
          { cancelable: true }
        );
      });

      if (!result) return;
    }

    try {
      console.log("🗑️ Deleting workout:", workoutId);

      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);

      if (error) {
        console.error("❌ Delete error:", error);
        if (Platform.OS === "web") alert("Failed to delete workout");
        else Alert.alert("Error", "Failed to delete workout");
        return;
      }

      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));

      if (Platform.OS === "web") {
        window.alert("Workout deleted successfully")
        alert("Workout deleted successfully");
      } else {
        Alert.alert("Success", "Workout deleted successfully");
      }
    } catch (err) {
      console.error("❌ Delete exception:", err);
      if (Platform.OS === "web") alert("Unexpected error deleting workout");
      else Alert.alert("Error", "Unexpected error deleting workout");
    }
  };

  const editWorkout = (workout: Workout) => {
    setEditingWorkout(workout);
    setNewWorkout({
      name: workout.name,
      description: workout.description || '',
      category: workout.category,
      duration_minutes: workout.duration_minutes.toString(),
      difficulty: workout.difficulty,
      calories_per_minute: workout.calories_per_minute?.toString() || '5',
      day_of_week: workout.day_of_week?.toString() || '',
      instructions: Array.isArray(workout.instructions) 
        ? workout.instructions.join('\n') 
        : workout.instructions || '',
      sets: workout.sets?.toString() || '3',
      reps: workout.reps?.toString() || '12',
      body_part: (workout.body_part as BodyPart) || 'full_body',
      video_url: workout.video_url || '',
    });
    setShowAddWorkout(true);
  };

  const resetForm = () => {
    setEditingWorkout(null);
    setNewWorkout({
      name: '',
      description: '',
      category: '',
      duration_minutes: '',
      difficulty: 'beginner',
      calories_per_minute: '5',
      day_of_week: '',
      instructions: '',
      sets: '3',
      reps: '12',
      body_part: 'full_body',
      video_url: '',
    });
    setShowAddWorkout(false);
  };

  const getDayName = (dayNumber: number | undefined | null) => {
    if (dayNumber === undefined || dayNumber === null) return 'Any Day';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Any Day';
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
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    header: {
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    workoutCard: {
      marginHorizontal: 24,
      marginBottom: 12,
      padding: 16,
    },
    workoutHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    workoutInfo: {
      flex: 1,
      paddingRight: 12,
    },
    workoutNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    workoutEmoji: {
      fontSize: 20,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    workoutDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      lineHeight: 20,
    },
    workoutMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 8,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    dayText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    categoryText: {
      fontSize: 12,
      color: theme.colors.success,
      fontWeight: '600',
      backgroundColor: theme.colors.success + '30',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    difficultyText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    videoIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.error + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    videoText: {
      fontSize: 12,
      color: theme.colors.error,
      fontWeight: '600',
    },
    workoutActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.border + '40',
    },
    noWorkoutsCard: {
      marginHorizontal: 24,
      alignItems: 'center',
      paddingVertical: 48,
    },
    noWorkoutsText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    noWorkoutsSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    createButton: {
      minWidth: 200,
    },
    fab: {
      position: 'absolute',
      bottom: (Platform.OS === 'ios' ? 0 : 0) + 24 + 57,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    modalContent: {
      flex: 1,
      padding: 24,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 16,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputHalf: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    inputHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: -12,
      marginBottom: 12,
    },
    difficultySelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    difficultyButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
    },
    difficultyButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    difficultyButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    difficultyButtonTextActive: {
      color: theme.colors.card,
    },
    bodyPartSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    bodyPartButton: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    bodyPartButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    bodyPartEmoji: {
      fontSize: 16,
    },
    bodyPartText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    bodyPartTextActive: {
      color: theme.colors.card,
    },
    addButton: {
      marginTop: 16,
      marginBottom: 40,
    },
    daySelectorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    dayOption: {
      minWidth: 60,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayOptionSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dayOptionText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    dayOptionTextSelected: {
      color: theme.colors.card,
    },
  });

  if (isLoading && !refreshing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading workouts...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <ScrollView 
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
            <Text style={styles.title}>Workout Management</Text>
            <Text style={styles.subtitle}>
              {profile?.gym_id 
                ? 'Create and manage workout plans for your gym' 
                : 'Create and manage workout plans'}
            </Text>
          </View>

          {/* Workouts List */}
          {workouts.map((workout) => (
            <Card key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutInfo}>
                  <View style={styles.workoutNameRow}>
                    <Text style={styles.workoutEmoji}>
                      {getBodyPartEmoji(workout.body_part || 'full_body')}
                    </Text>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                  </View>
                  {workout.description && (
                    <Text style={styles.workoutDescription}>{workout.description}</Text>
                  )}
                  <View style={styles.workoutMeta}>
                    {workout.sets && workout.reps && (
                      <View style={styles.metaItem}>
                        <Repeat size={16} color={theme.colors.primary} />
                        <Text style={styles.metaText}>{workout.sets} × {workout.reps}</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Clock size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>{workout.duration_minutes} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Flame size={16} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>
                        {workout.calories_per_minute || 5} cal/min
                      </Text>
                    </View>
                    <Text style={styles.dayText}>{getDayName(workout.day_of_week)}</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{workout.category}</Text>
                    <Text style={styles.difficultyText}>• {workout.difficulty}</Text>
                    {workout.video_url && (
                      <View style={styles.videoIndicator}>
                        <Video size={12} color={theme.colors.error} />
                        <Text style={styles.videoText}>Video</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.workoutActions}>
                  <TouchableOpacity
                    onPress={() => editWorkout(workout)}
                    style={styles.actionButton}
                  >
                    <Edit size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteWorkout(workout.id)}
                    style={styles.actionButton}
                  >
                    <Trash2 size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))}

          {workouts.length === 0 && (
            <Card style={styles.noWorkoutsCard}>
              <Text style={styles.noWorkoutsText}>No workouts created yet</Text>
              <Text style={styles.noWorkoutsSubtext}>
                Create your first workout to get started
              </Text>
              <Button
                title="Create First Workout"
                onPress={() => setShowAddWorkout(true)}
                style={styles.createButton}
              />
            </Card>
          )}
        </ScrollView>

        {/* Add Workout FAB */}
        {workouts.length > 0 && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowAddWorkout(true)}
          >
            <Plus size={24} color={theme.colors.card} />
          </TouchableOpacity>
        )}

        {/* Add/Edit Workout Modal */}
        <Modal
          visible={showAddWorkout}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={resetForm}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingWorkout ? 'Edit Workout' : 'Add New Workout'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.input}
                placeholder="Workout Name *"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWorkout.name}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, name: text })}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWorkout.description}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, description: text })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TextInput
                style={styles.input}
                placeholder="Category (e.g., Cardio, Strength) *"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWorkout.category}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, category: text })}
              />

              {/* Body Part Selector */}
              <Text style={styles.inputLabel}>Body Part *</Text>
              <View style={styles.bodyPartSelector}>
                {(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body'] as BodyPart[]).map((part) => (
                  <TouchableOpacity
                    key={part}
                    style={[
                      styles.bodyPartButton,
                      newWorkout.body_part === part && styles.bodyPartButtonActive,
                    ]}
                    onPress={() => setNewWorkout({ ...newWorkout, body_part: part })}
                  >
                    <Text style={styles.bodyPartEmoji}>{getBodyPartEmoji(part)}</Text>
                    <Text
                      style={[
                        styles.bodyPartText,
                        newWorkout.body_part === part && styles.bodyPartTextActive,
                      ]}
                    >
                      {part === 'full_body' ? 'Full Body' : part}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sets and Reps */}
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <TextInput
                    style={styles.input}
                    placeholder="Sets *"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newWorkout.sets}
                    onChangeText={(text) => setNewWorkout({ ...newWorkout, sets: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <TextInput
                    style={styles.input}
                    placeholder="Reps *"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newWorkout.reps}
                    onChangeText={(text) => setNewWorkout({ ...newWorkout, reps: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <TextInput
                    style={styles.input}
                    placeholder="Duration (min) *"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newWorkout.duration_minutes}
                    onChangeText={(text) => setNewWorkout({ ...newWorkout, duration_minutes: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <TextInput
                    style={styles.input}
                    placeholder="Calories/min"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newWorkout.calories_per_minute}
                    onChangeText={(text) => setNewWorkout({ ...newWorkout, calories_per_minute: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Video URL */}
              <Text style={styles.inputLabel}>YouTube Video URL (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newWorkout.video_url}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, video_url: text })}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.inputHint}>
                Members will be able to watch this video tutorial
              </Text>

              <Text style={styles.inputLabel}>Difficulty</Text>
              <View style={styles.difficultySelector}>
                {['beginner', 'intermediate', 'advanced'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.difficultyButton,
                      newWorkout.difficulty === level && styles.difficultyButtonActive,
                    ]}
                    onPress={() => setNewWorkout({ ...newWorkout, difficulty: level as 'beginner' | 'intermediate' | 'advanced' })}
                  >
                    <Text
                      style={[
                        styles.difficultyButtonText,
                        newWorkout.difficulty === level && styles.difficultyButtonTextActive,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Day of Week</Text>
              <View style={styles.daySelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.dayOption,
                    newWorkout.day_of_week === '' && styles.dayOptionSelected,
                  ]}
                  onPress={() => setNewWorkout({ ...newWorkout, day_of_week: '' })}
                >
                  <Text
                    style={[
                      styles.dayOptionText,
                      newWorkout.day_of_week === '' && styles.dayOptionTextSelected,
                    ]}
                  >
                    Any Day
                  </Text>
                </TouchableOpacity>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayOption,
                      newWorkout.day_of_week === index.toString() && styles.dayOptionSelected,
                    ]}
                    onPress={() => setNewWorkout({ ...newWorkout, day_of_week: index.toString() })}
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        newWorkout.day_of_week === index.toString() && styles.dayOptionTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Instructions (one per line)"
                placeholderTextColor={theme.colors.textSecondary}
                value={newWorkout.instructions}
                onChangeText={(text) => setNewWorkout({ ...newWorkout, instructions: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Button
                title={editingWorkout ? 'Update Workout' : 'Add Workout'}
                onPress={addOrUpdateWorkout}
                isLoading={isSaving}
                style={styles.addButton}
              />
            </ScrollView>
          </View>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}