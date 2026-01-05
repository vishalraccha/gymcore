import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Lock } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import MemberSubscriptionModal from '../MemberSubscriptionModal';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature?: string;
  fallback?: React.ReactNode;
}

export default function SubscriptionGuard({
  children,
  feature,
  fallback,
}: SubscriptionGuardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { canAccessFeature, loading, subscriptionInfo } = useSubscription();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Admin and gym owners have full access
  if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Checking subscription...
        </Text>
      </View>
    );
  }

  // Check if user can access this feature
  const hasAccess = feature ? canAccessFeature(feature) : true;

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Lock size={40} color={theme.colors.primary} />
            </View>

            <Text style={[styles.title, { color: theme.colors.text }]}>
              Premium Feature
            </Text>

            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              This feature requires an active subscription. Subscribe to unlock all
              premium features and enhance your fitness journey.
            </Text>

            {subscriptionInfo && !subscriptionInfo.is_active && (
              <View style={[styles.warningBox, { backgroundColor: theme.colors.warning + '20' }]}>
                <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                  Your subscription expired on{' '}
                  {new Date(subscriptionInfo.end_date).toLocaleDateString()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setShowSubscriptionModal(true)}
              style={[styles.subscribeButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={[styles.subscribeButtonText, { color: theme.colors.card }]}>
                View Plans
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={[styles.backButtonText, { color: theme.colors.textSecondary }]}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Member Subscription Modal */}
        <MemberSubscriptionModal
          visible={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={() => {
            setShowSubscriptionModal(false);
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  card: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  warningBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  warningText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  subscribeButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 15,
  },
});