import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { X, CheckCircle } from 'lucide-react-native';

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

interface Props {
  plan: DietPlan;
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function DietDetailModal({ plan, visible, onClose, onComplete }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (!user) return;

    try {
      setIsCompleting(true);

      const today = new Date().toISOString().split('T')[0];

      // Check if already logged today
      const { data: existing } = await supabase
        .from('diet_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_name', plan.meal_name)
        .eq('meal_type', plan.meal_type)
        .eq('log_date', today)
        .single();

      if (existing) {
        Alert.alert('Already Completed', 'You have already logged this meal today.');
        return;
      }

      // Log the meal
      const { error } = await supabase.from('diet_logs').insert({
        user_id: user.id,
        meal_name: plan.meal_name,
        meal_type: plan.meal_type,
        calories: plan.calories || 0,
        protein: plan.protein || 0,
        carbs: plan.carbs || 0,
        fat: plan.fat || 0,
        log_date: today,
      });

      if (error) throw error;

      Alert.alert('Success', 'Meal logged successfully! 🎉');
      onComplete();
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert('Error', 'Failed to log meal. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const mealTypeColors: Record<string, string> = {
    breakfast: '#F59E0B',
    lunch: '#10B981',
    dinner: '#3B82F6',
    snack: '#8B5CF6',
  };

  const styles = StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    closeButton: {
      padding: 4,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
      marginRight: 12,
    },
    modalContent: {
      padding: 20,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 16,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
      textTransform: 'uppercase',
    },
    macrosContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    macroItem: {
      alignItems: 'center',
    },
    macroValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    macroLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    instructionItem: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    instructionNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    instructionNumberText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    instructionText: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 22,
    },
    ingredientItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
      marginRight: 12,
    },
    ingredientText: {
      fontSize: 15,
      color: theme.colors.text,
    },
    completeButton: {
      backgroundColor: theme.colors.success,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    completeButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
    completeButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
      marginLeft: 8,
    },
  });

  const instructions = plan.instructions
    ? plan.instructions.split('\n').filter((i) => i.trim())
    : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{plan.meal_name}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.badge,
                { backgroundColor: mealTypeColors[plan.meal_type] },
              ]}
            >
              <Text style={styles.badgeText}>{plan.meal_type}</Text>
            </View>

            {/* Macros */}
            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{plan.calories || 0}</Text>
                <Text style={styles.macroLabel}>Calories</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{plan.protein || 0}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{plan.carbs || 0}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{plan.fat || 0}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>

            {/* Description */}
            {plan.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{plan.description}</Text>
              </View>
            )}

            {/* Ingredients */}
            {plan.ingredients && plan.ingredients.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                {plan.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Instructions */}
            {instructions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                {instructions.map((instruction, index) => (
                  <View key={index} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Complete Button */}
            <TouchableOpacity
              style={[
                styles.completeButton,
                isCompleting && styles.completeButtonDisabled,
              ]}
              onPress={handleComplete}
              disabled={isCompleting}
              activeOpacity={0.8}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>
                    Mark as Completed
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}