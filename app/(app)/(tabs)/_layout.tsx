import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useState, useEffect } from 'react';
import React from 'react';
import PremiumLockModal from '@/components/PremiumLockModal';
import {
  Home,
  Dumbbell,
  UtensilsCrossed,
  TrendingUp,
  User,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { hasActiveSubscription, loading } = useSubscription();
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockedFeature, setLockedFeature] = useState('');

  const hasPremiumAccess = 
    profile?.role === 'admin' || 
    profile?.role === 'gym_owner' || 
    hasActiveSubscription;

  useEffect(() => {
    console.log('🎯 TAB STATE:', { 
      role: profile?.role, 
      hasActiveSubscription, 
      loading, 
      hasPremiumAccess 
    });
  }, [profile?.role, hasActiveSubscription, loading, hasPremiumAccess]);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.tabBarActive,
          tabBarInactiveTintColor: theme.colors.tabBarInactive,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 65,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, focused }) => (
              <Home size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />

        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Workouts',
            tabBarIcon: ({ color, focused }) => {
              const isLocked = !hasPremiumAccess;
              return (
                <View style={styles.iconContainer}>
                  <Dumbbell 
                    size={24} 
                    color={isLocked ? theme.colors.border : color}
                    strokeWidth={focused ? 2.5 : 2}
                  />
                  {isLocked && (
                    <View style={[styles.lockBadge, { 
                      backgroundColor: theme.colors.lockBg, 
                      borderColor: theme.colors.lockBorder 
                    }]}>
                      <Text style={styles.lockText}>🔒</Text>
                    </View>
                  )}
                </View>
              );
            },
            tabBarLabel: ({ color, focused }) => (
              <Text style={[
                styles.tabLabel, 
                { color: !hasPremiumAccess ? theme.colors.border : color }
              ]}>
                Workouts
              </Text>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              if (!hasPremiumAccess) {
                e.preventDefault();
                setLockedFeature('Workouts');
                setShowLockModal(true);
              }
            },
          }}
        />

        <Tabs.Screen
          name="diet"
          options={{
            title: 'Diet',
            tabBarIcon: ({ color, focused }) => {
              const isLocked = !hasPremiumAccess;
              return (
                <View style={styles.iconContainer}>
                  <UtensilsCrossed 
                    size={24} 
                    color={isLocked ? theme.colors.border : color}
                    strokeWidth={focused ? 2.5 : 2}
                  />
                  {isLocked && (
                    <View style={[styles.lockBadge, { 
                      backgroundColor: theme.colors.lockBg, 
                      borderColor: theme.colors.lockBorder 
                    }]}>
                      <Text style={styles.lockText}>🔒</Text>
                    </View>
                  )}
                </View>
              );
            },
            tabBarLabel: ({ color, focused }) => (
              <Text style={[
                styles.tabLabel, 
                { color: !hasPremiumAccess ? theme.colors.border : color }
              ]}>
                Diet
              </Text>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              if (!hasPremiumAccess) {
                e.preventDefault();
                setLockedFeature('Diet Plans');
                setShowLockModal(true);
              }
            },
          }}
        />

        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color, focused }) => {
              const isLocked = !hasPremiumAccess;
              return (
                <View style={styles.iconContainer}>
                  <TrendingUp 
                    size={24} 
                    color={isLocked ? theme.colors.border : color}
                    strokeWidth={focused ? 2.5 : 2}
                  />
                  {isLocked && (
                    <View style={[styles.lockBadge, { 
                      backgroundColor: theme.colors.lockBg, 
                      borderColor: theme.colors.lockBorder 
                    }]}>
                      <Text style={styles.lockText}>🔒</Text>
                    </View>
                  )}
                </View>
              );
            },
            tabBarLabel: ({ color, focused }) => (
              <Text style={[
                styles.tabLabel, 
                { color: !hasPremiumAccess ? theme.colors.border : color }
              ]}>
                Progress
              </Text>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              if (!hasPremiumAccess) {
                e.preventDefault();
                setLockedFeature('Progress Tracking');
                setShowLockModal(true);
              }
            },
          }}
        />

        

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <User size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <Text style={[styles.tabLabel, { color }]}>
                Profile
              </Text>
            ),
          }}
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
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});