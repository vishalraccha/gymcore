// /app/(app)/_layout.tsx
import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout() {
  const { session, isLoading, profile } = useAuth();
  const segments = useSegments();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only run auth check once when loading completes
    if (isLoading) return;
    
    // If already redirected, don't redirect again
    if (hasRedirected.current) return;

    const inAdmin = segments[1] === 'admin';
    const inTabs = segments[1] === '(tabs)';

    console.log('📍 Current segments:', segments);
    console.log('🔐 Session:', !!session);
    console.log('👤 Profile:', profile);

    // No session - redirect to login
    if (!session) {
      console.log('➡️ Redirecting to login (no session)');
      hasRedirected.current = true;
      router.replace('/(auth)/login');
      return;
    }

    // Has session but no profile yet - wait
    if (!profile) {
      console.log('⏳ Waiting for profile to load...');
      return;
    }

    // Has session and profile - check role routing (only once)
    const isAdmin = profile.role === 'admin' || profile.role === 'gym_owner';

    if (isAdmin && !inAdmin) {
      console.log('➡️ Redirecting admin to /admin');
      hasRedirected.current = true;
      router.replace('/(app)/admin');
    } else if (!isAdmin && !inTabs) {
      console.log('➡️ Redirecting member to /(tabs)');
      hasRedirected.current = true;
      router.replace('/(app)/(tabs)');
    } else {
      // User is in correct section, mark as redirected
      hasRedirected.current = true;
    }
  }, [session, profile, isLoading]); // Removed segments from dependencies

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}