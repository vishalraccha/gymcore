import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';

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
  const { profile } = useAuth();
  const { canAccessFeature, loading, subscriptionInfo } = useSubscription();

  // Admin and trainers have full access
  if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-gray-600 mt-4">Checking subscription...</Text>
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
      <View className="flex-1 justify-center items-center bg-gray-50 p-6">
        <View className="bg-white rounded-3xl p-8 items-center shadow-lg max-w-md">
          <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="lock-closed" size={40} color="#3b82f6" />
          </View>

          <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
            Premium Feature
          </Text>

          <Text className="text-gray-600 text-center mb-6">
            This feature requires an active subscription. Subscribe to unlock all
            premium features and enhance your fitness journey.
          </Text>

          {subscriptionInfo && !subscriptionInfo.is_active && (
            <View className="bg-orange-50 rounded-xl p-4 mb-6 w-full">
              <Text className="text-orange-800 text-center font-medium">
                Your subscription expired on{' '}
                {new Date(subscriptionInfo.end_date).toLocaleDateString()}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.push('/plans')}
            className="bg-blue-600 rounded-xl py-4 px-8 mb-3"
          >
            <Text className="text-white font-semibold text-base">
              View Plans
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="py-2"
          >
            <Text className="text-gray-500">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}