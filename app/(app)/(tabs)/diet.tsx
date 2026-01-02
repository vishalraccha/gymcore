import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Modal, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DietLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Plus, X, UtensilsCrossed, Target } from 'lucide-react-native';
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DietChecklist from '@/components/DietChecklist';

export default function DietScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
  const [dietPlans, setDietPlans] = useState<any[]>([]);
  const [filteredDietPlans, setFilteredDietPlans] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newMeal, setNewMeal] = useState({
    meal_name: '',
    meal_type: 'breakfast' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;
  const FAB_BOTTOM_OFFSET = TAB_BAR_HEIGHT + 16;

  const targets = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
  };

  const mealTypeConfig = {
    breakfast: { icon: '🌅', color: theme.colors.warning, name: 'Breakfast' },
    lunch: { icon: '☀️', color: theme.colors.success, name: 'Lunch' },
    dinner: { icon: '🌙', color: theme.colors.accent, name: 'Dinner' },
    snack: { icon: '🍎', color: theme.colors.error, name: 'Snacks' },
  };

  useEffect(() => {
    fetchTodayDiet();
    fetchDietPlans();
  }, []);

  useEffect(() => {
    if (dietPlans.length > 0) {
      filterDietPlansByDay(dietPlans, selectedDay);
    }
  }, [selectedDay, dietPlans]);

  const fetchTodayDiet = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('diet_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', todayDate)
        .order('logged_at', { ascending: false });

      if (!error && data) {
        setDietLogs(data);
      }
    } catch (error) {
      console.warn('Error fetching diet logs:', error);
    }
  };

  const fetchDietPlans = async () => {
    if (!user) return;

    try {
      // Get user's profile with personal training flag
      const { data: profile } = await supabase
        .from('profiles')
        .select('gym_id, has_personal_training')
        .eq('id', user.id)
        .single();

      if (!profile?.gym_id) return;

      // ONLY show diet plans if user has personal training enabled
      if (!profile.has_personal_training) {
        setDietPlans([]);
        setFilteredDietPlans([]);
        return;
      }

      let allPlans: any[] = [];

      // Fetch personal training diet plans
      const { data: assignment } = await supabase
        .from('personal_training_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (assignment) {
        const { data: personalPlans, error: personalError } = await supabase
          .from('diet_plans')
          .select('*')
          .eq('personal_training_id', assignment.id)
          .eq('is_active', true)
          .order('day_of_week', { ascending: true })
          .order('meal_type', { ascending: true });

        if (!personalError && personalPlans) {
          allPlans = [...allPlans, ...personalPlans];
        }
      }

      setDietPlans(allPlans);
      filterDietPlansByDay(allPlans, selectedDay);
    } catch (error) {
      console.warn('Error fetching diet plans:', error);
    }
  };

  const filterDietPlansByDay = useCallback((plansList: any[], day: number) => {
    // Convert selectedDay to day_of_week format (0=Sunday, 1=Monday, etc.)
    const dayOfWeek = day === 6 ? 0 : day + 1;

    const filtered = plansList.filter((plan) => {
      // Show plans with matching day_of_week OR plans without day_of_week (general plans)
      return plan.day_of_week === null || plan.day_of_week === dayOfWeek;
    });

    setFilteredDietPlans(filtered);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTodayDiet(), fetchDietPlans()]);
    setRefreshing(false);
  };

  const addMeal = async () => {
    if (!user || !newMeal.meal_name || !newMeal.calories) {
      Alert.alert('Error', 'Please fill in meal name and calories');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('diet_logs')
        .insert([
          {
            user_id: user.id,
            meal_name: newMeal.meal_name,
            meal_type: newMeal.meal_type,
            calories: parseFloat(newMeal.calories),
            protein: parseFloat(newMeal.protein || '0'),
            carbs: parseFloat(newMeal.carbs || '0'),
            fat: parseFloat(newMeal.fat || '0'),
            log_date: todayDate,
          },
        ]);

      if (!error) {
        setNewMeal({
          meal_name: '',
          meal_type: 'breakfast',
          calories: '',
          protein: '',
          carbs: '',
          fat: '',
        });
        setShowAddMeal(false);
        await fetchTodayDiet();
        Alert.alert('Success! 🎉', 'Meal logged successfully!');
      }
    } catch (error) {
      console.warn('Error adding meal:', error);
      Alert.alert('Error', 'Failed to log meal');
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalNutrition = () => {
    return dietLogs.reduce(
      (total, log) => ({
        calories: total.calories + Number(log.calories),
        protein: total.protein + Number(log.protein),
        carbs: total.carbs + Number(log.carbs),
        fat: total.fat + Number(log.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const getMealsByType = (type: string) => {
    return dietLogs.filter(log => log.meal_type === type);
  };

  const nutrition = getTotalNutrition();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      paddingBottom: 20,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 32,
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
    overviewCard: {
      marginHorizontal: 24,
      marginTop: 16,
      marginBottom: 16,
      padding: 20,
    },
    overviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      gap: 8,
    },
    overviewTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    nutritionGrid: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nutritionItem: {
      flex: 1,
      alignItems: 'center',
    },
    nutritionDivider: {
      width: 1,
      height: 60,
      backgroundColor: theme.colors.border,
      marginHorizontal: 12,
    },
    nutritionValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      fontFamily: 'Inter-Bold',
    },
    nutritionLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    nutritionTarget: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    progressCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    progressTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
      fontFamily: 'Inter-Bold',
    },
    progressBars: {
      gap: 4,
    },
    mealCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    mealHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    mealTypeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    mealIcon: {
      fontSize: 20,
    },
    mealTypeTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    mealCount: {
      backgroundColor: theme.colors.border + '40',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    mealCountText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    mealsList: {
      gap: 8,
    },
    mealItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mealInfo: {
      flex: 1,
    },
    mealName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      fontFamily: 'Inter-SemiBold',
    },
    mealNutrition: {
      gap: 2,
    },
    mealCalories: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      fontFamily: 'Inter-SemiBold',
    },
    mealMacros: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    emptyMealContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    noMealsText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    fab: {
      position: 'absolute',
      bottom: FAB_BOTTOM_OFFSET,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    daySelectorContainer: {
      marginBottom: 16,
      paddingHorizontal: 24,
    },
    daySelectorScroll: {
      gap: 8,
    },
    dayButton: {
      minWidth: 50,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
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
      top: 4,
      right: 4,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
    },
    dietPlansCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    dietPlansHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    dietPlansTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    planItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    planMealType: {
      marginBottom: 8,
    },
    planMealTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
      textTransform: 'uppercase',
    },
    planInfo: {
      flex: 1,
    },
    planName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    planDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    planNutrition: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    planNutritionText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    planInstructions: {
      marginTop: 8,
    },
    planInstructionText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
      marginBottom: 4,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 24,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    modalContent: {
      flex: 1,
      padding: 24,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      fontFamily: 'Inter-SemiBold',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      fontFamily: 'Inter-Regular',
    },
    mealTypeSelector: {
      gap: 8,
    },
    mealTypeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      gap: 8,
    },
    mealTypeButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    mealTypeIcon: {
      fontSize: 16,
    },
    mealTypeButtonText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      fontFamily: 'Inter-Regular',
    },
    mealTypeButtonTextActive: {
      color: theme.colors.card,
    },
    nutritionInputs: {
      gap: 16,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputHalf: {
      flex: 1,
    },
    addButton: {
      marginTop: 24,
      marginBottom: 40,
    },
  });

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: FAB_BOTTOM_OFFSET + 20 }}
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
            <Text style={styles.title}>Nutrition</Text>
            <Text style={styles.subtitle}>Track your daily nutrition goals</Text>
          </View>

          {/* Day Selector */}
          {/* <View style={styles.daySelectorContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daySelectorScroll}
          >
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              const isSelected = selectedDay === index;
              const isToday = (() => {
                const today = new Date().getDay();
                const todayIndex = today === 0 ? 6 : today - 1;
                return todayIndex === index;
              })();

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                    isToday && !isSelected && styles.dayButtonToday,
                  ]}
                  onPress={() => setSelectedDay(index)}
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
                  {isToday && (
                    <View style={styles.todayIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View> */}

          {/* Nutrition Overview */}
          {/* <Card style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Target size={24} color={theme.colors.primary} />
              <Text style={styles.overviewTitle}>Todays Progress</Text>
            </View>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{nutrition.calories.toFixed(0)}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
                <Text style={styles.nutritionTarget}>/{targets.calories}</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{nutrition.protein.toFixed(0)}</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
                <Text style={styles.nutritionTarget}>/{targets.protein}g</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{nutrition.carbs.toFixed(0)}</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
                <Text style={styles.nutritionTarget}>/{targets.carbs}g</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{nutrition.fat.toFixed(0)}</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
                <Text style={styles.nutritionTarget}>/{targets.fat}g</Text>
              </View>
            </View>
          </Card> */}

          {/* Detailed Progress */}
          <Card style={styles.progressCard}>
            <Text style={styles.progressTitle}>Todays Progress</Text>
            <View style={styles.progressBars}>
              <ProgressBar
                label="Calories"
                current={nutrition.calories}
                target={targets.calories}
                unit="kcal"
                color={theme.colors.primary}
              />
              <ProgressBar
                label="Protein"
                current={nutrition.protein}
                target={targets.protein}
                unit="g"
                color={theme.colors.success}
              />
              <ProgressBar
                label="Carbs"
                current={nutrition.carbs}
                target={targets.carbs}
                unit="g"
                color={theme.colors.warning}
              />
              <ProgressBar
                label="Fat"
                current={nutrition.fat}
                target={targets.fat}
                unit="g"
                color={theme.colors.error}
              />
            </View>
          </Card>
          {profile?.has_personal_training && <DietChecklist />}

          {/* Meals by Type */}
          {Object.entries(mealTypeConfig).map(([mealType, config]) => (
            <Card key={mealType} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealTypeInfo}>
                  <Text style={styles.mealIcon}>{config.icon}</Text>
                  <Text style={styles.mealTypeTitle}>{config.name}</Text>
                </View>
                <View style={styles.mealCount}>
                  <Text style={styles.mealCountText}>
                    {getMealsByType(mealType).length} item{getMealsByType(mealType).length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.mealsList}>
                {getMealsByType(mealType).map((meal) => (
                  <View key={meal.id} style={styles.mealItem}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>{meal.meal_name}</Text>
                      <View style={styles.mealNutrition}>
                        <Text style={styles.mealCalories}>{Number(meal.calories).toFixed(0)} cal</Text>
                        <Text style={styles.mealMacros}>
                          P: {Number(meal.protein).toFixed(0)}g • C: {Number(meal.carbs).toFixed(0)}g • F: {Number(meal.fat).toFixed(0)}g
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {getMealsByType(mealType).length === 0 && (
                  <View style={styles.emptyMealContainer}>
                    <UtensilsCrossed size={24} color={theme.colors.border} />
                    <Text style={styles.noMealsText}>No {config.name.toLowerCase()} logged yet</Text>
                  </View>
                )}
              </View>
            </Card>
          ))}
        </ScrollView>

        {/* Add Meal Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddMeal(true)}
        >
          <Plus size={24} color={theme.colors.card} />
        </TouchableOpacity>

        {/* Add Meal Modal */}
        <Modal
          visible={showAddMeal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaWrapper edges={['top', 'bottom']}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Meal</Text>
                <TouchableOpacity onPress={() => setShowAddMeal(false)}>
                  <X size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Meal Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Grilled Chicken Salad"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={newMeal.meal_name}
                    onChangeText={(text) => setNewMeal({ ...newMeal, meal_name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Meal Type</Text>
                  <View style={styles.mealTypeSelector}>
                    {Object.entries(mealTypeConfig).map(([type, config]) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.mealTypeButton,
                          newMeal.meal_type === type && styles.mealTypeButtonActive,
                        ]}
                        onPress={() => setNewMeal({ ...newMeal, meal_type: type as 'breakfast' | 'lunch' | 'dinner' | 'snack' })}
                      >
                        <Text style={styles.mealTypeIcon}>{config.icon}</Text>
                        <Text
                          style={[
                            styles.mealTypeButtonText,
                            newMeal.meal_type === type && styles.mealTypeButtonTextActive,
                          ]}
                        >
                          {config.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.nutritionInputs}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Calories *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMeal.calories}
                      onChangeText={(text) => setNewMeal({ ...newMeal, calories: text })}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputHalf}>
                      <Text style={styles.inputLabel}>Protein (g)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newMeal.protein}
                        onChangeText={(text) => setNewMeal({ ...newMeal, protein: text })}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputHalf}>
                      <Text style={styles.inputLabel}>Carbs (g)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newMeal.carbs}
                        onChangeText={(text) => setNewMeal({ ...newMeal, carbs: text })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMeal.fat}
                      onChangeText={(text) => setNewMeal({ ...newMeal, fat: text })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Button
                  title="Add Meal"
                  onPress={addMeal}
                  isLoading={isLoading}
                  style={styles.addButton}
                />
              </ScrollView>
            </View>
          </SafeAreaWrapper>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}