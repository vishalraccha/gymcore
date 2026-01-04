import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Plus, X, User, UtensilsCrossed, Edit, Trash2 } from 'lucide-react-native';

export default function PersonalTrainingScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [dietPlans, setDietPlans] = useState<any[]>([]);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    meal_name: '',
    meal_type: 'breakfast' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    day_of_week: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    description: '',
    instructions: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchPersonalTrainingMembers();
    }
  }, [profile]);

  const fetchPersonalTrainingMembers = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('has_personal_training', true)
        .eq('role', 'member');

      if (profile?.role === 'gym_owner' && profile.gym_id) {
        query = query.eq('gym_id', profile.gym_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      Alert.alert('Error', 'Failed to fetch members');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDietPlans = async (memberId: string) => {
    try {
      // Get personal training assignment
      const { data: assignment } = await supabase
        .from('personal_training_assignments')
        .select('id')
        .eq('user_id', memberId)
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle
  
      if (!assignment) {
        setDietPlans([]);
        return;
      }
  
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('personal_training_id', assignment.id)
        .eq('is_active', true)
        .order('meal_type', { ascending: true });
  
      if (error) throw error;
      setDietPlans(data || []);
    } catch (error) {
      console.error('Error fetching diet plans:', error);
      setDietPlans([]);
    }
  };

  const handleMemberSelect = (member: any) => {
    setSelectedMember(member);
    fetchDietPlans(member.id);
  };

  const addDietPlan = async () => {
    if (!selectedMember || !newPlan.meal_name) {
      Alert.alert('Error', 'Please fill in meal name');
      return;
    }
  
    try {
      // Get or create personal training assignment
      let { data: assignment, error: assignmentError } = await supabase
        .from('personal_training_assignments')
        .select('id')
        .eq('user_id', selectedMember.id)
        .eq('is_active', true)
        .maybeSingle();
  
      // If no assignment exists, create one
      if (!assignment) {
        const { data: newAssignment, error: createError } = await supabase
          .from('personal_training_assignments')
          .insert({
            user_id: selectedMember.id,
            gym_id: profile?.gym_id,
            assigned_by: profile?.id,
            is_active: true,
            start_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();
  
        if (createError) throw createError;
        assignment = newAssignment;
  
        // Also update the member's profile to mark them as having PT
        await supabase
          .from('profiles')
          .update({ has_personal_training: true })
          .eq('id', selectedMember.id);
      }
  
      if (!assignment) {
        Alert.alert('Error', 'Failed to create personal training assignment');
        return;
      }
  
      const { error } = await supabase.from('diet_plans').insert([
        {
          gym_id: profile?.gym_id,
          name: `${selectedMember.full_name} - ${newPlan.meal_type}`,
          meal_name: newPlan.meal_name,
          meal_type: newPlan.meal_type,
          calories: newPlan.calories ? parseFloat(newPlan.calories) : null,
          protein: newPlan.protein ? parseFloat(newPlan.protein) : null,
          carbs: newPlan.carbs ? parseFloat(newPlan.carbs) : null,
          fat: newPlan.fat ? parseFloat(newPlan.fat) : null,
          description: newPlan.description || null,
          instructions: newPlan.instructions || null,
          is_personal: true,
          personal_training_id: assignment.id,
          created_by: profile?.id,
        },
      ]);
  
      if (error) throw error;
  
      Alert.alert('Success', 'Diet plan added successfully');
      setNewPlan({
        meal_name: '',
        meal_type: 'breakfast',
        day_of_week: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        description: '',
        instructions: '',
      });
      setShowAddPlan(false);
      fetchDietPlans(selectedMember.id);
    } catch (error) {
      console.error('Error adding diet plan:', error);
      Alert.alert('Error', 'Failed to add diet plan');
    }
  };

  const deleteDietPlan = async (planId: string) => {
    Alert.alert(
      'Delete Diet Plan',
      'Are you sure you want to delete this diet plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('diet_plans')
                .update({ is_active: false })
                .eq('id', planId);

              if (error) throw error;
              if (selectedMember) fetchDietPlans(selectedMember.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete diet plan');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPersonalTrainingMembers();
    if (selectedMember) {
      await fetchDietPlans(selectedMember.id);
    }
    setRefreshing(false);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    memberCard: {
      marginHorizontal: 24,
      marginBottom: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    memberEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    plansCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    plansHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    plansTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    planItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    planName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    planDetails: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    fab: {
      position: 'absolute',
      bottom: 24 + 57,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    modalContent: {
      flex: 1,
      padding: 24,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 20,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
  });

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Personal Training</Text>
            <Text style={styles.subtitle}>
              Manage custom diet plans for personal training members
            </Text>
          </View>

          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>
                Loading members...
              </Text>
            </View>
          ) : members.length === 0 ? (
            <Card style={{ marginHorizontal: 24, marginTop: 16, padding: 40, alignItems: 'center' }}>
              <User size={48} color={theme.colors.textSecondary} />
              <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text, marginTop: 16, marginBottom: 8 }}>
                No Personal Training Members
              </Text>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
                Enable personal training for members in the Members section to manage their custom diet plans here.
              </Text>
            </Card>
          ) : (
            <>
              {/* Members List */}
              {members.map((member) => (
            <TouchableOpacity
              key={member.id}
              onPress={() => handleMemberSelect(member)}
            >
              <Card
                style={{
                  ...styles.memberCard,
                  ...(selectedMember?.id === member.id ? {
                    borderWidth: 2,
                    borderColor: theme.colors.primary,
                  } : {}),
                }}
              >
                <View style={styles.memberInfo}>
                  <User size={24} color={theme.colors.primary} />
                  <View>
                    <Text style={styles.memberName}>{member.full_name}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}

          {/* Diet Plans for Selected Member */}
          {selectedMember && (
            <Card style={styles.plansCard}>
              <View style={styles.plansHeader}>
                <Text style={styles.plansTitle}>
                  Diet Plans for {selectedMember.full_name}
                </Text>
                <TouchableOpacity onPress={() => setShowAddPlan(true)}>
                  <Plus size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {dietPlans.map((plan) => (
                <View key={plan.id} style={styles.planItem}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{plan.meal_name}</Text>
                      <Text style={styles.planDetails}>
                        {plan.meal_type} • {plan.calories || 0} cal
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteDietPlan(plan.id)}>
                      <Trash2 size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {dietPlans.length === 0 && (
                <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: 20 }}>
                  No diet plans yet. Add one to get started.
                </Text>
              )}
            </Card>
              )}
            </>
          )}
        </ScrollView>

        {/* Add Plan FAB */}
        {selectedMember && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowAddPlan(true)}
          >
            <Plus size={24} color={theme.colors.card} />
          </TouchableOpacity>
        )}

        {/* Add Diet Plan Modal */}
        <Modal
          visible={showAddPlan}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddPlan(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Diet Plan</Text>
              <TouchableOpacity onPress={() => setShowAddPlan(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.inputLabel}>Meal Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., High Protein Breakfast"
                value={newPlan.meal_name}
                onChangeText={(text) => setNewPlan({ ...newPlan, meal_name: text })}
              />

              <Text style={styles.inputLabel}>Meal Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor:
                        newPlan.meal_type === type
                          ? theme.colors.primary
                          : theme.colors.border,
                      backgroundColor:
                        newPlan.meal_type === type
                          ? theme.colors.primary + '20'
                          : theme.colors.background,
                      alignItems: 'center',
                    }}
                    onPress={() =>
                      setNewPlan({ ...newPlan, meal_type: type as any })
                    }
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color:
                          newPlan.meal_type === type
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                        textTransform: 'capitalize',
                      }}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Day of Week (Optional)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <TouchableOpacity
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor:
                      newPlan.day_of_week === ''
                        ? theme.colors.primary
                        : theme.colors.border,
                    backgroundColor:
                      newPlan.day_of_week === ''
                        ? theme.colors.primary + '20'
                        : theme.colors.background,
                  }}
                  onPress={() => setNewPlan({ ...newPlan, day_of_week: '' })}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color:
                        newPlan.day_of_week === ''
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                    }}
                  >
                    Any Day
                  </Text>
                </TouchableOpacity>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor:
                        newPlan.day_of_week === index.toString()
                          ? theme.colors.primary
                          : theme.colors.border,
                      backgroundColor:
                        newPlan.day_of_week === index.toString()
                          ? theme.colors.primary + '20'
                          : theme.colors.background,
                    }}
                    onPress={() =>
                      setNewPlan({ ...newPlan, day_of_week: index.toString() })
                    }
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color:
                          newPlan.day_of_week === index.toString()
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                      }}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Calories</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={newPlan.calories}
                    onChangeText={(text) => setNewPlan({ ...newPlan, calories: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={newPlan.protein}
                    onChangeText={(text) => setNewPlan({ ...newPlan, protein: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Carbs (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={newPlan.carbs}
                    onChangeText={(text) => setNewPlan({ ...newPlan, carbs: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fat (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={newPlan.fat}
                    onChangeText={(text) => setNewPlan({ ...newPlan, fat: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Meal description..."
                value={newPlan.description}
                onChangeText={(text) => setNewPlan({ ...newPlan, description: text })}
                multiline
              />

              <Text style={styles.inputLabel}>Instructions (one per line)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Step 1...\nStep 2..."
                value={newPlan.instructions}
                onChangeText={(text) => setNewPlan({ ...newPlan, instructions: text })}
                multiline
              />

              <Button
                title="Add Diet Plan"
                onPress={addDietPlan}
                style={{ marginTop: 8, marginBottom: 40 }}
              />
            </ScrollView>
          </View>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}

