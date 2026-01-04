// /app/(app)/_layout.tsx
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout() {
  const { session, isLoading, profile } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    // Wait for loading to complete
    if (isLoading) {
      console.log('⏳ Auth loading...');
      return;
    }

    const inApp = segments[0] === '(app)';
    const inAdmin = segments[1] === 'admin';
    const inTabs = segments[1] === '(tabs)';

    console.log('📍 Current segments:', segments);
    console.log('🔐 Session:', !!session);
    console.log('👤 Profile role:', profile?.role);

    // No session - redirect to login
    if (!session) {
      console.log('➡️ No session - redirecting to login');
      router.replace('/(auth)/login');
      return;
    }

    // Has session but no profile yet - wait for profile to load
    if (!profile) {
      console.log('⏳ Session found, waiting for profile...');
      return;
    }

    // ✅ User is authenticated and profile loaded
    const isAdmin = profile.role === 'admin' || profile.role === 'gym_owner';
    
    console.log('✅ User authenticated:', {
      role: profile.role,
      isAdmin,
      currentLocation: segments.join('/'),
    });

    // Only redirect if user is in wrong section
    if (isAdmin && !inAdmin && inApp) {
      console.log('➡️ Admin user in wrong section - redirecting to /admin');
      router.replace('/(app)/admin');
    } else if (!isAdmin && !inTabs && inApp) {
      console.log('➡️ Member user in wrong section - redirecting to /(tabs)');
      router.replace('/(app)/(tabs)');
    } else {
      console.log('✅ User in correct section - no redirect needed');
    }
  }, [session, profile, isLoading, segments]);

  // Show loading screen while auth is initializing
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Don't render anything if no session (will redirect)
  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}