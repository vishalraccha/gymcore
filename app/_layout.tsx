import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import '../global.css';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { enableScreens } from 'react-native-screens';
import AsyncStorage from '@react-native-async-storage/async-storage';

let AnimatedSplashScreen: any = null;
const loadSplashScreen = () => {
  if (!AnimatedSplashScreen) {
    AnimatedSplashScreen = require('@/components/Splashscreen').default;
  }
  return AnimatedSplashScreen;
};

enableScreens(true);
SplashScreen.preventAutoHideAsync();

const SPLASH_SHOWN_KEY = '@gymcore_splash_shown';
const TNC_ACCEPTED_KEY = '@gymcore_tnc_accepted';

// Wrapper component that has access to AuthContext
function AppContent() {
  const [showSplash, setShowSplash] = useState(false);
  const [showTNC, setShowTNC] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);
  const [SplashComponent, setSplashComponent] = useState<any>(null);
  const { user, profile, isLoading } = useAuth();

  // Check if splash should be shown (only once)
  useEffect(() => {
    const checkSplashStatus = async () => {
      try {
        const splashShown = await AsyncStorage.getItem(SPLASH_SHOWN_KEY);
        const tncAccepted = await AsyncStorage.getItem(TNC_ACCEPTED_KEY);
        
        if (!splashShown) {
          // First time - show splash
          setShowSplash(true);
          const Component = loadSplashScreen();
          setSplashComponent(() => Component);
        }
        
        // Check if T&C needs to be shown
        if (!tncAccepted) {
          setShowTNC(true);
        }
        
        setIsCheckingStorage(false);
      } catch (error) {
        console.error('Error checking storage:', error);
        setIsCheckingStorage(false);
      }
    };

    checkSplashStatus();
  }, []);

  // Handle app state changes - refresh data when coming to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !isLoading && user) {
        // App came to foreground - data will refresh via AppDataContext
        // No need to show splash again
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoading, user]);

  const handleSplashFinish = async () => {
    try {
      await AsyncStorage.setItem(SPLASH_SHOWN_KEY, 'true');
      setShowSplash(false);
    } catch (error) {
      console.error('Error saving splash status:', error);
      setShowSplash(false);
    }
  };

  // Show loading while checking storage or auth
  if (isCheckingStorage || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Show splash screen only on first launch
  if (showSplash && SplashComponent) {
    const Splash = SplashComponent;
    return (
      <Splash
        onFinish={handleSplashFinish}
        userId={user?.id}
        gymId={profile?.gym_id}
      />
    );
  }

  // Show T&C screen if not accepted
  if (showTNC) {
    const TNCComponent = require('@/components/TermsAndConditions').default;
    return (
      <TNCComponent
        onAccept={async () => {
          try {
            await AsyncStorage.setItem(TNC_ACCEPTED_KEY, 'true');
            setShowTNC(false);
          } catch (error) {
            console.error('Error saving TNC status:', error);
            setShowTNC(false);
          }
        }}
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
          <AppDataProvider>
            <AppContent />
          </AppDataProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}