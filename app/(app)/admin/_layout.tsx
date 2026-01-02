// /app/(app)/admin/_layout.tsx
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Tabs, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings, Users, BarChart2, FileText, Home, UserCheck,Dumbbell } from "lucide-react-native";


export default function AdminTabsLayout() {
  const { user, profile, gym, refreshProfile, refreshGym, isLoading } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const redirected = useRef(false);
  const hasRefreshed = useRef(false);
  const previousUserId = useRef<string | null>(null);

  


  useEffect(() => {
    const shouldRefresh = 
      user?.id && 
      profile?.role === 'gym_owner' && 
      user.id !== previousUserId.current;


      if (isLoading || redirected.current) return;

    if (!profile || !["admin", "gym_owner"].includes(profile.role || "")) {
      redirected.current = true;
      router.replace("/(app)/(tabs)"); // send non-admin back to app tabs
    }


    if (shouldRefresh && !hasRefreshed.current) {
      console.log('🔄 Admin layout detected new user - refreshing data');
      
      const doRefresh = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB
        await refreshProfile();
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshGym();
        hasRefreshed.current = true;
      };

      doRefresh();
      previousUserId.current = user.id;
    }
    }, [user?.id, profile?.role, profile?.gym_id, refreshProfile, refreshGym, isLoading]);

  // Reset flag when user changes
  useEffect(() => {
    if (user?.id !== previousUserId.current) {
      hasRefreshed.current = false;
    }
  }, [user?.id]);


  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile || !["admin", "gym_owner"].includes(profile.role || "")) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarStyle: { 
          backgroundColor: theme.colors.card, 
          borderTopWidth: 1, 
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          height: (insets.bottom > 0 ? insets.bottom : 0) + 57,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ size, color }) => <Home size={size} color={color} /> }}
      />
     
      <Tabs.Screen
        name="members"
        options={{ title: "Members", tabBarIcon: ({ size, color }) => <Users size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: "Workouts", tabBarIcon: ({ size, color }) => <Dumbbell 
        size={24} 
        color={color}
      /> }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{ title: "Plans", tabBarIcon: ({ size, color }) => <FileText size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ title: "Analytics", tabBarIcon: ({ size, color }) => <BarChart2 size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="personal-training"
        options={{ title: "Personal Training", tabBarIcon: ({ size, color }) => <UserCheck size={size} color={color} /> }}
      />
       <Tabs.Screen
        name="gym-profile"
        options={{ title: "Gym", tabBarIcon: ({ size, color }) => <Settings size={size} color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
