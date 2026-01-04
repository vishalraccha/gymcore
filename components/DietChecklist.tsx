import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Circle, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react-native';
import DietDetailModal from './DietDetailModal';

interface DietPlan {
  id: string;
  meal_name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
  instructions: string;
  ingredients: string[];
}

interface CompletedMeal {
  meal_name: string;
  meal_type: string;
}

export default function DietChecklist() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [completedMeals, setCompletedMeals] = useState<CompletedMeal[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DietPlan | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchPersonalDietPlans(), fetchCompletedMeals()]);
    setIsLoading(false);
  };

  const fetchPersonalDietPlans = async () => {
    try {
      // Get personal training assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('personal_training_assignments')
        .select('id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single
  
      if (assignmentError) {
        console.error('Error fetching assignment:', assignmentError);
        setPlans([]);
        return;
      }
  
      if (!assignment) {
        console.log('No active personal training assignment found');
        setPlans([]);
        return;
      }
  
      // Get personal diet plans
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('personal_training_id', assignment.id)
        .eq('is_personal', true)
        .eq('is_active', true)
        .order('meal_type');
  
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching diet plans:', error);
      setPlans([]);
    }
  };

  const fetchCompletedMeals = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('diet_logs')
        .select('meal_name, meal_type')
        .eq('user_id', user?.id)
        .eq('log_date', today);

      if (error) throw error;
      setCompletedMeals(data || []);
    } catch (error) {
      console.error('Error fetching completed meals:', error);
      setCompletedMeals([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const isCompleted = (mealName: string, mealType: string) => {
    return completedMeals.some(
      (m) => m.meal_name === mealName && m.meal_type === mealType
    );
  };

  const handleMealPress = (plan: DietPlan) => {
    setSelectedPlan(plan);
    setShowDetail(true);
  };

  const handleMealComplete = async () => {
    await fetchCompletedMeals();
    setShowDetail(false);
  };

  const groupedPlans = {
    breakfast: plans.filter((p) => p.meal_type === 'breakfast'),
    lunch: plans.filter((p) => p.meal_type === 'lunch'),
    dinner: plans.filter((p) => p.meal_type === 'dinner'),
    snack: plans.filter((p) => p.meal_type === 'snack'),
  };

  const totalMeals = plans.length;
  const completedCount = completedMeals.length;



  if (plans.length === 0) {
    return null; // Don't show if no plans
  }

  const styles = StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.colors.primary + '10',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    progressText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
      marginRight: 8,
    },
    content: {
      backgroundColor: theme.colors.card,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionIcon: {
      marginRight: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      textTransform: 'capitalize',
    },
    mealItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    mealItemCompleted: {
      opacity: 0.6,
      backgroundColor: theme.colors.success + '10',
    },
    checkIcon: {
      marginRight: 12,
    },
    mealInfo: {
      flex: 1,
    },
    mealName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    mealMacros: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    emptyState: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
  });

  const mealTypeIcons: Record<string, string> = {
    breakfast: '🍳',
    lunch: '🍱',
    dinner: '🍽️',
    snack: '🍎',
  };
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading your meal plan...
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Personal Training Meal Plan</Text>
            <Text style={styles.headerSubtitle}>
              Your custom diet plan from your trainer
            </Text>
          </View>
          <Text style={styles.progressText}>
            {completedCount}/{totalMeals}
          </Text>
          {isExpanded ? (
            <ChevronUp size={20} color={theme.colors.text} />
          ) : (
            <ChevronDown size={20} color={theme.colors.text} />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
          >
            {Object.entries(groupedPlans).map(([mealType, meals]) => {
              if (meals.length === 0) return null;

              return (
                <View key={mealType}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>
                      {mealTypeIcons[mealType]}
                    </Text>
                    <Text style={styles.sectionTitle}>{mealType}</Text>
                  </View>

                  {meals.map((plan) => {
                    const completed = isCompleted(plan.meal_name, plan.meal_type);

                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[
                          styles.mealItem,
                          completed && styles.mealItemCompleted,
                        ]}
                        onPress={() => handleMealPress(plan)}
                        disabled={completed}
                        activeOpacity={0.7}
                      >
                        <View style={styles.checkIcon}>
                          {completed ? (
                            <CheckCircle size={24} color={theme.colors.success} />
                          ) : (
                            <Circle size={24} color={theme.colors.border} />
                          )}
                        </View>

                        <View style={styles.mealInfo}>
                          <Text style={styles.mealName}>{plan.meal_name}</Text>
                          <Text style={styles.mealMacros}>
                            {plan.calories || 0} cal • P: {plan.protein || 0}g • C:{' '}
                            {plan.carbs || 0}g • F: {plan.fat || 0}g
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            {totalMeals === completedCount && (
              <View style={styles.emptyState}>
                <CheckCircle size={48} color={theme.colors.success} />
                <Text style={[styles.emptyText, { color: theme.colors.success }]}>
                  All meals completed for today! 🎉
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {selectedPlan && (
        <DietDetailModal
          plan={selectedPlan}
          visible={showDetail}
          onClose={() => setShowDetail(false)}
          onComplete={handleMealComplete}
        />
      )}
    </>
  );
}