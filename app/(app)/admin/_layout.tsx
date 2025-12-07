// /app/(app)/admin/_layout.tsx
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Users, BarChart2, FileText, Home } from "lucide-react-native";

export default function AdminTabsLayout() {
  const { profile, isLoading } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoading || redirected.current) return;

    if (!profile || !["admin", "gym_owner"].includes(profile.role || "")) {
      redirected.current = true;
      router.replace("/(app)/(tabs)"); // send non-admin back to app tabs
    }
  }, [profile, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B82F6" />
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
        tabBarActiveTintColor: "#3B82F6",
        tabBarStyle: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: ({ size, color }) => <Home size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="gym-profile"
        options={{ title: "Gym", tabBarIcon: ({ size, color }) => <Settings size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="members"
        options={{ title: "Members", tabBarIcon: ({ size, color }) => <Users size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ title: "Workouts", tabBarIcon: ({ size, color }) => <FileText size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{ title: "Plans", tabBarIcon: ({ size, color }) => <FileText size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ title: "Analytics", tabBarIcon: ({ size, color }) => <BarChart2 size={size} color={color} /> }}
      />
    </Tabs>
  );
}
