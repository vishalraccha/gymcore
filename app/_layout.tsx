import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import '../global.css';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { enableScreens } from 'react-native-screens';
enableScreens(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
    console.log("RootLayout");
    
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  ErrorUtils.setGlobalHandler((error) => {
  console.error("GLOBAL ERROR:", error);
  alert("App crashed: " + error.message);
});

  return (
    <ThemeProvider>
    <AuthProvider>
      <SubscriptionProvider> 
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      </SubscriptionProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
