import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Modal, Alert, RefreshControl, ActivityIndicator, Platform
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { 
  Plus, Edit, Trash2, X, CreditCard, Calendar, Users 
} from 'lucide-react-native';
import { formatRupees } from '@/lib/currency';

interface Subscription {
  id: string;
  gym_id?: string;
  name: string;
  description?: string;
  duration_months: number;
  duration_days: number;
  price: number;
  currency: string;
  features?: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  subscriber_count?: number;
}

export default function SubscriptionsScreen() {
  const { theme } = useTheme();
  const { profile, gym } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showAddSubscription, setShowAddSubscription] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    description: '',
    duration_months: '',
    price: '',
    features: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
      fetchSubscriptions();
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSubscriptions();
    setRefreshing(false);
  };

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('subscriptions')
        .select('*')
        .eq('is_active', true)
        .order('duration_months', { ascending: true });

      // Gym owners only see their gym's subscriptions
      if (profile?.role === 'gym_owner' && profile.gym_id) {
        query = query.eq('gym_id', profile.gym_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch subscriber counts for each subscription
      const subscriptionsWithCounts = await Promise.all(
        (data || []).map(async (sub) => {
          const { count } = await supabase
            .from('user_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_id', sub.id)
            .eq('is_active', true);

          return {
            ...sub,
            subscriber_count: count || 0,
          };
        })
      );

      setSubscriptions(subscriptionsWithCounts);
    } catch (error: Error | unknown) {
      console.error('Error fetching subscriptions:', error);
      Alert.alert('Error', 'Failed to fetch subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    if (!newSubscription.name.trim()) {
      Alert.alert('Error', 'Plan name is required');
      return false;
    }
    if (!newSubscription.duration_months || parseInt(newSubscription.duration_months) < 1) {
      Alert.alert('Error', 'Duration must be at least 1 month');
      return false;
    }
    if (!newSubscription.price || parseFloat(newSubscription.price) < 0) {
      Alert.alert('Error', 'Price must be a valid positive number');
      return false;
    }
    return true;
  };

  const addOrUpdateSubscription = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      const durationMonths = parseInt(newSubscription.duration_months);
      const durationDays = durationMonths * 30; // Approximate days

      const subscriptionData = {
        name: newSubscription.name.trim(),
        description: newSubscription.description.trim() || null,
        duration_months: durationMonths,
        duration_days: durationDays,
        price: parseFloat(newSubscription.price),
        currency: 'INR',
        features: newSubscription.features 
          ? newSubscription.features.split('\n').filter(f => f.trim()).map(f => f.trim())
          : [],
        gym_id: profile?.gym_id || null,
        created_by: profile?.id,
        updated_at: new Date().toISOString(),
      };

      if (editingSubscription) {
        // Update existing subscription
        const { data, error } = await supabase
          .from('subscriptions')
          .update(subscriptionData)
          .eq('id', editingSubscription.id)
          .select()
          .single();

        if (error) throw error;

        console.log('Subscription updated:', data);
        Alert.alert('Success', 'Subscription plan updated successfully! ✅');
      } else {
        // Create new subscription
        const { data, error } = await supabase
          .from('subscriptions')
          .insert([subscriptionData])
          .select()
          .single();

        if (error) throw error;

        console.log('Subscription created:', data);
        Alert.alert('Success', 'Subscription plan created successfully! 🎉');
      }

      resetForm();
      await fetchSubscriptions();
    } catch (error: Error | unknown) {
      console.error('Error saving subscription:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save subscription plan');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSubscription = async (subscription: Subscription) => {
    if (subscription.subscriber_count && subscription.subscriber_count > 0) {
      Alert.alert(
        'Cannot Delete',
        `This plan has ${subscription.subscriber_count} active subscriber${subscription.subscriber_count > 1 ? 's' : ''}. Please reassign or cancel their subscriptions first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Subscription Plan',
      `Are you sure you want to delete "${subscription.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('subscriptions')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', subscription.id);

              if (error) throw error;

              await fetchSubscriptions();
              Alert.alert('Success', 'Subscription plan deleted successfully');
            } catch (error: Error | unknown) {
              console.error('Error deleting subscription:', error);
              Alert.alert('Error', 'Failed to delete subscription plan');
            }
          },
        },
      ]
    );
  };

  const editSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setNewSubscription({
      name: subscription.name,
      description: subscription.description || '',
      duration_months: subscription.duration_months.toString(),
      price: subscription.price.toString(),
      features: subscription.features?.join('\n') || '',
    });
    setShowAddSubscription(true);
  };

  const resetForm = () => {
    setEditingSubscription(null);
    setNewSubscription({
      name: '',
      description: '',
      duration_months: '',
      price: '',
      features: '',
    });
    setShowAddSubscription(false);
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
    subscriptionCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    subscriptionInfo: {
      flex: 1,
    },
    subscriptionName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    subscriptionPrice: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.success,
    },
    subscriptionDuration: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    metaText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    subscriptionActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.border + '40',
    },
    noSubscriptionsCard: {
      marginHorizontal: 24,
      alignItems: 'center',
      paddingVertical: 48,
    },
    noSubscriptionsText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    noSubscriptionsSubtext: {
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
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
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
    textAreaLarge: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputHalf: {
      flex: 1,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 20,
      lineHeight: 18,
    },
    addButton: {
      marginTop: 8,
      marginBottom: 40,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    features: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    featuresTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    featureItem: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 6,
      lineHeight: 20,
    },
    createFirstButton: {
      minWidth: 200,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading subscription plans...</Text>
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
          <Text style={styles.title}>Subscription Plans</Text>
          <Text style={styles.subtitle}>
            {gym?.name ? `Plans for ${gym.name}` : 'Manage membership plans and pricing'}
          </Text>
        </View>

        {/* Subscriptions List */}
        {subscriptions.map((subscription) => (
          <Card key={subscription.id} style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionName}>{subscription.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.subscriptionPrice}>
                    {formatRupees(subscription.price)}
                  </Text>
                  <Text style={styles.subscriptionDuration}>
                    /{subscription.duration_months === 1 ? 'month' : `${subscription.duration_months} months`}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Calendar size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {subscription.duration_days} days ({subscription.duration_months} month{subscription.duration_months > 1 ? 's' : ''})
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Users size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {subscription.subscriber_count || 0} active subscriber{subscription.subscriber_count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.subscriptionActions}>
                <TouchableOpacity
                  onPress={() => editSubscription(subscription)}
                  style={styles.actionButton}
                >
                  <Edit size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteSubscription(subscription)}
                  style={styles.actionButton}
                >
                  <Trash2 size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>

            {subscription.description && (
              <Text style={styles.description}>{subscription.description}</Text>
            )}

            {subscription.features && subscription.features.length > 0 && (
              <View style={styles.features}>
                <Text style={styles.featuresTitle}>Features:</Text>
                {subscription.features.map((feature, index) => (
                  <Text key={index} style={styles.featureItem}>
                    ✓ {feature}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        ))}

        {subscriptions.length === 0 && (
          <Card style={styles.noSubscriptionsCard}>
            <CreditCard size={64} color={theme.colors.textSecondary} />
            <Text style={styles.noSubscriptionsText}>No subscription plans yet</Text>
            <Text style={styles.noSubscriptionsSubtext}>
              Create your first plan to start managing memberships
            </Text>
            <Button
              title="Create First Plan"
              onPress={() => setShowAddSubscription(true)}
              style={styles.createFirstButton}
            />
          </Card>
        )}
      </ScrollView>

      {/* Add Subscription FAB */}
      {subscriptions.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddSubscription(true)}
        >
          <Plus size={24} color={theme.colors.card} />
        </TouchableOpacity>
      )}

      {/* Add/Edit Subscription Modal */}
      <Modal
        visible={showAddSubscription}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetForm}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingSubscription ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
            </Text>
            <TouchableOpacity onPress={resetForm}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Plan Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Monthly Premium, Annual Basic"
              placeholderTextColor={theme.colors.textSecondary}
              value={newSubscription.name}
              onChangeText={(text) => setNewSubscription({ ...newSubscription, name: text })}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of this plan..."
              placeholderTextColor={theme.colors.textSecondary}
              value={newSubscription.description}
              onChangeText={(text) => setNewSubscription({ ...newSubscription, description: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Duration (months) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 1, 3, 12"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newSubscription.duration_months}
                  onChangeText={(text) => setNewSubscription({ ...newSubscription, duration_months: text })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Price (₹) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 49.99"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newSubscription.price}
                  onChangeText={(text) => setNewSubscription({ ...newSubscription, price: text })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Features (one per line)</Text>
            <TextInput
              style={[styles.input, styles.textAreaLarge]}
              placeholder={'Access to all equipment\nPersonal trainer sessions\nNutrition guidance\nLocker access\nGroup classes'}
              placeholderTextColor={theme.colors.textSecondary}
              value={newSubscription.features}
              onChangeText={(text) => setNewSubscription({ ...newSubscription, features: text })}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.helperText}>
              Features will be displayed as bullet points on the plan card
            </Text>

            <Button
              title={editingSubscription ? 'Update Plan' : 'Create Plan'}
              onPress={addOrUpdateSubscription}
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