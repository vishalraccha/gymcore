import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Modal, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DietLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Plus, X, UtensilsCrossed, Target } from 'lucide-react-native';

export default function DietScreen() {
  const { user } = useAuth();
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
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

  const todayDate = new Date().toISOString().split('T')[0];

  const targets = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
  };

  const mealTypeConfig = {
    breakfast: { icon: '🌅', color: '#F59E0B', name: 'Breakfast' },
    lunch: { icon: '☀️', color: '#10B981', name: 'Lunch' },
    dinner: { icon: '🌙', color: '#6366F1', name: 'Dinner' },
    snack: { icon: '🍎', color: '#EF4444', name: 'Snacks' },
  };

  useEffect(() => {
    fetchTodayDiet();
  }, []);

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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>Track your daily nutrition goals</Text>
        </View>

        {/* Nutrition Overview */}
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Target size={24} color="#3B82F6" />
            <Text style={styles.overviewTitle}>Today's Progress</Text>
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
        </Card>

        {/* Detailed Progress */}
        <Card style={styles.progressCard}>
          <Text style={styles.progressTitle}>Detailed Progress</Text>
          <View style={styles.progressBars}>
            <ProgressBar
              label="Calories"
              current={nutrition.calories}
              target={targets.calories}
              unit="kcal"
              color="#3B82F6"
            />
            <ProgressBar
              label="Protein"
              current={nutrition.protein}
              target={targets.protein}
              unit="g"
              color="#10B981"
            />
            <ProgressBar
              label="Carbs"
              current={nutrition.carbs}
              target={targets.carbs}
              unit="g"
              color="#F59E0B"
            />
            <ProgressBar
              label="Fat"
              current={nutrition.fat}
              target={targets.fat}
              unit="g"
              color="#EF4444"
            />
          </View>
        </Card>

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
                  <UtensilsCrossed size={24} color="#CBD5E1" />
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
        <Plus size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Add Meal Modal */}
      <Modal
        visible={showAddMeal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Meal</Text>
            <TouchableOpacity onPress={() => setShowAddMeal(false)}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Meal Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Grilled Chicken Salad"
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
                    onPress={() => setNewMeal({ ...newMeal, meal_type: type as any })}
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
      </Modal>
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
    color: '#0F172A',
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
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    fontFamily: 'Inter-Bold',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  nutritionTarget: {
    fontSize: 10,
    color: '#94A3B8',
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
    color: '#0F172A',
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
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  mealCount: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealCountText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  mealsList: {
    gap: 8,
  },
  mealItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  mealNutrition: {
    gap: 2,
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'Inter-SemiBold',
  },
  mealMacros: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  emptyMealContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noMealsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontFamily: 'Inter-Regular',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
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
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  mealTypeButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  mealTypeIcon: {
    fontSize: 16,
  },
  mealTypeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
    fontFamily: 'Inter-Regular',
  },
  mealTypeButtonTextActive: {
    color: '#ffffff',
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
  },
});