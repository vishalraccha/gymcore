import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { X, Crown, Check, Sparkles, CreditCard, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { createRazorpayOrder, verifyAndActivateSubscription } from '@/lib/razorpay';
import { formatRupees } from '@/lib/currency';
import { useSubscription } from '@/contexts/SubscriptionContext';

// Import Razorpay SDK for React Native
let RazorpayCheckout: any = null;
if (Platform.OS !== 'web') {
  try {
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch (e) {
    console.warn('react-native-razorpay not available:', e);
  }
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  duration_days: number;
  features: string[] | null;
  is_active: boolean;
}

interface MemberSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function MemberSubscriptionModal({
  visible,
  onClose,
  onSuccess,
}: MemberSubscriptionModalProps) {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlans();
    }
  }, [visible]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      // Fetch plans from 'plans' table where is_global is true OR gym_id is NULL (CREATOR's plans)
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .or('is_global.eq.true,gym_id.is.null')
        .order('price', { ascending: true });

      if (error) {
        console.error('Error loading plans:', error);
        throw error;
      }
      
      console.log('Loaded plans:', data);
      setPlans(data || []);
      
      if (!data || data.length === 0) {
        console.warn('No plans found. Make sure plans exist with is_global=true or gym_id IS NULL');
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !user || !profile) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    try {
      setProcessing(true);

      // Create Razorpay order
      const amount = Math.round(selectedPlan.price * 100); // Convert to paise
      const order = await createRazorpayOrder({
        amount,
        currency: 'INR',
        planId: selectedPlan.id,
        userId: user.id,
      });

      // Get Razorpay key from edge function
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-razorpay-key');
      
      if (keyError) {
        throw new Error('Failed to get Razorpay key');
      }

      const razorpayKey = (keyData as any)?.key_id || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
      
      if (!razorpayKey) {
        throw new Error('Razorpay key not configured');
      }

      // Load Razorpay script (web only)
      if (typeof window !== 'undefined' && Platform.OS === 'web') {
        if (!(window as any).Razorpay) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          document.body.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          });
        }

        // Initialize Razorpay payment (web)
        const Razorpay = (window as any).Razorpay;
        const options = {
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency,
          name: 'FitPro Platform',
          description: `Subscription: ${selectedPlan.name}`,
          order_id: order.id,
          prefill: {
            email: profile.email || user.email || '',
            contact: profile.phone || '',
          },
          theme: {
            color: theme.colors.primary,
          },
          handler: async (response: any) => {
            try {
              // Verify payment and activate subscription
              await verifyAndActivateSubscription({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: selectedPlan.id,
                user_id: user.id,
              });

              // Refresh subscription status
              await refreshSubscription();

              Alert.alert('Success', 'Subscription activated successfully!', [
                {
                  text: 'OK',
                  onPress: () => {
                    onSuccess?.();
                    onClose();
                  },
                },
              ]);
            } catch (error) {
              console.error('Payment verification error:', error);
              Alert.alert('Error', 'Failed to verify payment. Please contact support.');
            } finally {
              setProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessing(false);
            },
          },
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

        razorpay.on('payment.failed', (response: any) => {
          setProcessing(false);
          Alert.alert('Payment Failed', response.error?.description || 'Payment could not be processed');
        });
      } else {
        // React Native - Use Razorpay SDK
        if (RazorpayCheckout) {
          try {
            const options: any = {
              description: `Subscription: ${selectedPlan.name}`,
              image: undefined,
              currency: 'INR',
              key: razorpayKey,
              amount: order.amount,
              name: 'FitPro Platform',
              order_id: order.id,
              prefill: {
                email: profile.email || user.email || '',
                contact: profile.phone || '',
                name: profile.full_name || '',
              },
              theme: { color: theme.colors.primary },
            };

            RazorpayCheckout.open(options)
              .then(async (data: any) => {
                try {
                  // Verify payment and activate subscription
                  await verifyAndActivateSubscription({
                    razorpay_order_id: data.razorpay_order_id,
                    razorpay_payment_id: data.razorpay_payment_id,
                    razorpay_signature: data.razorpay_signature,
                    plan_id: selectedPlan.id,
                    user_id: user.id,
                  });

                  // Refresh subscription status
                  await refreshSubscription();

                  Alert.alert('Success', 'Subscription activated successfully!', [
                    {
                      text: 'OK',
                      onPress: () => {
                        onSuccess?.();
                        onClose();
                      },
                    },
                  ]);
                } catch (error) {
                  console.error('Payment verification error:', error);
                  Alert.alert(
                    'Error',
                    'Payment was successful but subscription activation failed. Please contact support with payment ID: ' +
                      data.razorpay_payment_id
                  );
                } finally {
                  setProcessing(false);
                }
              })
              .catch((error: any) => {
                setProcessing(false);
                if (error?.error?.code === 'BAD_REQUEST_ERROR') {
                  Alert.alert('Payment Failed', error.error.description || 'Payment could not be processed');
                } else if (error?.error?.code === 'NETWORK_ERROR') {
                  Alert.alert('Network Error', 'Please check your internet connection and try again');
                } else if (error?.code !== 'PAYMENT_CANCELLED') {
                  Alert.alert('Payment Failed', error?.error?.description || 'Payment could not be processed');
                }
              });
          } catch (error) {
            console.error('Razorpay SDK error:', error);
            setProcessing(false);
            Alert.alert('Error', 'Failed to initialize payment. Please try again.');
          }
        } else {
          // Fallback: Open Razorpay checkout in browser
          const razorpayUrl = `https://checkout.razorpay.com/v1/checkout.js?order_id=${order.id}`;
          Alert.alert(
            'Payment',
            'Please complete payment in your browser',
            [
              {
                text: 'Cancel',
                onPress: () => setProcessing(false),
                style: 'cancel',
              },
              {
                text: 'Open Browser',
                onPress: async () => {
                  try {
                    const url = `https://razorpay.com/payment-button/pl_${order.id}/pay/?medium=button`;
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert('Error', 'Unable to open payment page');
                      setProcessing(false);
                    }
                  } catch (error) {
                    console.error('Error opening browser:', error);
                    Alert.alert('Error', 'Failed to open payment page');
                    setProcessing(false);
                  }
                },
              },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      setProcessing(false);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to process payment. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific error cases
        if (error.message.includes('authentication') || error.message.includes('session')) {
          errorMessage = 'Your session has expired. Please login again and try.';
        } else if (error.message.includes('plan')) {
          errorMessage = 'Selected plan is not available. Please select another plan.';
        } else if (error.message.includes('amount')) {
          errorMessage = 'Payment amount is invalid. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Payment Error', errorMessage);
    }
  };

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: 24,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 24,
      lineHeight: 24,
    },
    plansList: {
      gap: 16,
    },
    planCard: {
      borderWidth: 2,
      borderRadius: 16,
      padding: 20,
      backgroundColor: theme.colors.background,
    },
    planCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '10',
    },
    planCardUnselected: {
      borderColor: theme.colors.border,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    planNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    planPrice: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    planDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    planDuration: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      fontWeight: '600',
    },
    featuresList: {
      gap: 10,
      marginBottom: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    featureText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
    },
    purchaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    purchaseButtonDisabled: {
      opacity: 0.5,
    },
    purchaseButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.card,
    },
    loadingContainer: {
      padding: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    emptyState: {
      padding: 48,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Upgrade to Pro</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading plans...</Text>
              </View>
            ) : plans.length === 0 ? (
              <View style={styles.emptyState}>
                <AlertCircle size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No plans available at the moment</Text>
              </View>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Choose a plan to unlock all premium features including workouts, diet plans, and progress tracking.
                </Text>

                <View style={styles.plansList}>
                  {plans.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    const features = Array.isArray(plan.features) ? plan.features : [];

                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[
                          styles.planCard,
                          isSelected ? styles.planCardSelected : styles.planCardUnselected,
                        ]}
                        onPress={() => handleSelectPlan(plan)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.planHeader}>
                          <View style={styles.planNameRow}>
                            {isSelected && <Crown size={20} color={theme.colors.primary} />}
                            <Text style={styles.planName}>{plan.name}</Text>
                          </View>
                          <Text style={styles.planPrice}>{formatRupees(plan.price)}</Text>
                        </View>

                        {plan.description && (
                          <Text style={styles.planDescription}>{plan.description}</Text>
                        )}

                        <Text style={styles.planDuration}>
                          Valid for {plan.duration_days} days
                        </Text>

                        {features.length > 0 && (
                          <View style={styles.featuresList}>
                            {features.map((feature, index) => (
                              <View key={index} style={styles.featureItem}>
                                <Check size={16} color={theme.colors.success} />
                                <Text style={styles.featureText}>{feature}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.purchaseButton, (!selectedPlan || processing) && styles.purchaseButtonDisabled]}
                  onPress={handlePurchase}
                  disabled={!selectedPlan || processing}
                  activeOpacity={0.8}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color={theme.colors.card} />
                  ) : (
                    <>
                      <CreditCard size={20} color={theme.colors.card} />
                      <Text style={styles.purchaseButtonText}>
                        {selectedPlan ? `Pay ${formatRupees(selectedPlan.price)}` : 'Select a Plan'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

