import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '@/contexts/ThemeContext';
import logo from '@/assets/images/splash-icon.png';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
  userId?: string;
  gymId?: string;
}

SplashScreen.preventAutoHideAsync();

export default function AnimatedSplashScreen({ onFinish, userId, gymId }: SplashScreenProps) {
  const { theme } = useTheme();
  const [gymData, setGymData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  
  // Loading dots animation
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    loadGymData();
    startLoadingDotsAnimation();
  }, [gymId]);

  useEffect(() => {
    if (!isLoading) {
      startAnimations();
    }
  }, [isLoading]);

  const startLoadingDotsAnimation = () => {
    const animateDot = (dotAnim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1Anim, 0);
    animateDot(dot2Anim, 200);
    animateDot(dot3Anim, 400);
  };

  const loadGymData = async () => {
    try {
      if (gymId) {
        const { data } = await supabase
          .from('gyms')
          .select('name, logo_url')
          .eq('id', gymId)
          .single();
        
        setGymData(data);
      }
    } catch (error) {
      console.log('Splash: Could not load gym data');
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }, 200);
    }
  };

  const startAnimations = () => {
    // Shimmer background effect
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Main animation sequence
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      
      // Slight delay
      Animated.delay(100),
      
      // Text entrance
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      
      // Hold for a moment
      Animated.delay(300),
      
      // Subtle pulse effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 1 }
      ),
      
      // Hold before exit
      Animated.delay(200),
      
      // Fade out
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  };

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shimmer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      opacity: 0.1,
    },
    logoContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
    },
    logoWrapper: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
      borderWidth: 3,
      borderColor: theme.colors.primary + '40',
    },
    logoImageContainer: {
      width: 130,
      height: 130,
      borderRadius: 65,
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gymLogo: {
      width: '100%',
      height: '100%',
    },
    defaultLogo: {
      width: '85%',
      height: '85%',
    },
    textContainer: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    appName: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -1,
      textAlign: 'center',
      marginBottom: 8,
      textShadowColor: theme.colors.primary + '80',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    tagline: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      letterSpacing: 2,
      textTransform: 'uppercase',
      textAlign: 'center',
      fontWeight: '600',
    },
    loadingContainer: {
      position: 'absolute',
      bottom: height * 0.15,
      alignItems: 'center',
    },
    loadingDots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    footer: {
      position: 'absolute',
      bottom: 40,
      alignItems: 'center',
    },
    poweredBy: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    gymcore: {
      fontSize: 11,
      color: theme.colors.textSecondary + '90',
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Animated background gradient effect */}
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: shimmerTranslateX }],
          },
        ]}
      />

      {/* Logo Container */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [
              { scale: Animated.multiply(logoScale, pulseAnim) },
            ],
          },
        ]}
      >
        <View style={styles.logoWrapper}>
          <View style={styles.logoImageContainer}>
            {gymData?.logo_url ? (
              <Image
                source={{ uri: gymData.logo_url }}
                style={styles.gymLogo}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={logo}
                style={styles.defaultLogo}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Animated.View>

      {/* App/Gym Name */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.appName}>
          {gymData?.name || 'GymCore'}
        </Text>
        <Text style={styles.tagline}>Train Smarter Daily</Text>
      </Animated.View>

      {/* Loading indicator */}
      <Animated.View style={[styles.loadingContainer, { opacity: textOpacity }]}>
        <View style={styles.loadingDots}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1Anim,
                transform: [{ scale: dot1Anim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2Anim,
                transform: [{ scale: dot2Anim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3Anim,
                transform: [{ scale: dot3Anim }],
              },
            ]}
          />
        </View>
      </Animated.View>

      {/* Powered by footer */}
      <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
        <Text style={styles.gymcore}>Gym Core </Text>
        <Text style={styles.poweredBy}>Powered by Beengg</Text>
      </Animated.View>
    </Animated.View>
  );
}