// app/(auth)/_layout.tsx
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { session, profile, isLoading } = useAuth();

  useEffect(() => {
    // If already logged in, redirect to app
    if (!isLoading && session && profile) {
      const isAdmin = profile.role === 'admin' || profile.role === 'gym_owner';
      
      if (isAdmin) {
        router.replace('/(app)/admin');
      } else {
        router.replace('/(app)/(tabs)');
      }
    }
  }, [session, profile, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}