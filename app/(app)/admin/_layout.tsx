// /app/(app)/admin/_layout.tsx
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { Tabs, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Settings, Users, BarChart2, FileText, Home, UserCheck, Dumbbell } from "lucide-react-native";
import PremiumLockModal from "@/components/PremiumLockModal";


export default function AdminTabsLayout() {
  const { user, profile, gym, refreshProfile, refreshGym, isLoading } = useAuth();
  const { theme } = useTheme();
  const { hasActiveSubscription, canAccessFeature } = useSubscription();
  const insets = useSafeAreaInsets();
  const redirected = useRef(false);
  const hasRefreshed = useRef(false);
  const previousUserId = useRef<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockedFeature, setLockedFeature] = useState('');

  // Admin always has access, gym owners need subscription for locked tabs
  const hasTabAccess = (tabName: string): boolean => {
    if (profile?.role === 'admin') return true;
    if (profile?.role === 'gym_owner') {
      // Dashboard and gym-profile are always available
      if (tabName === 'index' || tabName === 'gym-profile') return true;
      return canAccessFeature(tabName);
    }
    return true;
  };

  


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
    <>
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
        options={{ 
          title: "Members", 
          tabBarIcon: ({ size, color }) => {
            const isLocked = !hasTabAccess('members');
            return (
              <View style={adminStyles.iconContainer}>
                <Users size={size} color={isLocked ? theme.colors.border : color} />
                {isLocked && (
                  <View style={[adminStyles.lockBadge, { backgroundColor: theme.colors.lockBg, borderColor: theme.colors.lockBorder }]}>
                    <Text style={adminStyles.lockText}>🔒</Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!hasTabAccess('members')) {
              e.preventDefault();
              setLockedFeature('Members Management');
              setShowLockModal(true);
            }
          },
        }}
      />
      <Tabs.Screen
        name="personal-training"
        options={{ 
          title: "PT", 
          tabBarIcon: ({ size, color }) => {
            const isLocked = !hasTabAccess('personal-training');
            return (
              <View style={adminStyles.iconContainer}>
                <UserCheck size={size} color={isLocked ? theme.colors.border : color} />
                {isLocked && (
                  <View style={[adminStyles.lockBadge, { backgroundColor: theme.colors.lockBg, borderColor: theme.colors.lockBorder }]}>
                    <Text style={adminStyles.lockText}>🔒</Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!hasTabAccess('personal-training')) {
              e.preventDefault();
              setLockedFeature('Personal Training');
              setShowLockModal(true);
            }
          },
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{ 
          title: "Workouts", 
          tabBarIcon: ({ size, color }) => {
            const isLocked = !hasTabAccess('workouts');
            return (
              <View style={adminStyles.iconContainer}>
                <Dumbbell size={size} color={isLocked ? theme.colors.border : color} />
                {isLocked && (
                  <View style={[adminStyles.lockBadge, { backgroundColor: theme.colors.lockBg, borderColor: theme.colors.lockBorder }]}>
                    <Text style={adminStyles.lockText}>🔒</Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!hasTabAccess('workouts')) {
              e.preventDefault();
              setLockedFeature('Workouts Management');
              setShowLockModal(true);
            }
          },
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ 
          title: "Analytics", 
          tabBarIcon: ({ size, color }) => {
            const isLocked = !hasTabAccess('analytics');
            return (
              <View style={adminStyles.iconContainer}>
                <BarChart2 size={size} color={isLocked ? theme.colors.border : color} />
                {isLocked && (
                  <View style={[adminStyles.lockBadge, { backgroundColor: theme.colors.lockBg, borderColor: theme.colors.lockBorder }]}>
                    <Text style={adminStyles.lockText}>🔒</Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!hasTabAccess('analytics')) {
              e.preventDefault();
              setLockedFeature('Analytics');
              setShowLockModal(true);
            }
          },
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{ 
          title: "Plans", 
          tabBarIcon: ({ size, color }) => {
            const isLocked = !hasTabAccess('subscriptions');
            return (
              <View style={adminStyles.iconContainer}>
                <FileText size={size} color={isLocked ? theme.colors.border : color} />
                {isLocked && (
                  <View style={[adminStyles.lockBadge, { backgroundColor: theme.colors.lockBg, borderColor: theme.colors.lockBorder }]}>
                    <Text style={adminStyles.lockText}>🔒</Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={{
          tabPress: (e) => {
            if (!hasTabAccess('subscriptions')) {
              e.preventDefault();
              setLockedFeature('Subscription Plans');
              setShowLockModal(true);
            }
          },
        }}
      />
      
      
       <Tabs.Screen
        name="gym-profile"
        options={{ title: "Gym", tabBarIcon: ({ size, color }) => <Settings size={size} color={color} /> }}
      />
    </Tabs>
    
    <PremiumLockModal
      visible={showLockModal}
      onClose={() => setShowLockModal(false)}
      feature={lockedFeature}
    />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const adminStyles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  lockBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  lockText: {
    fontSize: 10,
  },
});
