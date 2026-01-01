import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Workout } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Plus, Clock, Flame, Edit, Trash2, X } from 'lucide-react-native';


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
      
      // Build query based on role
      let query = supabase
        .from('workouts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      // Filter by gym_id for gym owners
      if (profile?.role === 'gym_owner' && profile?.gym_id) {
        // Show workouts for this gym OR global workouts (gym_id is null)
        query = query.or(`gym_id.eq.${profile.gym_id},gym_id.is.null`);
      }
      // Admins can see all workouts (no filter needed)
      
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

  const addOrUpdateWorkout = async () => {
    if (!newWorkout.name || !newWorkout.category || !newWorkout.duration_minutes) {
      Alert.alert('Error', 'Please fill in all required fields');
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
        gym_id: profile?.gym_id || null, // IMPORTANT: Link to gym
        created_by: user?.id,
        is_active: true,
        day_of_week: newWorkout.day_of_week ? parseInt(newWorkout.day_of_week) : null,
        instructions: newWorkout.instructions.trim() 
          ? newWorkout.instructions.split('\n').filter(i => i.trim())
          : null,
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

  // Web confirmation
  if (Platform.OS === "web") {
    const ok = window.confirm(message);
    if (!ok) return;
  }

  // Mobile confirmation
  else {
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
      .eq("id", workoutId)
      .select("*");

    if (error) {
      console.error("❌ Delete error:", error);
      if (Platform.OS === "web") alert("Failed to delete workout");
      else Alert.alert("Error", "Failed to delete workout");
      return;
    }

    // Update UI instantly
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));

    // Success message
    if (Platform.OS === "web") {
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
    });
    setShowAddWorkout(false);
  };

  const getDayName = (dayNumber: number | undefined | null) => {
    if (dayNumber === undefined || dayNumber === null) return 'Any Day';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Any Day';
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
    workoutName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
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
      gap: 16,
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
      shadowOffset: {
        width: 0,
        height: 2,
      },
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
                <Text style={styles.workoutName}>{workout.name}</Text>
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
                      {workout.calories_per_minute || 5} cal/min
                    </Text>
                  </View>
                  <Text style={styles.dayText}>{getDayName(workout.day_of_week)}</Text>
                </View>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{workout.category}</Text>
                  <Text style={styles.difficultyText}>• {workout.difficulty}</Text>
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