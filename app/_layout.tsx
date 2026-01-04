import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import '../global.css';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { enableScreens } from 'react-native-screens';

let AnimatedSplashScreen: any = null;
const loadSplashScreen = () => {
  if (!AnimatedSplashScreen) {
    AnimatedSplashScreen = require('@/components/Splashscreen').default;
  }
  return AnimatedSplashScreen;
};

enableScreens(true);
SplashScreen.preventAutoHideAsync();

// Wrapper component that has access to AuthContext
function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [SplashComponent, setSplashComponent] = useState<any>(null);
  const { user, profile, isLoading } = useAuth(); // ⭐ ADD isLoading

  // Lazy load splash screen - only when needed
  useEffect(() => {
    if (showSplash) {
      const Component = loadSplashScreen();
      setSplashComponent(() => Component);
    }
  }, [showSplash]);

  // ⭐ ADD: Wait for auth to initialize before showing routes
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (showSplash && SplashComponent) {
    const Splash = SplashComponent;
    return (
      <Splash
        onFinish={() => setShowSplash(false)}
        userId={user?.id}
        gymId={profile?.gym_id}
      />
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <AppContent />
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}