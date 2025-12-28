import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { formatRupees, formatCurrencyNumber } from '@/lib/currency';
import { 
  getAllPlans, 
  createRazorpayOrder, 
  verifyAndActivateSubscription,
  Plan 
} from '@/lib/razorpay';
import { Card } from '@/components/ui/Card';
import RazorpayCheckout from 'react-native-razorpay';
import { 
  CreditCard, 
  CheckCircle, 
  Shield, 
  Clock, 
  Zap,
  Trophy,
  Star,
} from 'lucide-react-native';
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import { useTheme } from '@/contexts/ThemeContext';


const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_Rp9bIxFjJlsibu';

export default function PlansScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { subscriptionInfo, refreshSubscription, hasActiveSubscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await getAllPlans();
      console.log('📋 Plans loaded:', data.length);
      setPlans(data);
    } catch (error) {
      console.error('❌ Error loading plans:', error);
      Alert.alert('Error', 'Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  

  const handlePurchasePlan = async (plan: Plan) => {
    if (!user || !profile) {
      Alert.alert('Error', 'Please login to purchase a plan');
      return;
    }

    console.log('🛒 Starting purchase for plan:', plan.name);
    console.log('💰 Plan price:', plan.price, plan.currency);

    try {
      setProcessingPlanId(plan.id);

      // Step 1: Create order
      // Amount should be in PAISE (multiply by 100)
      const amountInPaise = Math.round(plan.price * 100);
      
      console.log('🔵 Step 1: Creating order...');
      console.log('💰 Amount calculation:', {
        planPrice: plan.price,
        amountInPaise: amountInPaise,
        displayAmount: `₹${plan.price}`
      });

      const orderData = await createRazorpayOrder({
        amount: amountInPaise,
        currency: plan.currency || 'INR',
        planId: plan.id,
        userId: user.id,
      });

      console.log('✅ Order created:', {
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        displayAmount: `₹${orderData.amount / 100}`
      });

      // Step 2: Prepare Razorpay options
      const options = {
        description: plan.description || `${plan.name} Subscription`,
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency: orderData.currency,
        key: RAZORPAY_KEY,
        amount: orderData.amount.toString(), // Amount in paise
        name: 'GymCore',
        order_id: orderData.id,
        prefill: {
          email: profile.email || '',
          contact: profile.phone || '',
          name: profile.full_name || '',
        },
        theme: { 
          color: theme.colors.primary,
          backdrop_color: '#000000'
        },
      };

      console.log('🔵 Step 2: Opening Razorpay checkout...');
      console.log('Razorpay Config:', {
        key: RAZORPAY_KEY,
        orderId: orderData.id,
        amount: `${orderData.amount} paise (₹${orderData.amount / 100})`
      });

      // Step 3: Open Razorpay checkout
      const data = await RazorpayCheckout.open(options);
      
      console.log('✅ Payment successful:', {
        paymentId: data.razorpay_payment_id,
        orderId: data.razorpay_order_id,
        signature: data.razorpay_signature ? '✓' : '✗'
      });

      // Step 4: Verify and activate subscription
      console.log('🔵 Step 3: Verifying payment and activating subscription...');
      
      await verifyAndActivateSubscription({
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        plan_id: plan.id,
        user_id: user.id,
      });

      console.log('✅ Subscription activated successfully!');

      // Step 5: Refresh subscription context
      console.log('🔵 Step 4: Refreshing subscription...');
      await refreshSubscription();

      console.log('🎉 All done! Premium features unlocked.');

      // Show success message
      Alert.alert(
        '🎉 Success!',
        `Your ${plan.name} has been activated! You now have access to all premium features.`,
        [
          { 
            text: 'Great!', 
            onPress: () => {
              loadPlans();
            }
          }
        ]
      );
      
    } catch (error: unknown) {
      console.error('❌ Payment error:', error);
      
      // Handle different error types
      const err = error as { code?: number; description?: string; message?: string };
      if (err.code === 2) {
        // Payment cancelled by user
        console.log('⚠️ Payment cancelled by user');
        Alert.alert(
          'Payment Cancelled', 
          'You cancelled the payment. You can try again anytime.'
        );
      } else if (error.code === 0) {
        // Payment failed
        console.error('⚠️ Payment failed:', error.description);
        Alert.alert(
          'Payment Failed', 
          error.description || 'Payment failed. Please try again.'
        );
      } else if (error.message) {
        // Other errors
        console.error('⚠️ Error:', error.message);
        Alert.alert(
          'Error', 
          error.message || 'Something went wrong. Please try again.'
        );
      } else {
        // Unknown error
        console.error('⚠️ Unknown error:', error);
        Alert.alert(
          'Error', 
          'Unable to process payment. Please check your internet connection and try again.'
        );
      }
    } finally {
      setProcessingPlanId(null);
    }
  };

  const renderPlanCard = (plan: Plan, index: number) => {
    const isCurrentPlan = subscriptionInfo?.plan_name === plan.name;
    const isProcessing = processingPlanId === plan.id;
    const features = Array.isArray(plan.features) ? plan.features : [];
    
    const planColors = [
      { 
        gradient: [theme.colors.primary, theme.colors.primaryDark], 
        badge: theme.colors.primaryLight + '40',
        badgeText: theme.colors.primaryDark,
        icon: theme.colors.primary
      },
      { 
        gradient: [theme.colors.accent, theme.colors.primaryDark], 
        badge: theme.colors.accent + '40',
        badgeText: theme.colors.primaryDark,
        icon: theme.colors.accent
      },
      { 
        gradient: [theme.colors.warning, theme.colors.primaryDark], 
        badge: theme.colors.warning + '40',
        badgeText: theme.colors.primaryDark,
        icon: theme.colors.warning
      },
    ];
    
    const colors = planColors[index % planColors.length];
    const isPopular = index === 1;

    return (
      <Card 
        key={plan.id}
        style={[
          styles.planCard,
          isCurrentPlan && styles.currentPlanCard
        ]}
      >
        {isPopular && !isCurrentPlan && (
          <View style={styles.popularBadge}>
            <Star size={12} color="#fff" />
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}

        {isCurrentPlan && (
          <View style={[styles.activeBadge, { backgroundColor: theme.colors.success + '20' }]}>
            <CheckCircle size={14} color={theme.colors.success} />
            <Text style={[styles.activeText, { color: theme.colors.success }]}>Active Plan</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <View style={[styles.planIconContainer, { backgroundColor: colors.badge }]}>
            <Trophy size={24} color={colors.icon} />
          </View>
          <View style={styles.planTitleContainer}>
            <Text style={styles.planName}>{plan.name}</Text>
            {plan.description && (
              <Text style={styles.planDescription}>{plan.description}</Text>
            )}
          </View>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRupees(plan.price)}</Text>
          </View>
          <Text style={styles.duration}>for {plan.duration_days} days</Text>
          <Text style={styles.perDay}>
            ~{formatRupees(plan.price / plan.duration_days)}/day
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={[styles.checkIconContainer, { backgroundColor: theme.colors.success + '20' }]}>
                <CheckCircle size={16} color={theme.colors.success} />
              </View>
              <Text style={[styles.featureText, { color: theme.colors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>

        {!isCurrentPlan && (
          <TouchableOpacity
            onPress={() => handlePurchasePlan(plan)}
            disabled={processingPlanId !== null}
            style={[
              styles.selectButton,
              { 
                backgroundColor: processingPlanId !== null ? '#94A3B8' : colors.icon,
                opacity: processingPlanId !== null && !isProcessing ? 0.5 : 1
              }
            ]}
          >
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            ) : (
              <>
                <CreditCard size={18} color="#fff" />
                <Text style={styles.selectButtonText}>
                  {processingPlanId !== null ? 'Please wait...' : 'Choose Plan'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCurrentPlan && subscriptionInfo && (
          <View style={[styles.currentPlanStatus, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}>
            <View style={styles.statusRow}>
              <Clock size={16} color={theme.colors.success} />
              <Text style={[styles.statusText, { color: theme.colors.success }]}>
                {subscriptionInfo.days_remaining} days remaining
              </Text>
            </View>
            <Text style={[styles.expiryText, { color: theme.colors.success }]}>
              Expires on {new Date(subscriptionInfo.end_date).toLocaleDateString()}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: { marginTop: 12, fontSize: 16, color: theme.colors.textSecondary },
    header: { padding: 24, paddingTop: Platform.OS === 'ios' ? 16 : 24 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.colors.text },
    subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
    activeAlert: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.success + '20',
      borderColor: theme.colors.success,
      borderWidth: 1,
    },
    alertIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.success + '30',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.success },
    alertText: { fontSize: 14, color: theme.colors.success, marginTop: 2 },
    plansContainer: { paddingHorizontal: 24 },
    planCard: { marginBottom: 16, padding: 20, position: 'relative' },
    currentPlanCard: { borderColor: theme.colors.success, borderWidth: 2 },
    popularBadge: {
      position: 'absolute',
      top: -10,
      right: 20,
      backgroundColor: theme.colors.warning,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    popularText: { color: theme.colors.card, fontSize: 10, fontWeight: 'bold' },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
      marginBottom: 12,
    },
    activeText: { fontSize: 12, fontWeight: 'bold' },
    planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    planIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    planTitleContainer: { flex: 1 },
    planName: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text },
    planDescription: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
    priceContainer: { marginBottom: 20 },
    priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
    currency: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginRight: 4,
      marginTop: 4,
    },
    price: { fontSize: 48, fontWeight: 'bold', color: theme.colors.text, lineHeight: 48 },
    duration: { fontSize: 16, color: theme.colors.textSecondary, marginTop: 4 },
    perDay: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
    featuresContainer: { marginBottom: 20 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    checkIconContainer: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    featureText: { flex: 1, fontSize: 15 },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    selectButtonText: { color: theme.colors.card, fontSize: 16, fontWeight: 'bold' },
    processingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    processingText: { color: theme.colors.card, fontSize: 16, fontWeight: 'bold' },
    currentPlanStatus: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    statusText: { fontSize: 16, fontWeight: '600' },
    expiryText: { fontSize: 14, marginLeft: 24 },
    emptyCard: { padding: 40, alignItems: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginTop: 16 },
    emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    retryButtonText: { color: theme.colors.card, fontSize: 16, fontWeight: '600' },
    securityCard: {
      marginHorizontal: 24,
      marginTop: 8,
      padding: 16,
      flexDirection: 'row',
      backgroundColor: theme.colors.border + '40',
    },
    securityIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    securityContent: { flex: 1 },
    securityTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 4 },
    securityText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
    footer: { height: 24 },
  });

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Plans</Text>
        <Text style={styles.subtitle}>
          Choose the perfect plan for your fitness journey
        </Text>
      </View>

      {hasActiveSubscription && subscriptionInfo && (
        <Card style={styles.activeAlert}>
          <View style={styles.alertIcon}>
            <CheckCircle size={20} color={theme.colors.success} />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Youre Premium! 🎉</Text>
            <Text style={styles.alertText}>
              You have {subscriptionInfo.days_remaining} days left on your {subscriptionInfo.plan_name}
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.plansContainer}>
        {plans.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Zap size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptyText}>
              Check back later for subscription plans
            </Text>
            <TouchableOpacity
              onPress={loadPlans}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          plans.map((plan, index) => renderPlanCard(plan, index))
        )}
      </View>

      <Card style={styles.securityCard}>
        <View style={styles.securityIcon}>
          <Shield size={24} color={theme.colors.textSecondary} />
        </View>
        <View style={styles.securityContent}>
          <Text style={styles.securityTitle}>Secure Payment</Text>
          <Text style={styles.securityText}>
            All payments are processed securely through Razorpay. 
            Your payment information is encrypted and protected.
          </Text>
        </View>
      </Card>

      <View style={styles.footer} />
    </ScrollView>
    </SafeAreaWrapper>
  );
}