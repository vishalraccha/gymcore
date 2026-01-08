import { useEffect, useState, useRef } from 'react';
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
import AnimatedSplashScreen from '@/components/Splashscreen';
import { NotificationProvider } from '@/contexts/NotificationContext';

enableScreens(true);

// ⭐ Prevent default Expo splash from auto-hiding
SplashScreen.preventAutoHideAsync();

const TNC_ACCEPTED_KEY = '@gymcore_tnc_accepted';
const APP_LAUNCHED_KEY = '@gymcore_app_launched';

function AppContent() {
  const [showSplash, setShowSplash] = useState(false);
  const [showTNC, setShowTNC] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);
  const { user, profile, isLoading } = useAuth();
  const appState = useRef(AppState.currentState);
  const hasShownSplashThisSession = useRef(false);

  // ✅ Check if app should show splash (only on cold start)
  useEffect(() => {
    const checkAppLaunchStatus = async () => {
      try {
        const tncAccepted = await AsyncStorage.getItem(TNC_ACCEPTED_KEY);
        const appLaunched = await AsyncStorage.getItem(APP_LAUNCHED_KEY);
        
        console.log('🚀 App Launch Check:', {
          tncAccepted: !!tncAccepted,
          appLaunched: !!appLaunched,
          hasShownSplash: hasShownSplashThisSession.current,
        });

        // Show T&C if not accepted
        if (!tncAccepted) {
          setShowTNC(true);
          setIsCheckingStorage(false);
          return;
        }

        // Show splash only if:
        // 1. App was NOT already launched this session
        // 2. Haven't shown splash yet this session
        if (!appLaunched && !hasShownSplashThisSession.current) {
          console.log('✅ Showing splash - Cold start detected');
          setShowSplash(true);
          hasShownSplashThisSession.current = true;
          // Mark as launched for this session
          await AsyncStorage.setItem(APP_LAUNCHED_KEY, 'true');
        } else {
          console.log('⏩ Skipping splash - App already active or warm start');
        }
        
        setIsCheckingStorage(false);
      } catch (error) {
        console.error('❌ Error checking storage:', error);
        setIsCheckingStorage(false);
      }
    };

    checkAppLaunchStatus();
  }, []);

  // ✅ Clear launch flag when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('📱 App State:', appState.current, '→', nextAppState);

      // App going to background - clear the launch flag
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        console.log('🔄 App going to background - clearing launch flag');
        try {
          await AsyncStorage.removeItem(APP_LAUNCHED_KEY);
          hasShownSplashThisSession.current = false;
        } catch (error) {
          console.error('Error clearing launch flag:', error);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleSplashFinish = async () => {
    console.log('✅ Splash finished');
    setShowSplash(false);
    // Hide default Expo splash
    await SplashScreen.hideAsync();
  };

  // Show loading while checking storage
  if (isCheckingStorage) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Don't show any loading indicator - default splash is showing */}
      </View>
    );
  }

  // Show custom splash screen
  if (showSplash) {
    return (
      <AnimatedSplashScreen
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
            // Hide default splash after T&C
            await SplashScreen.hideAsync();
          } catch (error) {
            console.error('Error saving TNC status:', error);
            setShowTNC(false);
            await SplashScreen.hideAsync();
          }
        }}
      />
    );
  }

  // Show loading while auth is loading
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
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
    // Don't auto-hide splash - let AppContent control it
    if (fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <SubscriptionProvider>
            <AppDataProvider>
              <AppContent />
            </AppDataProvider>
          </SubscriptionProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}