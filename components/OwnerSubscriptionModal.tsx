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
import { X, Crown, Check, Sparkles, CreditCard, AlertCircle, Building2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { createOwnerRazorpayOrder } from '@/lib/razorpayOwner';
import { createOwnerSubscription, updateOwnerPayment } from '@/lib/ownerSubscriptions';
import { formatRupees } from '@/lib/currency';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { OwnerSubscriptionPlan } from '@/lib/ownerSubscriptions';

// Import Razorpay SDK for React Native
let RazorpayCheckout: any = null;
if (Platform.OS !== 'web') {
  try {
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch (e) {
    console.warn('react-native-razorpay not available:', e);
  }
}

interface OwnerSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OwnerSubscriptionModal({
  visible,
  onClose,
  onSuccess,
}: OwnerSubscriptionModalProps) {
  const { theme } = useTheme();
  const { user, profile, gym } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState<OwnerSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<OwnerSubscriptionPlan | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlans();
    }
  }, [visible]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { getOwnerSubscriptionPlans } = await import('@/lib/ownerSubscriptions');
      const { data, error } = await getOwnerSubscriptionPlans();

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading owner plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: OwnerSubscriptionPlan) => {
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !user || !profile || !gym) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      setProcessing(true);

      // Create owner subscription record
      const { data: subscription, error: subError } = await createOwnerSubscription({
        ownerId: user.id,
        gymId: gym.id,
        planId: selectedPlan.id,
      });

      if (subError || !subscription) {
        throw new Error(subError?.message || 'Failed to create subscription');
      }

      // Create Razorpay order
      const { data: orderData, error: orderError } = await createOwnerRazorpayOrder(
        subscription.id,
        selectedPlan.id
      );

      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Failed to create payment order');
      }

      // Get Razorpay key
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
          amount: orderData.amount,
          currency: 'INR',
          name: 'FitPro Platform',
          description: `Gym Owner Subscription: ${selectedPlan.name}`,
          order_id: orderData.order_id,
          prefill: {
            email: profile.email || user.email || '',
            contact: profile.phone || '',
          },
          theme: {
            color: theme.colors.primary,
          },
          handler: async (response: any) => {
            try {
              // Update subscription with payment details
              const { error: updateError } = await updateOwnerPayment(subscription.id, {
                subscriptionId: subscription.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentStatus: 'success',
              });

              if (updateError) throw updateError;

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
              description: `Gym Owner Subscription: ${selectedPlan.name}`,
              image: undefined,
              currency: 'INR',
              key: razorpayKey,
              amount: orderData.amount,
              name: 'FitPro Platform',
              order_id: orderData.order_id,
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
                  // Update subscription with payment details
                  const { error: updateError } = await updateOwnerPayment(subscription.id, {
                    subscriptionId: subscription.id,
                    razorpayOrderId: data.razorpay_order_id,
                    razorpayPaymentId: data.razorpay_payment_id,
                    razorpaySignature: data.razorpay_signature,
                    paymentStatus: 'success',
                  });

                  if (updateError) throw updateError;

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
                    const url = `https://razorpay.com/payment-button/pl_${orderData.order_id}/pay/?medium=button`;
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
        } else if (error.message.includes('plan') || error.message.includes('subscription')) {
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
    planDetails: {
      marginBottom: 16,
    },
    planDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    planDetailText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
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
      marginBottom:30,
      margin:5
    },
    purchaseButtonDisabled: {
      opacity: 0.5,
      marginBottom:30,
      margin:5
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
                  Unlock all features including member management, analytics, and more.
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
                            <Building2 size={20} color={theme.colors.primary} />
                            <Text style={styles.planName}>{plan.name}</Text>
                          </View>
                          <Text style={styles.planPrice}>{formatRupees(plan.price)}</Text>
                        </View>

                        {plan.description && (
                          <Text style={styles.planDescription}>{plan.description}</Text>
                        )}

                        <View style={styles.planDetails}>
                          <View style={styles.planDetailRow}>
                            <Text style={styles.planDetailText}>
                              Billing: {plan.billing_cycle}
                            </Text>
                          </View>
                          <View style={styles.planDetailRow}>
                            <Text style={styles.planDetailText}>
                              Duration: {plan.duration_days} days
                            </Text>
                          </View>
                          {plan.member_limit && (
                            <View style={styles.planDetailRow}>
                              <Text style={styles.planDetailText}>
                                Member Limit: {plan.member_limit}
                              </Text>
                            </View>
                          )}
                        </View>

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

