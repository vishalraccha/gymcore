import React, { useState,useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin' | 'gym_owner'>('member');
  const [isLoading, setIsLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const { signIn } = useAuth();

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

 

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      minHeight: Dimensions.get('window').height - 100,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    formCard: {
      marginBottom: 20,
      padding: 20,
      borderRadius: 16,
    },
    roleSection: {
      marginBottom: 24,
    },
    roleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    roleSelector: {
      flexDirection: 'row',
      gap: 12,
    },
    roleButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      gap: 8,
      minHeight: 48,
    },
    roleButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    roleButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    roleButtonTextActive: {
      color: theme.colors.card,
    },
    inputContainer: {
      marginBottom: 16,
    },
    input: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 52,
    },
    loginButton: {
      marginTop: 8,
      minHeight: 52,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      paddingHorizontal: 20,
    },
    footerText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    linkText: {
      fontSize: 15,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    demoCard: {
      padding: 20,
      backgroundColor: theme.colors.border + '40',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    demoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    demoGrid: {
      flexDirection: 'row',
      gap: 16,
    },
    demoItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    demoDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    demoRole: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
    },
    demoEmail: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    demoPassword: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    forgotPasswordContainer: {
      marginTop: 16,
      alignItems: 'center',
    },
    forgotPasswordText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });

  const handleLogin = async () => {
    if (!email || !password) {
      if (Platform.OS === 'web') {
        window.alert('Please fill in all fields');
      } else {
        Alert.alert('Error', 'Please fill in all fields');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password, selectedRole);
      
      if (error) {
        if (Platform.OS === 'web') {
          window.alert(error.message);
        } else {
          Alert.alert('Login Failed', error.message);
        }
        setIsLoading(false);
        return;
      }

      if (selectedRole === 'admin' || selectedRole === 'gym_owner') {
        router.replace('/(app)/admin');
      } else {
        router.replace('/(app)/(tabs)');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your fitness journey</Text>
            </View>

            {/* Main Form Card */}
            <Card style={styles.formCard}>
              {/* Role Selection */}
              <View style={styles.roleSection}>
                <Text style={styles.roleLabel}>Login as</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      selectedRole === 'member' && styles.roleButtonActive,
                    ]}
                    onPress={() => setSelectedRole('member')}
                    activeOpacity={0.7}
                  >
                    <User size={20} color={selectedRole === 'member' ? theme.colors.card : theme.colors.textSecondary} />
                    <Text style={[
                      styles.roleButtonText,
                      selectedRole === 'member' && styles.roleButtonTextActive,
                    ]}>
                      Member
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      selectedRole === 'admin' && styles.roleButtonActive,
                    ]}
                    onPress={() => setSelectedRole('admin')}
                    activeOpacity={0.7}
                  >
                    <Shield size={20} color={selectedRole === 'admin' ? theme.colors.card : theme.colors.textSecondary} />
                    <Text style={[
                      styles.roleButtonText,
                      selectedRole === 'admin' && styles.roleButtonTextActive,
                    ]}>
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="password"
                />
              </View>

              {/* Login Button */}
              <Button
                title="Sign In"
                onPress={handleLogin}
                isLoading={isLoading}
                style={styles.loginButton}
              />

              {/* Forgot Password Link */}
              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                style={styles.forgotPasswordContainer}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Card>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Dont have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.linkText}>Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>

           
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}